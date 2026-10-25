"""ThinkNet graph backend: configurable dimensions, graph validation, shape previews and PyTorch execution."""
from __future__ import annotations

from collections import defaultdict, deque
from typing import Any

import torch
from torch import nn
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel, Field

from backend.thinknet_architectures import architecture_catalog, build_architecture


# User-editable catalog metadata. Each entry can be surfaced in the GUI's "+" menu.
NODE_CATALOG = [
    ("Input", "I/O"), ("Output", "I/O"), ("Identity", "Utility"),
    ("Linear", "Core"), ("AutoLinear", "Core"), ("Embedding", "Embedding"),
    ("TokenEmbedding", "Embedding"), ("LearnedPositionEmbedding", "Position"),
    ("SinusoidalPositionEmbedding", "Position"), ("RotaryPositionEmbedding", "Position"),
    ("LayerNorm", "Normalization"), ("RMSNorm", "Normalization"),
    ("BatchNorm1d", "Normalization"), ("GroupNorm", "Normalization"),
    ("Dropout", "Regularization"), ("ReLU", "Activation"), ("GELU", "Activation"),
    ("SiLU", "Activation"), ("Sigmoid", "Activation"), ("Tanh", "Activation"),
    ("Softmax", "Activation"), ("SwiGLU", "FFN"), ("MLP", "FFN"),
    ("FeedForward", "FFN"), ("MultiHeadAttention", "Attention"),
    ("CausalSelfAttention", "Attention"), ("CrossAttention", "Attention"),
    ("GroupedQueryAttention", "Attention"), ("MultiQueryAttention", "Attention"),
    ("AdditiveAttention", "Attention"), ("LinearAttention", "Attention"),
    ("ScaledDotProductAttention", "Attention"), ("FlashAttention", "Attention"),
    ("Add", "Merge"), ("Multiply", "Merge"), ("Concat", "Merge"),
    ("ResidualAdd", "Transformer"), ("PreNormTransformerBlock", "Transformer"),
    ("TransformerEncoder", "Transformer"), ("LayerScale", "Transformer"),
    ("PatchEmbedding", "Vision"), ("ClassToken", "Vision"),
    ("VisionTransformerBlock", "Vision"), ("GlobalAveragePool", "Vision"),
    ("Conv2d", "Vision"), ("MaxPool2d", "Vision"), ("Flatten", "Shape"),
    ("Reshape", "Shape"), ("MeanPool", "Shape"), ("Architecture", "Architecture"),
]
# "partial" means an execution path exists but the node still needs broader
# acceptance coverage; "metadata-only" means it must not be treated as executable.
NODE_IMPLEMENTATION_STATUS = {
    "Input": "implemented-and-tested",
    "Output": "implemented-and-tested",
    "Identity": "implemented-and-tested",
    "Linear": "implemented-and-tested",
    "Embedding": "implemented-and-tested",
    "TokenEmbedding": "implemented-and-tested",
    "BatchNorm1d": "implemented-and-tested",
    "Dropout": "partial",
    "ReLU": "partial",
    "GELU": "partial",
    "SiLU": "partial",
    "Sigmoid": "partial",
    "Tanh": "partial",
    "Softmax": "implemented-and-tested",
    "AutoLinear": "partial",
    "LayerNorm": "partial",
    "RMSNorm": "partial",
    "Conv2d": "partial",
    "MaxPool2d": "partial",
    "GlobalAveragePool": "partial",
    "Flatten": "implemented-and-tested",
    "Reshape": "implemented-and-tested",
    "Add": "implemented-and-tested",
    "Multiply": "partial",
    "Concat": "implemented-and-tested",
    "ResidualAdd": "partial",
    "Architecture": "implemented-and-tested",
}
CATALOG = [
    {"type": name, "category": category,
     "status": NODE_IMPLEMENTATION_STATUS.get(name, "metadata-only")}
    for name, category in NODE_CATALOG
]


class NodeDef(BaseModel):
    id: str = Field(min_length=1, max_length=100)
    type: str
    config: dict[str, Any] = Field(default_factory=dict)


class EdgeDef(BaseModel):
    source: str
    target: str
    source_port: str = "output"
    target_port: str = "input"


class GraphDef(BaseModel):
    name: str = "untitled_architecture"
    nodes: list[NodeDef]
    edges: list[EdgeDef] = Field(default_factory=list)


def _order(graph: GraphDef) -> list[NodeDef]:
    by_id = {n.id: n for n in graph.nodes}
    degree = {n.id: 0 for n in graph.nodes}
    outgoing: dict[str, list[str]] = defaultdict(list)
    for edge in graph.edges:
        if edge.source in degree and edge.target in degree:
            degree[edge.target] += 1
            outgoing[edge.source].append(edge.target)
    queue = deque(k for k, d in degree.items() if d == 0)
    ordered = []
    while queue:
        current = queue.popleft()
        ordered.append(by_id[current])
        for target in outgoing[current]:
            degree[target] -= 1
            if degree[target] == 0:
                queue.append(target)
    if len(ordered) != len(graph.nodes):
        raise ValueError("Graph contains a cycle; this backend version supports DAGs.")
    return ordered


def validate_graph(graph: GraphDef) -> list[str]:
    errors: list[str] = []
    ids = [n.id for n in graph.nodes]
    if len(ids) != len(set(ids)):
        errors.append("Node IDs must be unique.")
    by_id = {n.id: n for n in graph.nodes}
    known = {n["type"] for n in CATALOG}
    for node in graph.nodes:
        if node.type not in known:
            errors.append(f"Unknown node type '{node.type}' on '{node.id}'.")
        cfg = node.config
        if node.type == "Input":
            shape = cfg.get("shape", [128])
            if not isinstance(shape, list) or not shape:
                errors.append(f"Input '{node.id}' shape must be a non-empty list of sample dimensions.")
            elif any(not isinstance(d, int) or d == 0 or d < -1 for d in shape):
                errors.append(f"Input '{node.id}' dimensions must be positive integers; -1 is allowed for one variable dimension.")
            elif sum(d == -1 for d in shape) > 1:
                errors.append(f"Input '{node.id}' may contain at most one -1 dimension.")
        if node.type == "Architecture":
            architecture_name = cfg.get("architecture")
            supported = {item["name"] for item in architecture_catalog()}
            if not isinstance(architecture_name, str) or architecture_name not in supported:
                errors.append(f"Node '{node.id}': config.architecture must be one of the supported architecture names.")
            if not isinstance(cfg.get("config", {}), dict):
                errors.append(f"Node '{node.id}': config.config must be an object.")
        if node.type in {"MultiHeadAttention", "CausalSelfAttention", "GroupedQueryAttention", "MultiQueryAttention"}:
            width, heads = cfg.get("d_model", 512), cfg.get("num_heads", 8)
            if not isinstance(width, int) or not isinstance(heads, int) or width < 1 or heads < 1 or width % heads:
                errors.append(f"Node '{node.id}': d_model must be divisible by num_heads.")
            if node.type == "GroupedQueryAttention":
                kv = cfg.get("num_kv_heads", 2)
                if not isinstance(kv, int) or kv < 1 or heads % kv:
                    errors.append(f"Node '{node.id}': num_heads must be divisible by num_kv_heads.")
    incoming: dict[str, list[EdgeDef]] = defaultdict(list)
    for edge in graph.edges:
        if edge.source not in by_id:
            errors.append(f"Missing edge source '{edge.source}'.")
            continue
        if edge.target not in by_id:
            errors.append(f"Missing edge target '{edge.target}'.")
            continue
        if edge.source == edge.target:
            errors.append(f"Self-loop at '{edge.source}' is unsupported.")
        incoming[edge.target].append(edge)
    for node in graph.nodes:
        if node.type not in {"Input"} and not incoming[node.id]:
            errors.append(f"Node '{node.id}' has no incoming edge.")
        if node.type in {"Add", "Multiply", "ResidualAdd"} and len(incoming[node.id]) != 2:
            errors.append(f"Node '{node.id}' ({node.type}) requires exactly two incoming edges.")
        if node.type == "Concat" and len(incoming[node.id]) < 2:
            errors.append(f"Node '{node.id}' (Concat) requires at least two incoming edges.")
        if node.type == "Reshape":
            target_shape = node.config.get("shape")
            if not isinstance(target_shape, list) or not target_shape or any(not isinstance(d, int) or d == 0 or d < -1 for d in target_shape) or sum(d == -1 for d in target_shape) > 1:
                errors.append(f"Node '{node.id}': Reshape config.shape must be a non-empty list of non-zero integers with at most one -1.")
    edge_keys = [(e.source, e.source_port, e.target, e.target_port) for e in graph.edges]
    if len(edge_keys) != len(set(edge_keys)):
        errors.append("Duplicate edges are unsupported.")
    try:
        _order(graph)
    except ValueError as exc:
        errors.append(str(exc))
    if not any(n.type == "Input" for n in graph.nodes):
        errors.append("Graph requires an Input node.")
    if not any(n.type == "Output" for n in graph.nodes):
        errors.append("Graph requires an Output node.")
    return errors


def infer_shapes(graph: GraphDef, input_shape: list[int] | None = None) -> dict[str, Any]:
    """Best-effort shape preview. Input config shapes exclude batch; input_shape includes it."""
    shapes: dict[str, list[int | None] | None] = {}
    incoming: dict[str, list[EdgeDef]] = defaultdict(list)
    for edge in graph.edges:
        incoming[edge.target].append(edge)
    for node in _order(graph):
        cfg, kind = node.config, node.type
        source_shapes = [shapes.get(e.source) for e in incoming[node.id]]
        x = source_shapes[0] if source_shapes else None
        if kind == "Input":
            raw = input_shape if input_shape is not None else cfg.get("shape", [128])
            shapes[node.id] = [None if d == -1 else int(d) for d in raw] if input_shape is not None else [None] + [None if d == -1 else int(d) for d in raw]
        elif kind == "Output":
            shapes[node.id] = x
        elif kind in {"Linear", "AutoLinear"} and x:
            result = list(x)
            result[-1] = cfg.get("out_features", 128)
            shapes[node.id] = result
        elif kind in {"Embedding", "TokenEmbedding"} and x:
            width = cfg.get("embedding_dim", cfg.get("d_model", 128))
            shapes[node.id] = list(x) + [width]
        elif kind in {"Add", "Multiply", "ResidualAdd"}:
            shapes[node.id] = x if len(source_shapes) < 2 or source_shapes[1] == x else None
        elif kind == "Concat" and x and len(source_shapes) > 1 and source_shapes[1]:
            y = source_shapes[1]
            dim = cfg.get("dim", -1) % len(x)
            if len(x) == len(y) and all(a == b or i == dim for i, (a, b) in enumerate(zip(x, y))):
                result = list(x)
                result[dim] = None if x[dim] is None or y[dim] is None else x[dim] + y[dim]
                shapes[node.id] = result
            else:
                shapes[node.id] = None
        elif kind == "PatchEmbedding" and x and len(x) == 4:
            p = cfg.get("patch_size", 16)
            shapes[node.id] = [x[0], None if x[2] is None or x[3] is None else (x[2] // p) * (x[3] // p), cfg.get("d_model", 768)]
        elif kind == "ClassToken" and x and len(x) >= 3:
            result = list(x)
            result[-2] = None if result[-2] is None else result[-2] + 1
            shapes[node.id] = result
        elif kind == "Flatten" and x:
            start = cfg.get("start_dim", 1)
            end = cfg.get("end_dim", -1)
            start = start if start >= 0 else len(x) + start
            end = end if end >= 0 else len(x) + end
            dims = x[start:end + 1]
            product = 1
            for d in dims:
                if d is None:
                    product = None
                    break
                product *= d
            shapes[node.id] = list(x[:start]) + [product] + list(x[end + 1:])
        elif kind == "Reshape" and x:
            target = cfg.get("shape", [])
            if len(target) and sum(d == -1 for d in target) <= 1:
                shapes[node.id] = [x[0]] + [None if d == -1 else d for d in target]
            else:
                shapes[node.id] = None
        elif kind == "GlobalAveragePool" and x and len(x) == 4:
            shapes[node.id] = [x[0], x[1]]
        elif kind == "Conv2d" and x and len(x) == 4:
            kernel = cfg.get("kernel_size", 3)
            stride = cfg.get("stride", 1)
            padding = cfg.get("padding", 0)
            kernel = kernel[0] if isinstance(kernel, list) else kernel
            stride = stride[0] if isinstance(stride, list) else stride
            padding = padding[0] if isinstance(padding, list) else padding
            h = None if x[2] is None else (x[2] + 2 * padding - kernel) // stride + 1
            w = None if x[3] is None else (x[3] + 2 * padding - kernel) // stride + 1
            shapes[node.id] = [x[0], cfg.get("out_channels", 16), h, w]
        elif kind == "MaxPool2d" and x and len(x) == 4:
            kernel = cfg.get("kernel_size", 2)
            stride = cfg.get("stride", kernel)
            kernel = kernel[0] if isinstance(kernel, list) else kernel
            stride = stride[0] if isinstance(stride, list) else stride
            shapes[node.id] = [x[0], x[1], None if x[2] is None else (x[2] - kernel) // stride + 1, None if x[3] is None else (x[3] - kernel) // stride + 1]
        elif kind == "Architecture" and x:
            architecture = cfg.get("architecture")
            ac = cfg.get("config", {})
            if architecture == "mlp" and len(x) >= 2:
                shapes[node.id] = list(x[:-1]) + [ac.get("output_dim", 10)]
            elif architecture == "decoder_transformer_lm" and len(x) == 2:
                shapes[node.id] = list(x) + [ac.get("vocab_size", 256)]
            elif architecture in {"vit_classifier", "cnn_classifier"} and len(x) == 4:
                shapes[node.id] = [x[0], ac.get("num_classes", 10)]
            else:
                shapes[node.id] = None
        elif kind in {"LayerNorm", "RMSNorm", "BatchNorm1d", "Dropout", "Identity", "ReLU", "GELU", "SiLU", "Sigmoid", "Tanh", "Softmax", "MultiHeadAttention", "CausalSelfAttention", "GroupedQueryAttention", "MultiQueryAttention", "FlashAttention", "PreNormTransformerBlock", "TransformerEncoder", "VisionTransformerBlock", "MLP", "FeedForward", "SwiGLU", "LayerScale", "RotaryPositionEmbedding", "SinusoidalPositionEmbedding", "LearnedPositionEmbedding"}:
            shapes[node.id] = x
        else:
            shapes[node.id] = None
    return {"shapes": shapes, "outputs": {n.id: shapes.get(n.id) for n in graph.nodes if n.type == "Output"},
            "note": "Advisory shape inference only; confirm behavior with runtime inference."}


class _MLP(nn.Module):
    def __init__(self, in_features: int, out_features: int, hidden: int):
        super().__init__()
        self.layers = nn.Sequential(nn.Linear(in_features, hidden), nn.GELU(), nn.Linear(hidden, out_features))
    def forward(self, x):
        return self.layers(x)


class _Reshape(nn.Module):
    """Reshape each sample while preserving the leading batch dimension."""
    def __init__(self, shape: list[int]):
        super().__init__()
        self.shape = tuple(shape)

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        return x.reshape(x.shape[0], *self.shape)


class CompiledGraph(nn.Module):
    """Initial executable subset; architecture nodes are expanded incrementally."""
    def __init__(self, graph: GraphDef):
        super().__init__()
        self.graph = graph
        self.ordered = _order(graph)
        nodes = [n for n in graph.nodes if n.type not in {"Input", "Output"}]
        self.keys = {n.id: f"node_{i}" for i, n in enumerate(nodes)}
        modules = {}
        for n in nodes:
            c, t = n.config, n.type
            if t in {"Add", "Multiply", "ResidualAdd", "Concat"}:
                continue  # Merge operations are evaluated directly in forward().
            if t == "Linear":
                modules[self.keys[n.id]] = nn.Linear(c.get("in_features", 128), c.get("out_features", 128), bias=c.get("bias", True))
            elif t == "AutoLinear":
                modules[self.keys[n.id]] = nn.LazyLinear(c.get("out_features", 128), bias=c.get("bias", True))
            elif t == "LayerNorm":
                modules[self.keys[n.id]] = nn.LayerNorm(c.get("normalized_shape", 512), eps=c.get("eps", 1e-5))
            elif t == "RMSNorm":
                modules[self.keys[n.id]] = nn.RMSNorm(c.get("normalized_shape", 512), eps=c.get("eps", 1e-6))
            elif t in {"Embedding", "TokenEmbedding"}:
                modules[self.keys[n.id]] = nn.Embedding(c.get("num_embeddings", c.get("vocab_size", 1000)), c.get("embedding_dim", c.get("d_model", 128)))
            elif t == "BatchNorm1d":
                modules[self.keys[n.id]] = nn.BatchNorm1d(c.get("num_features", c.get("features", 128)))
            elif t == "Conv2d":
                modules[self.keys[n.id]] = nn.Conv2d(c.get("in_channels", 3), c.get("out_channels", 16), c.get("kernel_size", 3), stride=c.get("stride", 1), padding=c.get("padding", 0), bias=c.get("bias", True))
            elif t == "MaxPool2d":
                modules[self.keys[n.id]] = nn.MaxPool2d(c.get("kernel_size", 2), stride=c.get("stride", c.get("kernel_size", 2)), padding=c.get("padding", 0))
            elif t == "GlobalAveragePool":
                modules[self.keys[n.id]] = nn.Sequential(nn.AdaptiveAvgPool2d(1), nn.Flatten(start_dim=1))
            elif t == "Flatten":
                modules[self.keys[n.id]] = nn.Flatten(start_dim=c.get("start_dim", 1), end_dim=c.get("end_dim", -1))
            elif t == "Reshape":
                modules[self.keys[n.id]] = _Reshape(c["shape"])
            elif t == "Sigmoid": modules[self.keys[n.id]] = nn.Sigmoid()
            elif t == "Tanh": modules[self.keys[n.id]] = nn.Tanh()
            elif t == "Softmax": modules[self.keys[n.id]] = nn.Softmax(dim=c.get("dim", -1))
            elif t == "Dropout":
                modules[self.keys[n.id]] = nn.Dropout(c.get("p", 0.1))
            elif t == "GELU": modules[self.keys[n.id]] = nn.GELU()
            elif t == "ReLU": modules[self.keys[n.id]] = nn.ReLU()
            elif t == "SiLU": modules[self.keys[n.id]] = nn.SiLU()
            elif t == "Identity": modules[self.keys[n.id]] = nn.Identity()
            elif t == "Architecture":
                try:
                    modules[self.keys[n.id]] = build_architecture(c.get("architecture"), c.get("config", {}))
                except (TypeError, ValueError) as exc:
                    raise ValueError(f"Invalid architecture config on node '{n.id}': {exc}") from exc
            else: raise ValueError(f"Node '{n.id}' ({t}) is catalogued but not yet executable in this initial compiler.")
        self.modules_by_key = nn.ModuleDict(modules)
        self.incoming: dict[str, list[EdgeDef]] = defaultdict(list)
        for edge in graph.edges: self.incoming[edge.target].append(edge)

    def forward(self, x: torch.Tensor, extra_inputs: dict[str, torch.Tensor] | None = None):
        values = {}
        extra_inputs = extra_inputs or {}
        for node in self.ordered:
            if node.type == "Input":
                tensor = extra_inputs.get(node.id, x)
                expected = node.config.get("shape")
                if expected is not None:
                    if tensor.ndim != len(expected) + 1:
                        raise ValueError(f"Input '{node.id}' expects batch + sample shape {expected}, got {list(tensor.shape)}.")
                    for axis, (actual, configured) in enumerate(zip(tensor.shape[1:], expected), start=1):
                        if configured != -1 and actual != configured:
                            raise ValueError(f"Input '{node.id}' dimension mismatch at axis {axis}: expected {configured}, got {actual}.")
                values[node.id] = tensor
                continue
            edge_values = [values[e.source] for e in self.incoming[node.id]]
            if node.type == "Output":
                values[node.id] = edge_values[0]
            elif node.type in {"Add", "Multiply", "ResidualAdd"}:
                if len(edge_values) != 2: raise ValueError(f"{node.type} needs two incoming tensors.")
                values[node.id] = edge_values[0] + edge_values[1] if node.type != "Multiply" else edge_values[0] * edge_values[1]
            elif node.type == "Concat":
                dim = node.config.get("dim", -1)
                values[node.id] = torch.cat(edge_values, dim=dim)
            else:
                values[node.id] = self.modules_by_key[self.keys[node.id]](edge_values[0])
        outputs = [values[n.id] for n in self.graph.nodes if n.type == "Output"]
        return outputs[0] if len(outputs) == 1 else tuple(outputs)


app = FastAPI(title="ThinkNet Architecture Backend", version="0.2.0")


@app.get("/health")
def health():
    return {"status": "ok", "service": "thinknet-backend", "torch_version": torch.__version__}


@app.get("/api/v1/nodes")
def list_nodes():
    """Return catalog metadata with explicit execution status for every node."""
    return {"count": len(CATALOG), "nodes": CATALOG}


@app.get("/api/v1/architectures")
def list_architectures():
    """Return only reference architectures with executable builders and tests."""
    return {"count": len(architecture_catalog()), "architectures": architecture_catalog()}


@app.post("/api/v1/graphs/validate")
def validate(payload: GraphDef):
    errors = validate_graph(payload)
    return {"valid": not errors, "errors": errors, "node_count": len(payload.nodes), "edge_count": len(payload.edges)}


@app.post("/api/v1/graphs/infer-shapes")
def graph_shapes(payload: GraphDef, input_shape: list[int] | None = None):
    errors = validate_graph(payload)
    if errors: raise HTTPException(status_code=400, detail={"errors": errors})
    try: return infer_shapes(payload, input_shape)
    except Exception as exc: raise HTTPException(status_code=400, detail=str(exc))


@app.post("/api/v1/models/compile")
def compile_model(payload: GraphDef):
    errors = validate_graph(payload)
    if errors: raise HTTPException(status_code=400, detail={"errors": errors})
    try:
        model = CompiledGraph(payload).eval()
        return {"compiled": True, "parameter_count": sum(p.numel() for p in model.parameters()),
                "shape_preview": infer_shapes(payload)}
    except Exception as exc:
        raise HTTPException(status_code=400, detail=str(exc))

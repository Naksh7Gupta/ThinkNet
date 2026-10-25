"""ThinkNet graph backend: configurable dimensions, graph validation, shape previews and PyTorch execution."""
from __future__ import annotations

from collections import defaultdict, deque
from typing import Any
from uuid import uuid4

import torch
from torch import nn
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel, Field

from backend.thinknet_architectures import architecture_catalog, build_architecture
from backend.thinknet_quantization import QuantizerNode, quantization_report, SUPPORTED_DTYPES
from backend.thinknet_codegen import generate_python_source


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
    ("Quantizer", "Model Transform"), ("LMHead", "Language Model"),
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
    "ResidualAdd": "implemented-and-tested",
    "Architecture": "implemented-and-tested",
    "Quantizer": "implemented-and-tested",
    "LMHead": "implemented-and-tested",
    "MultiHeadAttention": "implemented-and-tested",
    "CausalSelfAttention": "implemented-and-tested",
    "PreNormTransformerBlock": "implemented-and-tested",
    "MLP": "implemented-and-tested",
    "FeedForward": "implemented-and-tested",
    "SwiGLU": "implemented-and-tested",
    "LearnedPositionEmbedding": "implemented-and-tested",
    "SinusoidalPositionEmbedding": "implemented-and-tested",
    "LayerScale": "implemented-and-tested",
}

CATEGORY_COLORS = {
    "I/O": "#64748B", "Utility": "#94A3B8", "Core": "#3B82F6",
    "Embedding": "#8B5CF6", "Position": "#A855F7", "Normalization": "#14B8A6",
    "Regularization": "#F59E0B", "Activation": "#10B981", "FFN": "#6366F1",
    "Attention": "#EC4899", "Merge": "#F97316", "Transformer": "#D97706",
    "Vision": "#0891B2", "Shape": "#0EA5E9", "Architecture": "#475569",
    "Model Transform": "#EA580C", "Language Model": "#7C3AED",
}
SMALL_NODES = {
    "Input", "Output", "Identity", "Linear", "AutoLinear", "LMHead",
    "LayerNorm", "RMSNorm", "BatchNorm1d", "Dropout", "ReLU", "GELU",
    "SiLU", "Sigmoid", "Tanh", "Softmax", "Add", "Multiply", "ResidualAdd",
}
LARGE_NODES = {
    "Architecture", "Quantizer", "MLP", "FeedForward", "SwiGLU",
    "MultiHeadAttention", "CausalSelfAttention", "CrossAttention",
    "GroupedQueryAttention", "MultiQueryAttention", "AdditiveAttention",
    "LinearAttention", "ScaledDotProductAttention", "FlashAttention",
    "PreNormTransformerBlock", "TransformerEncoder", "VisionTransformerBlock",
}
NODE_GEOMETRY = {
    "small": {"width": 136, "height": 64},
    "medium": {"width": 176, "height": 82},
    "large": {"width": 216, "height": 104},
}
NODE_GEOMETRY_OVERRIDES = {
    "Architecture": {"width": 224, "height": 112},
    "Quantizer": {"width": 252, "height": 132},
    "LMHead": {"width": 144, "height": 62},
}
NODE_COLOR_OVERRIDES = {"Quantizer": "#EA580C", "LMHead": "#7C3AED"}


def _catalog_entry(name: str, category: str) -> dict[str, Any]:
    size = "small" if name in SMALL_NODES else "large" if name in LARGE_NODES else "medium"
    geometry = {**NODE_GEOMETRY[size], **NODE_GEOMETRY_OVERRIDES.get(name, {})}
    entry: dict[str, Any] = {
        "type": name, "category": category,
        "status": NODE_IMPLEMENTATION_STATUS.get(name, "metadata-only"),
        "size": size, **geometry,
        "color": NODE_COLOR_OVERRIDES.get(name, CATEGORY_COLORS.get(category, "#64748B")),
        "input_kind": "tensor", "output_kind": "tensor",
        "execution_domain": "tensor-graph",
    }
    if name == "Quantizer":
        entry.update({
            "input_kind": "model", "output_kind": "quantized-model",
            "execution_domain": "model-transform",
            "config_fields": [{
                "name": "dtype", "label": "Output dtype", "type": "select",
                "required": True, "default": "int8",
                "options": [
                    {"label": "INT8 (dynamic Linear quantization)", "value": "int8"},
                    {"label": "Float16", "value": "float16"},
                    {"label": "BFloat16", "value": "bfloat16"},
                ],
            }],
        })
    return entry


CATALOG = [_catalog_entry(name, category) for name, category in NODE_CATALOG]


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
        if node.type == "Quantizer":
            dtype = cfg.get("dtype", "int8")
            if dtype not in SUPPORTED_DTYPES:
                errors.append(f"Node '{node.id}': dtype must be one of {SUPPORTED_DTYPES}.")
            errors.append(
                f"Node '{node.id}' is a model-transform operation, not a tensor graph operation. "
                "Compile the model first, then call POST /api/v1/models/quantize."
            )
        if node.type == "LMHead":
            in_features = cfg.get("in_features", cfg.get("d_model", 128))
            out_features = cfg.get("vocab_size", cfg.get("out_features", 256))
            if any(isinstance(v, bool) or not isinstance(v, int) or v < 1 for v in (in_features, out_features)):
                errors.append(f"Node '{node.id}': LMHead input width and vocabulary/output width must be positive integers.")
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
        elif kind == "LMHead" and x:
            result = list(x)
            result[-1] = cfg.get("vocab_size", cfg.get("out_features", 256))
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


class _SequenceAttention(nn.Module):
    """Batch-first self-attention with optional causal masking."""
    def __init__(self, d_model: int, num_heads: int, dropout: float = 0.0, causal: bool = False):
        super().__init__()
        if d_model < 1 or num_heads < 1 or d_model % num_heads:
            raise ValueError("d_model must be positive and divisible by num_heads.")
        if not 0.0 <= dropout < 1.0:
            raise ValueError("dropout must be in [0, 1).")
        self.attention = nn.MultiheadAttention(d_model, num_heads, dropout=dropout, batch_first=True)
        self.causal = causal

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        if x.ndim != 3:
            raise ValueError("Attention expects [batch, sequence, features].")
        mask = None
        if self.causal:
            length = x.shape[1]
            mask = torch.triu(torch.ones(length, length, device=x.device, dtype=torch.bool), diagonal=1)
        return self.attention(x, x, x, attn_mask=mask, need_weights=False)[0]


class _PreNormTransformerBlock(nn.Module):
    """Pre-norm self-attention and feed-forward residual block."""
    def __init__(self, d_model: int, num_heads: int, mlp_ratio: int = 4, dropout: float = 0.0, causal: bool = False):
        super().__init__()
        if mlp_ratio < 1:
            raise ValueError("mlp_ratio must be positive.")
        self.norm1 = nn.LayerNorm(d_model)
        self.attention = _SequenceAttention(d_model, num_heads, dropout, causal)
        self.norm2 = nn.LayerNorm(d_model)
        self.ffn = nn.Sequential(
            nn.Linear(d_model, d_model * mlp_ratio), nn.GELU(),
            nn.Dropout(dropout), nn.Linear(d_model * mlp_ratio, d_model),
            nn.Dropout(dropout),
        )

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        x = x + self.attention(self.norm1(x))
        return x + self.ffn(self.norm2(x))


class _FeedForward(nn.Module):
    def __init__(self, d_model: int, hidden_features: int | None = None, dropout: float = 0.0):
        super().__init__()
        hidden = hidden_features or 4 * d_model
        self.layers = nn.Sequential(nn.Linear(d_model, hidden), nn.GELU(), nn.Dropout(dropout), nn.Linear(hidden, d_model))

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        return self.layers(x)


class _SwiGLU(nn.Module):
    def __init__(self, d_model: int, hidden_features: int | None = None):
        super().__init__()
        hidden = hidden_features or 4 * d_model
        self.gate = nn.Linear(d_model, hidden)
        self.value = nn.Linear(d_model, hidden)
        self.projection = nn.Linear(hidden, d_model)

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        return self.projection(torch.nn.functional.silu(self.gate(x)) * self.value(x))


class _LearnedPositionEmbedding(nn.Module):
    def __init__(self, d_model: int, max_seq_len: int = 2048):
        super().__init__()
        if d_model < 1 or max_seq_len < 1:
            raise ValueError("d_model and max_seq_len must be positive.")
        self.embedding = nn.Embedding(max_seq_len, d_model)

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        if x.ndim != 3:
            raise ValueError("LearnedPositionEmbedding expects [batch, sequence, features].")
        if x.shape[1] > self.embedding.num_embeddings or x.shape[2] != self.embedding.embedding_dim:
            raise ValueError("Sequence length or feature width does not match positional embedding configuration.")
        positions = torch.arange(x.shape[1], device=x.device)
        return x + self.embedding(positions).unsqueeze(0)


class _SinusoidalPositionEmbedding(nn.Module):
    def __init__(self, d_model: int):
        super().__init__()
        if d_model < 1:
            raise ValueError("d_model must be positive.")
        self.d_model = d_model

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        if x.ndim != 3 or x.shape[-1] != self.d_model:
            raise ValueError("SinusoidalPositionEmbedding expects [batch, sequence, d_model].")
        length = x.shape[1]
        positions = torch.arange(length, device=x.device, dtype=torch.float32).unsqueeze(1)
        scale = torch.exp(torch.arange(0, self.d_model, 2, device=x.device, dtype=torch.float32) * (-torch.log(torch.tensor(10000.0, device=x.device)) / self.d_model))
        encoding = torch.zeros(length, self.d_model, device=x.device, dtype=torch.float32)
        encoding[:, 0::2] = torch.sin(positions * scale)
        if self.d_model > 1:
            encoding[:, 1::2] = torch.cos(positions * scale[:encoding[:, 1::2].shape[1]])
        return x + encoding.to(dtype=x.dtype).unsqueeze(0)


class _LayerScale(nn.Module):
    def __init__(self, d_model: int, init_value: float = 1e-5):
        super().__init__()
        if d_model < 1:
            raise ValueError("d_model must be positive.")
        self.gamma = nn.Parameter(torch.full((d_model,), float(init_value)))

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        if x.shape[-1] != self.gamma.numel():
            raise ValueError(f"LayerScale expects final dimension {self.gamma.numel()}, got {x.shape[-1]}.")
        return x * self.gamma


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
            elif t == "LMHead":
                modules[self.keys[n.id]] = nn.Linear(
                    c.get("in_features", c.get("d_model", 128)),
                    c.get("vocab_size", c.get("out_features", 256)),
                    bias=c.get("bias", False),
                )
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
            elif t == "MultiHeadAttention":
                modules[self.keys[n.id]] = _SequenceAttention(
                    c.get("d_model", 512), c.get("num_heads", 8), c.get("dropout", 0.0), causal=False
                )
            elif t == "CausalSelfAttention":
                modules[self.keys[n.id]] = _SequenceAttention(
                    c.get("d_model", 512), c.get("num_heads", 8), c.get("dropout", 0.0), causal=True
                )
            elif t == "PreNormTransformerBlock":
                modules[self.keys[n.id]] = _PreNormTransformerBlock(
                    c.get("d_model", 512), c.get("num_heads", 8),
                    c.get("mlp_ratio", 4), c.get("dropout", 0.0),
                    c.get("causal", False),
                )
            elif t in {"MLP", "FeedForward"}:
                modules[self.keys[n.id]] = _FeedForward(
                    c.get("d_model", c.get("in_features", 128)),
                    c.get("hidden_features", c.get("hidden_dim")),
                    c.get("dropout", 0.0),
                )
            elif t == "SwiGLU":
                modules[self.keys[n.id]] = _SwiGLU(
                    c.get("d_model", 128), c.get("hidden_features", c.get("hidden_dim"))
                )
            elif t == "LearnedPositionEmbedding":
                modules[self.keys[n.id]] = _LearnedPositionEmbedding(
                    c.get("d_model", 128), c.get("max_seq_len", 2048)
                )
            elif t == "SinusoidalPositionEmbedding":
                modules[self.keys[n.id]] = _SinusoidalPositionEmbedding(c.get("d_model", 128))
            elif t == "LayerScale":
                modules[self.keys[n.id]] = _LayerScale(
                    c.get("d_model", 128), c.get("init_value", 1e-5)
                )
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


app = FastAPI(title="ThinkNet Architecture Backend", version="0.3.0")

# Compiled model handles are process-local; restart clears them.
MODEL_STORE: dict[str, nn.Module] = {}


class QuantizationRequest(BaseModel):
    model_id: str = Field(min_length=1, max_length=100)
    dtype: str = Field(min_length=1, max_length=20)


def _logical_parameter_count(model: nn.Module) -> int:
    """Count ordinary parameters plus weights packed inside dynamic INT8 Linear modules."""
    total = sum(parameter.numel() for parameter in model.parameters())
    for module in model.modules():
        module_path = type(module).__module__.lower()
        if "quantized.dynamic" in module_path and "linear" in module_path:
            weight = module.weight()
            bias = module.bias()
            total += weight.numel()
            if bias is not None:
                total += bias.numel()
    return total


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


@app.post("/api/v1/models/quantize")
def quantize_compiled_model(payload: QuantizationRequest):
    """Return a new model handle transformed using the requested dtype."""
    try:
        transform = QuantizerNode(dtype=payload.dtype)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    source = MODEL_STORE.get(payload.model_id)
    if source is None:
        raise HTTPException(status_code=404, detail=f"Unknown model_id '{payload.model_id}'.")
    try:
        result = transform(source)
    except (TypeError, ValueError) as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    new_model_id = uuid4().hex
    MODEL_STORE[new_model_id] = result
    return {
        "quantized": True,
        "model_id": new_model_id,
        "source_model_id": payload.model_id,
        "dtype": payload.dtype,
        "parameter_count": _logical_parameter_count(result),
        "report": quantization_report(result, payload.dtype),
        "note": "This new model handle is in-memory and is lost when the backend process restarts.",
    }


@app.get("/api/v1/models/{model_id}")
def get_model_metadata(model_id: str):
    model = MODEL_STORE.get(model_id)
    if model is None:
        raise HTTPException(status_code=404, detail=f"Unknown model_id '{model_id}'.")
    return {
        "model_id": model_id,
        "parameter_count": _logical_parameter_count(model),
        "training": model.training,
        "module_count": sum(1 for _ in model.modules()),
    }


@app.delete("/api/v1/models/{model_id}")
def delete_model(model_id: str):
    if MODEL_STORE.pop(model_id, None) is None:
        raise HTTPException(status_code=404, detail=f"Unknown model_id '{model_id}'.")
    return {"deleted": True, "model_id": model_id}


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


@app.post("/api/v1/models/export")
def export_model_source(payload: GraphDef):
    """Validate a graph and return reusable Python source for its architecture."""
    errors = validate_graph(payload)
    if errors:
        raise HTTPException(status_code=400, detail={"errors": errors})
    try:
        # Compile once before exporting so catalogued but unsupported nodes fail
        # here rather than producing source that only fails when imported.
        CompiledGraph(payload)
        source = generate_python_source(payload.model_dump(mode="json"))
    except Exception as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    return {
        "exported": True,
        "filename": "exported_model.py",
        "language": "python",
        "python_source": source,
        "node_count": len(payload.nodes),
        "edge_count": len(payload.edges),
        "runtime_dependency": "ThinkNet backend package and its declared dependencies",
        "note": "The generated file embeds the graph spec and reuses ThinkNet's tested compiler; it is not a standalone vendored PyTorch implementation.",
    }


@app.post("/api/v1/models/compile")
def compile_model(payload: GraphDef):
    errors = validate_graph(payload)
    if errors: raise HTTPException(status_code=400, detail={"errors": errors})
    try:
        model = CompiledGraph(payload).eval()
        model_id = uuid4().hex
        MODEL_STORE[model_id] = model
        return {"compiled": True, "model_id": model_id,
                "parameter_count": _logical_parameter_count(model),
                "shape_preview": infer_shapes(payload),
                "note": "This model handle is in-memory and is lost when the backend process restarts."}
    except Exception as exc:
        raise HTTPException(status_code=400, detail=str(exc))

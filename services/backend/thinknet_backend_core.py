"""ThinkNet graph backend: configurable dimensions, graph validation, shape previews and PyTorch execution.

Starting the server
-------------------
Run it with the repository root as the working directory (the app is imported as
``services.backend.thinknet_backend_core:app``)::

    # Windows - use the project virtualenv (has torch + transformers)
    services\\backend\\.venv\\Scripts\\python.exe -m uvicorn services.backend.thinknet_backend_core:app --host 127.0.0.1 --port 8000

    # macOS / Linux
    services/backend/.venv/bin/python -m uvicorn services.backend.thinknet_backend_core:app --host 127.0.0.1 --port 8000

    # same, with auto-reload while developing
    python -m uvicorn services.backend.thinknet_backend_core:app --reload

Interactive docs: http://127.0.0.1:8000/docs - health probe: /health.

Environment
-----------
``THINKNET_EXTRA_ORIGINS``  comma-separated origins appended to the CORS allow-list
                            (the Electron desktop shell sets this to its own
                            ``http://127.0.0.1:<port>`` UI origin automatically).

The Electron shell (``npm run electron:dev`` / the packaged app) starts
and stops this server for you; see ``apps/desktop/electron/config.cjs --explain`` for the
interpreter and command it resolves.
"""
from __future__ import annotations

import math
import os
from collections import defaultdict, deque
from typing import Any
from uuid import uuid4

import torch
from torch import nn
from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

from services.backend.thinknet_architectures import architecture_catalog, build_architecture
from services.backend.thinknet_quantization import QuantizerNode, quantization_report, SUPPORTED_DTYPES
from services.backend.thinknet_codegen import generate_python_source
from services.backend.thinknet_training import mount_job_endpoints, router as training_router
from services.backend.thinknet_local_quantization import router as local_quantization_router
from services.backend.thinknet_pipelines import router as pipelines_router
from services.backend.thinknet_pipeline_jobs import router as pipeline_jobs_router


# User-editable catalog metadata. Each entry can be surfaced in the GUI's "+" menu.
NODE_CATALOG = [
    ("Input", "I/O"), ("Output", "I/O"), ("Identity", "Utility"),
    ("Linear", "Core"), ("AutoLinear", "Core"), ("Embedding", "Embedding"),
    ("TokenEmbedding", "Embedding"), ("LearnedPositionEmbedding", "Position"),
    ("SinusoidalPositionEmbedding", "Position"), ("RotaryPositionEmbedding", "Position"),
    ("LayerNorm", "Normalization"), ("RMSNorm", "Normalization"),
    ("BatchNorm1d", "Normalization"), ("BatchNorm2d", "Normalization"),
    ("GroupNorm", "Normalization"),
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
    ("PatchEmbedding", "Vision"), ("ClassToken", "Vision"), ("SelectToken", "Vision"),
    ("VisionTransformerBlock", "Vision"), ("GlobalAveragePool", "Vision"),
    ("Conv2d", "Vision"), ("MaxPool2d", "Vision"), ("AvgPool2d", "Vision"),
    ("AdaptiveAvgPool2d", "Vision"), ("Flatten", "Shape"),
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
    "AutoLinear": "implemented-and-tested",
    "Embedding": "implemented-and-tested",
    "TokenEmbedding": "implemented-and-tested",
    "BatchNorm1d": "implemented-and-tested",
    "BatchNorm2d": "implemented-and-tested",
    "GroupNorm": "implemented-and-tested",
    "LayerNorm": "implemented-and-tested",
    "RMSNorm": "implemented-and-tested",
    "Dropout": "implemented-and-tested",
    "ReLU": "implemented-and-tested",
    "GELU": "implemented-and-tested",
    "SiLU": "implemented-and-tested",
    "Sigmoid": "implemented-and-tested",
    "Tanh": "implemented-and-tested",
    "Softmax": "implemented-and-tested",
    "Conv2d": "implemented-and-tested",
    "MaxPool2d": "implemented-and-tested",
    "AvgPool2d": "implemented-and-tested",
    "AdaptiveAvgPool2d": "implemented-and-tested",
    "GlobalAveragePool": "implemented-and-tested",
    "PatchEmbedding": "implemented-and-tested",
    "ClassToken": "implemented-and-tested",
    "SelectToken": "implemented-and-tested",
    "MeanPool": "implemented-and-tested",
    "Flatten": "implemented-and-tested",
    "Reshape": "implemented-and-tested",
    "Add": "implemented-and-tested",
    "Multiply": "implemented-and-tested",
    "Concat": "implemented-and-tested",
    "ResidualAdd": "implemented-and-tested",
    "Architecture": "implemented-and-tested",
    "Quantizer": "implemented-and-tested",
    "LMHead": "implemented-and-tested",
    "MultiHeadAttention": "implemented-and-tested",
    "CausalSelfAttention": "implemented-and-tested",
    "CrossAttention": "implemented-and-tested",
    "GroupedQueryAttention": "implemented-and-tested",
    "MultiQueryAttention": "implemented-and-tested",
    "AdditiveAttention": "implemented-and-tested",
    "LinearAttention": "implemented-and-tested",
    "ScaledDotProductAttention": "implemented-and-tested",
    # Maps to PyTorch's fused SDPA kernel on CPU instead of a CUDA flash kernel.
    "FlashAttention": "partial",
    "PreNormTransformerBlock": "implemented-and-tested",
    "VisionTransformerBlock": "implemented-and-tested",
    "TransformerEncoder": "implemented-and-tested",
    "MLP": "implemented-and-tested",
    "FeedForward": "implemented-and-tested",
    "SwiGLU": "implemented-and-tested",
    "LearnedPositionEmbedding": "implemented-and-tested",
    "SinusoidalPositionEmbedding": "implemented-and-tested",
    "RotaryPositionEmbedding": "implemented-and-tested",
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
    "LayerNorm", "RMSNorm", "BatchNorm1d", "BatchNorm2d", "GroupNorm",
    "Dropout", "ReLU", "GELU", "SiLU", "Sigmoid", "Tanh", "Softmax",
    "Add", "Multiply", "ResidualAdd", "SelectToken", "MeanPool",
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
# Score kernels understood by _ProjectedAttention, exposed as separate catalog nodes.
ATTENTION_MODES = {"scaled-dot", "flash", "linear", "additive"}
ATTENTION_NODE_MODES = {
    "ScaledDotProductAttention": "scaled-dot", "FlashAttention": "flash",
    "LinearAttention": "linear", "AdditiveAttention": "additive",
}
# Nodes that consume more than one named tensor port: node type -> required target ports.
PORT_MODULE_INPUTS = {"CrossAttention": ("input", "input_b")}
PORT_ALIASES = {"context": "input_b"}


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
        if node.type in {"ScaledDotProductAttention", "FlashAttention", "LinearAttention", "AdditiveAttention"}:
            width, heads = cfg.get("d_model", 512), cfg.get("num_heads", 8)
            kv = cfg.get("num_kv_heads")
            if not isinstance(width, int) or not isinstance(heads, int) or width < 1 or heads < 1 or width % heads:
                errors.append(f"Node '{node.id}': d_model must be divisible by num_heads.")
            elif kv is not None and (isinstance(kv, bool) or not isinstance(kv, int) or kv < 1 or heads % kv):
                errors.append(f"Node '{node.id}': num_heads must be divisible by num_kv_heads.")
        if node.type in {"VisionTransformerBlock", "TransformerEncoder", "CrossAttention"}:
            width, heads = cfg.get("d_model", 512), cfg.get("num_heads", 8)
            if not isinstance(width, int) or not isinstance(heads, int) or width < 1 or heads < 1 or width % heads:
                errors.append(f"Node '{node.id}': d_model must be divisible by num_heads.")
            ratio = cfg.get("mlp_ratio", 4)
            if isinstance(ratio, bool) or not isinstance(ratio, (int, float)) or ratio <= 0:
                errors.append(f"Node '{node.id}': mlp_ratio must be a positive number.")
            if node.type == "TransformerEncoder":
                layers = cfg.get("num_layers", 2)
                if isinstance(layers, bool) or not isinstance(layers, int) or layers < 1:
                    errors.append(f"Node '{node.id}': num_layers must be a positive integer.")
        if node.type == "RotaryPositionEmbedding":
            width, heads = cfg.get("d_model", 512), cfg.get("num_heads", 8)
            if (not isinstance(width, int) or not isinstance(heads, int) or width < 1 or heads < 1
                    or width % heads or (width // heads) % 2):
                errors.append(f"Node '{node.id}': RoPE needs d_model divisible by num_heads with an even head width.")
        if node.type == "Conv2d":
            kernel = cfg.get("kernel_size", 3)
            dims = [cfg.get("in_channels", 3), cfg.get("out_channels", 16)]
            dims += kernel if isinstance(kernel, list) else [kernel]
            if any(isinstance(v, bool) or not isinstance(v, int) or v < 1 for v in dims):
                errors.append(f"Node '{node.id}': Conv2d channels and kernel size must be positive integers.")
        if node.type in {"MaxPool2d", "AvgPool2d"}:
            kernel, stride = cfg.get("kernel_size", 2), cfg.get("stride", cfg.get("kernel_size", 2))
            dims = (kernel if isinstance(kernel, list) else [kernel]) + (stride if isinstance(stride, list) else [stride])
            if any(isinstance(v, bool) or not isinstance(v, int) or v < 1 for v in dims):
                errors.append(f"Node '{node.id}': {node.type} kernel size and stride must be positive integers.")
        if node.type == "AdaptiveAvgPool2d":
            size = cfg.get("output_size", 1)
            dims = size if isinstance(size, list) else [size]
            if not dims or any(isinstance(v, bool) or not isinstance(v, int) or v < 1 for v in dims):
                errors.append(f"Node '{node.id}': output_size must be a positive integer or a pair of them.")
        if node.type == "BatchNorm2d":
            features = cfg.get("num_features", cfg.get("num_channels", 16))
            if isinstance(features, bool) or not isinstance(features, int) or features < 1:
                errors.append(f"Node '{node.id}': num_features must be a positive integer.")
        if node.type == "GroupNorm":
            groups, channels = cfg.get("num_groups", 8), cfg.get("num_channels", 16)
            if any(isinstance(v, bool) or not isinstance(v, int) or v < 1 for v in (groups, channels)) or channels % groups:
                errors.append(f"Node '{node.id}': num_channels must be divisible by num_groups.")
        if node.type == "PatchEmbedding":
            dims = [cfg.get("in_channels", 3), cfg.get("d_model", cfg.get("embed_dim", 768)), cfg.get("patch_size", 16)]
            if any(isinstance(v, bool) or not isinstance(v, int) or v < 1 for v in dims):
                errors.append(f"Node '{node.id}': in_channels, d_model and patch_size must be positive integers.")
        if node.type == "ClassToken":
            dims = [cfg.get("d_model", cfg.get("embed_dim", 768)), cfg.get("num_tokens", 1)]
            if any(isinstance(v, bool) or not isinstance(v, int) or v < 1 for v in dims):
                errors.append(f"Node '{node.id}': d_model and num_tokens must be positive integers.")
        if node.type in {"SelectToken", "MeanPool"}:
            keys = ("index", "dim") if node.type == "SelectToken" else ("dim",)
            for key in keys:
                value = cfg.get(key, 0 if key == "index" else -2)
                if isinstance(value, bool) or not isinstance(value, int):
                    errors.append(f"Node '{node.id}': {key} must be an integer.")
        if node.type == "Dropout":
            p = cfg.get("p", 0.1)
            if isinstance(p, bool) or not isinstance(p, (int, float)) or not 0.0 <= p < 1.0:
                errors.append(f"Node '{node.id}': dropout p must be in [0, 1).")
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
        if node.type == "CrossAttention" and not any(e.target_port in {"input_b", "context"} for e in incoming[node.id]):
            errors.append(f"Node '{node.id}' (CrossAttention) needs a query edge on 'input' and a context edge on 'input_b'.")
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
            result[-2] = None if result[-2] is None else result[-2] + cfg.get("num_tokens", 1)
            shapes[node.id] = result
        elif kind in {"SelectToken", "MeanPool"} and x and len(x) >= 3:
            axis = cfg.get("dim", -2)
            axis = axis if axis >= 0 else len(x) + axis
            shapes[node.id] = [d for i, d in enumerate(x) if i != axis] if 0 <= axis < len(x) else None
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
        elif kind in {"MaxPool2d", "AvgPool2d"} and x and len(x) == 4:
            kernel = cfg.get("kernel_size", 2)
            stride = cfg.get("stride", kernel)
            kernel = kernel[0] if isinstance(kernel, list) else kernel
            stride = stride[0] if isinstance(stride, list) else stride
            shapes[node.id] = [x[0], x[1], None if x[2] is None else (x[2] - kernel) // stride + 1, None if x[3] is None else (x[3] - kernel) // stride + 1]
        elif kind == "AdaptiveAvgPool2d" and x and len(x) == 4:
            size = cfg.get("output_size", 1)
            sizes = size if isinstance(size, list) else [size, size]
            sizes = sizes * 2 if len(sizes) == 1 else sizes
            shapes[node.id] = [x[0], x[1], sizes[0], sizes[1]]
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
        elif kind == "CrossAttention":
            query_edges = [e for e in incoming[node.id] if e.target_port not in {"input_b", "context"}]
            shapes[node.id] = shapes.get(query_edges[0].source) if query_edges else None
        elif kind in {"LayerNorm", "RMSNorm", "BatchNorm1d", "BatchNorm2d", "GroupNorm", "Dropout", "Identity", "ReLU", "GELU", "SiLU", "Sigmoid", "Tanh", "Softmax", "MultiHeadAttention", "CausalSelfAttention", "GroupedQueryAttention", "MultiQueryAttention", "AdditiveAttention", "LinearAttention", "ScaledDotProductAttention", "FlashAttention", "PreNormTransformerBlock", "TransformerEncoder", "VisionTransformerBlock", "MLP", "FeedForward", "SwiGLU", "LayerScale", "RotaryPositionEmbedding", "SinusoidalPositionEmbedding", "LearnedPositionEmbedding"}:
            shapes[node.id] = x
        else:
            shapes[node.id] = None
    return {"shapes": shapes, "outputs": {n.id: shapes.get(n.id) for n in graph.nodes if n.type == "Output"},
            "note": "Advisory shape inference only; POST /api/v1/graphs/verify runs a probe batch to prove it."}


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


class _PatchEmbedding(nn.Module):
    """Turn an image batch into tokens: [batch, C, H, W] -> [batch, (H//p)*(W//p), d_model]."""

    def __init__(self, in_channels: int, d_model: int, patch_size: int):
        super().__init__()
        if min(in_channels, d_model, patch_size) < 1:
            raise ValueError("in_channels, d_model and patch_size must be positive integers.")
        self.projection = nn.Conv2d(in_channels, d_model, kernel_size=patch_size, stride=patch_size)

    def forward(self, images: torch.Tensor) -> torch.Tensor:
        if images.ndim != 4:
            raise ValueError(f"PatchEmbedding expects [batch, channels, height, width], got {list(images.shape)}.")
        if images.shape[1] != self.projection.in_channels:
            raise ValueError(f"PatchEmbedding expects {self.projection.in_channels} channels, got {images.shape[1]}.")
        patch = self.projection.kernel_size[0] if isinstance(self.projection.kernel_size, tuple) else self.projection.kernel_size
        if images.shape[2] % patch or images.shape[3] % patch:
            raise ValueError(f"Image size {images.shape[2]}x{images.shape[3]} is not divisible by patch size {patch}.")
        return self.projection(images).flatten(2).transpose(1, 2)


class _ClassToken(nn.Module):
    """Prepend learnable, batch-broadcast tokens (a single [CLS] token by default)."""

    def __init__(self, d_model: int, num_tokens: int = 1, std: float = 0.02):
        super().__init__()
        if d_model < 1 or num_tokens < 1:
            raise ValueError("d_model and num_tokens must be positive integers.")
        self.tokens = nn.Parameter(std * torch.randn(1, num_tokens, d_model))

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        if x.ndim != 3:
            raise ValueError(f"ClassToken expects [batch, sequence, d_model], got {list(x.shape)}.")
        if x.shape[-1] != self.tokens.shape[-1]:
            raise ValueError(f"ClassToken expects width {self.tokens.shape[-1]}, got {x.shape[-1]}.")
        return torch.cat([self.tokens.expand(x.shape[0], -1, -1), x], dim=-2)


class _SelectToken(nn.Module):
    """Read one position off the sequence axis, e.g. index 0 for the [CLS] output."""

    def __init__(self, index: int = 0, dim: int = -2):
        super().__init__()
        self.index, self.dim = index, dim

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        axis = self.dim if self.dim >= 0 else x.ndim + self.dim
        if not 0 <= axis < x.ndim:
            raise ValueError(f"SelectToken dim {self.dim} is out of range for a rank-{x.ndim} tensor.")
        position = self.index if self.index >= 0 else x.shape[axis] + self.index
        if not 0 <= position < x.shape[axis]:
            raise ValueError(f"SelectToken index {self.index} is out of range for a length-{x.shape[axis]} axis.")
        return x.index_select(axis, torch.tensor([position], device=x.device)).squeeze(axis)


class _MeanPool(nn.Module):
    """Average over one axis (the token axis by default)."""

    def __init__(self, dim: int = -2):
        super().__init__()
        self.dim = dim

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        return x.mean(dim=self.dim)


class _RotaryPositionEmbedding(nn.Module):
    """Rotate query/key feature pairs by position-dependent angles (RoPE)."""

    def __init__(self, d_model: int, num_heads: int = 8, base: float = 10000.0):
        super().__init__()
        if d_model < 1 or num_heads < 1 or d_model % num_heads or (d_model // num_heads) % 2:
            raise ValueError("RoPE needs d_model divisible by num_heads with an even head width.")
        self.num_heads, self.head_dim = num_heads, d_model // num_heads
        inv_freq = 1.0 / (base ** (torch.arange(0, self.head_dim, 2, dtype=torch.float32) / self.head_dim))
        self.register_buffer("inv_freq", inv_freq)

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        if x.ndim != 3 or x.shape[-1] != self.num_heads * self.head_dim:
            raise ValueError(f"RotaryPositionEmbedding expects [batch, sequence, {self.num_heads * self.head_dim}].")
        batch, length, _ = x.shape
        positions = torch.arange(length, device=x.device, dtype=torch.float32)
        angles = torch.outer(positions, self.inv_freq.to(device=x.device, dtype=torch.float32))
        cos = angles.cos().repeat_interleave(2, dim=-1)
        sin = angles.sin().repeat_interleave(2, dim=-1)
        half = self.head_dim // 2
        heads = x.view(batch, length, self.num_heads, self.head_dim).transpose(1, 2)
        rotated = torch.cat((-heads[..., half:], heads[..., :half]), dim=-1)
        out = heads * cos + rotated * sin
        return out.transpose(1, 2).reshape(batch, length, self.num_heads * self.head_dim)


class _ProjectedAttention(nn.Module):
    """Attention over [batch, sequence, d_model] with a selectable score kernel.

    ``mode`` picks the maths: explicit softmax (``scaled-dot``), PyTorch's fused
    ``scaled_dot_product_attention`` kernel (``flash``), a softmax-free kernel-feature
    approximation (``linear``) or additive/Bahdanau scoring (``additive``). Fewer key/value
    heads than query heads gives grouped-query attention, and one gives multi-query.
    Passing ``context`` turns the same module into cross-attention.
    """

    def __init__(self, d_model: int, num_heads: int, num_kv_heads: int | None = None,
                 mode: str = "scaled-dot", causal: bool = False, dropout: float = 0.0):
        super().__init__()
        if mode not in ATTENTION_MODES:
            raise ValueError(f"Unknown attention mode '{mode}'; expected one of {sorted(ATTENTION_MODES)}.")
        if d_model < 1 or num_heads < 1 or d_model % num_heads:
            raise ValueError("d_model must be positive and divisible by num_heads.")
        if not 0.0 <= dropout < 1.0:
            raise ValueError("dropout must be in [0, 1).")
        kv_heads = num_kv_heads or num_heads
        if kv_heads < 1 or num_heads % kv_heads:
            raise ValueError("num_heads must be divisible by num_kv_heads.")
        self.mode, self.causal, self.dropout_p = mode, causal, dropout
        self.num_heads, self.kv_heads = num_heads, kv_heads
        self.head_dim = d_model // num_heads
        kv_width = self.head_dim * kv_heads
        self.query = nn.Linear(d_model, d_model)
        self.key = nn.Linear(d_model, kv_width, bias=False)
        self.value = nn.Linear(d_model, kv_width, bias=False)
        self.projection = nn.Linear(d_model, d_model)
        self.score = (
            nn.Parameter(torch.randn(self.head_dim) / math.sqrt(self.head_dim))
            if mode == "additive" else None
        )

    @staticmethod
    def _split(tensor: torch.Tensor, heads: int) -> torch.Tensor:
        batch, length, width = tensor.shape
        return tensor.view(batch, length, heads, width // heads).transpose(1, 2)

    @staticmethod
    def _merge(tensor: torch.Tensor) -> torch.Tensor:
        batch, heads, length, head_dim = tensor.shape
        return tensor.transpose(1, 2).reshape(batch, length, heads * head_dim)

    def _scores(self, query: torch.Tensor, key: torch.Tensor) -> torch.Tensor:
        if self.mode == "additive":
            pair = torch.tanh(query.unsqueeze(-2) + key.unsqueeze(-3))
            return (pair * self.score).sum(dim=-1) / math.sqrt(self.head_dim)
        if self.mode == "linear":
            features_q = torch.nn.functional.elu(query) + 1.0
            features_k = torch.nn.functional.elu(key) + 1.0
            return (features_q @ features_k.transpose(-1, -2)) / query.shape[2]
        return (query @ key.transpose(-1, -2)) / math.sqrt(self.head_dim)

    def forward(self, x: torch.Tensor, context: torch.Tensor | None = None) -> torch.Tensor:
        if x.ndim != 3:
            raise ValueError("Attention expects [batch, sequence, features].")
        context = x if context is None else context
        if context.ndim != 3:
            raise ValueError("Cross-attention context expects [batch, sequence, features].")
        query = self._split(self.query(x), self.num_heads)
        key = self._split(self.key(context), self.kv_heads)
        value = self._split(self.value(context), self.kv_heads)
        if self.kv_heads != self.num_heads:
            repeat = self.num_heads // self.kv_heads
            key = key.repeat_interleave(repeat, dim=1)
            value = value.repeat_interleave(repeat, dim=1)
        mask = None
        if self.causal:
            mask = torch.ones(query.shape[2], key.shape[2], dtype=torch.bool, device=x.device)
            mask = torch.triu(mask, diagonal=key.shape[2] - query.shape[2] + 1)
        if self.mode == "flash":
            # SDPA blends an additive float mask into the scores; a bool mask is applied with
            # conventions that differ across backends, so convert explicitly.
            attention_mask = None if mask is None else torch.zeros(
                mask.shape, dtype=query.dtype, device=query.device).masked_fill(mask, float("-inf"))
            attended = torch.nn.functional.scaled_dot_product_attention(
                query, key, value, attn_mask=attention_mask,
                dropout_p=self.dropout_p if self.training else 0.0,
            )
            return self.projection(self._merge(attended))
        scores = self._scores(query, key)
        if mask is not None:
            scores = scores.masked_fill(mask, 0.0 if self.mode == "linear" else float("-inf"))
        if self.mode == "linear":
            attended = (scores @ value) / scores.sum(dim=-1, keepdim=True).clamp_min(1e-6)
        else:
            weights = torch.softmax(scores, dim=-1)
            if self.training and self.dropout_p > 0:
                weights = torch.nn.functional.dropout(weights, p=self.dropout_p)
            attended = weights @ value
        return self.projection(self._merge(attended))


class _VisionTransformerBlock(nn.Module):
    """Post-norm ViT block: x + attention(LN(x)) followed by x + MLP(LN(x))."""

    def __init__(self, d_model: int, num_heads: int, mlp_ratio: float = 4.0,
                 dropout: float = 0.0, causal: bool = False):
        super().__init__()
        hidden = int(round(d_model * mlp_ratio))
        if hidden < 1:
            raise ValueError("mlp_ratio must produce a positive hidden width.")
        self.norm1 = nn.LayerNorm(d_model)
        self.attention = _ProjectedAttention(d_model, num_heads, mode="scaled-dot", causal=causal, dropout=dropout)
        self.norm2 = nn.LayerNorm(d_model)
        self.ffn = _FeedForward(d_model, hidden, dropout)
        self.dropout = nn.Dropout(dropout)

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        x = x + self.dropout(self.attention(self.norm1(x)))
        return x + self.dropout(self.ffn(self.norm2(x)))


class _TransformerEncoderStack(nn.Module):
    """Repeated transformer blocks with an optional trailing LayerNorm."""

    def __init__(self, d_model: int, num_layers: int, num_heads: int, mlp_ratio: float = 4.0,
                 dropout: float = 0.0, causal: bool = False, norm_first: bool = False,
                 final_norm: bool = True):
        super().__init__()
        if num_layers < 1:
            raise ValueError("num_layers must be a positive integer.")
        blocks = []
        for _ in range(num_layers):
            if norm_first:
                blocks.append(_PreNormTransformerBlock(d_model, num_heads, int(mlp_ratio), dropout, causal))
            else:
                blocks.append(_VisionTransformerBlock(d_model, num_heads, mlp_ratio, dropout, causal))
        self.layers = nn.Sequential(*blocks)
        self.final_norm = nn.LayerNorm(d_model) if final_norm else nn.Identity()

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        return self.final_norm(self.layers(x))


class CompiledGraph(nn.Module):
    """Compile a catalogued graph into real PyTorch modules and run it in topological order.

    Set ``shape_log`` to a dict before a forward pass to capture the executed shape of
    every node, including merges and I/O nodes.
    """
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
            elif t == "BatchNorm2d":
                modules[self.keys[n.id]] = nn.BatchNorm2d(c.get("num_features", c.get("num_channels", 16)))
            elif t == "GroupNorm":
                modules[self.keys[n.id]] = nn.GroupNorm(c.get("num_groups", 8), c.get("num_channels", 16))
            elif t == "AvgPool2d":
                modules[self.keys[n.id]] = nn.AvgPool2d(
                    c.get("kernel_size", 2), stride=c.get("stride", c.get("kernel_size", 2)),
                    padding=c.get("padding", 0),
                )
            elif t == "AdaptiveAvgPool2d":
                size = c.get("output_size", 1)
                if isinstance(size, list) and len(size) == 1:
                    size = size * 2
                modules[self.keys[n.id]] = nn.AdaptiveAvgPool2d(size)
            elif t == "PatchEmbedding":
                modules[self.keys[n.id]] = _PatchEmbedding(
                    c.get("in_channels", 3), c.get("d_model", c.get("embed_dim", 768)), c.get("patch_size", 16)
                )
            elif t == "ClassToken":
                modules[self.keys[n.id]] = _ClassToken(
                    c.get("d_model", c.get("embed_dim", 768)), c.get("num_tokens", 1)
                )
            elif t == "SelectToken":
                modules[self.keys[n.id]] = _SelectToken(c.get("index", 0), c.get("dim", -2))
            elif t == "MeanPool":
                modules[self.keys[n.id]] = _MeanPool(c.get("dim", -2))
            elif t == "VisionTransformerBlock":
                modules[self.keys[n.id]] = _VisionTransformerBlock(
                    c.get("d_model", 768), c.get("num_heads", 12), c.get("mlp_ratio", 4),
                    c.get("dropout", 0.0), c.get("causal", False),
                )
            elif t == "TransformerEncoder":
                modules[self.keys[n.id]] = _TransformerEncoderStack(
                    c.get("d_model", 768), c.get("num_layers", 12), c.get("num_heads", 12),
                    c.get("mlp_ratio", 4), c.get("dropout", 0.0), c.get("causal", False),
                    c.get("norm_first", False), c.get("final_norm", True),
                )
            elif t == "GroupedQueryAttention":
                modules[self.keys[n.id]] = _ProjectedAttention(
                    c.get("d_model", 512), c.get("num_heads", 8), c.get("num_kv_heads", 2),
                    causal=c.get("causal", True), dropout=c.get("dropout", 0.0),
                )
            elif t == "MultiQueryAttention":
                modules[self.keys[n.id]] = _ProjectedAttention(
                    c.get("d_model", 512), c.get("num_heads", 8), 1,
                    causal=c.get("causal", True), dropout=c.get("dropout", 0.0),
                )
            elif t == "CrossAttention":
                modules[self.keys[n.id]] = _ProjectedAttention(
                    c.get("d_model", 512), c.get("num_heads", 8),
                    causal=c.get("causal", False), dropout=c.get("dropout", 0.0),
                )
            elif t in {"ScaledDotProductAttention", "FlashAttention", "LinearAttention", "AdditiveAttention"}:
                modules[self.keys[n.id]] = _ProjectedAttention(
                    c.get("d_model", 512), c.get("num_heads", 8),
                    c.get("num_kv_heads"), ATTENTION_NODE_MODES[t],
                    c.get("causal", False), c.get("dropout", 0.0),
                )
            elif t == "RotaryPositionEmbedding":
                modules[self.keys[n.id]] = _RotaryPositionEmbedding(
                    c.get("d_model", 512), c.get("num_heads", 8), c.get("base", 10000.0)
                )
            elif t == "Architecture":
                try:
                    modules[self.keys[n.id]] = build_architecture(c.get("architecture"), c.get("config", {}))
                except (TypeError, ValueError) as exc:
                    raise ValueError(f"Invalid architecture config on node '{n.id}': {exc}") from exc
            else: raise ValueError(f"Node '{n.id}' ({t}) has no executor in this compiler; see its status in GET /api/v1/nodes.")
        self.modules_by_key = nn.ModuleDict(modules)
        self.port_nodes = {n.id: PORT_MODULE_INPUTS[n.type] for n in nodes if n.type in PORT_MODULE_INPUTS}
        self.incoming: dict[str, list[EdgeDef]] = defaultdict(list)
        for edge in graph.edges: self.incoming[edge.target].append(edge)
        self.shape_log: dict[str, list[int]] | None = None

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
            elif node.id in self.port_nodes:
                by_port = {PORT_ALIASES.get(e.target_port, e.target_port): values[e.source]
                           for e in self.incoming[node.id]}
                missing = [port for port in self.port_nodes[node.id] if port not in by_port]
                if missing:
                    raise ValueError(f"Node '{node.id}' ({node.type}) needs an incoming edge on port '{missing[0]}'.")
                values[node.id] = self.modules_by_key[self.keys[node.id]](by_port["input"], by_port["input_b"])
            else:
                values[node.id] = self.modules_by_key[self.keys[node.id]](edge_values[0])
        if self.shape_log is not None:
            self.shape_log.update({key: list(value.shape)
                                   for key, value in values.items() if isinstance(value, torch.Tensor)})
        outputs = [values[n.id] for n in self.graph.nodes if n.type == "Output"]
        return outputs[0] if len(outputs) == 1 else tuple(outputs)


app = FastAPI(title="ThinkNet Architecture Backend", version="0.3.0")
app.include_router(pipelines_router)
app.include_router(pipeline_jobs_router)
mount_job_endpoints()
app.include_router(training_router)
app.include_router(local_quantization_router)


def allowed_origins() -> list[str]:
    """Static dev/browser origins plus whatever the desktop shell announces.

    The Electron build serves the UI from a loopback port of its own, so it
    passes that origin through THINKNET_EXTRA_ORIGINS instead of growing this
    list on every packaging change.
    """
    origins = [
        "http://localhost:1420",
        "http://127.0.0.1:1420",
    ]
    extra = os.environ.get("THINKNET_EXTRA_ORIGINS", "")
    origins.extend(origin.strip() for origin in extra.split(",") if origin.strip())
    return origins


app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins(),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Compiled model handles are process-local; restart clears them.
MODEL_STORE: dict[str, nn.Module] = {}


class QuantizationRequest(BaseModel):
    model_id: str = Field(min_length=1, max_length=100)
    dtype: str = Field(min_length=1, max_length=20)


def _probe_tensor(node: NodeDef, consumers: list[NodeDef], batch_size: int,
                  sample: list[int] | None) -> torch.Tensor:
    """Build one deterministic CPU probe batch for an Input node.

    Token inputs (anything feeding an embedding node) get integer ids bounded by the
    smallest vocabulary in the graph; every other input gets standard normals.
    """
    dims = sample if sample is not None else node.config.get("shape", [1])
    shape = [1 if int(d) == -1 else int(d) for d in dims]
    vocab_nodes = [c for c in consumers if c.type in {"Embedding", "TokenEmbedding"}]
    if vocab_nodes:
        vocab = min(int(c.config.get("num_embeddings", c.config.get("vocab_size", 1000)))
                    for c in vocab_nodes)
        return torch.randint(0, max(vocab, 1), (batch_size, *shape))
    return torch.randn(batch_size, *shape)


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
def graph_shapes(payload: GraphDef, input_shape: list[int] | None = Query(default=None)):
    errors = validate_graph(payload)
    if errors: raise HTTPException(status_code=400, detail={"errors": errors})
    try: return infer_shapes(payload, input_shape)
    except Exception as exc: raise HTTPException(status_code=400, detail=str(exc))


@app.post("/api/v1/graphs/verify")
def verify_graph(payload: GraphDef, input_shape: list[int] | None = Query(default=None),
                 batch_size: int = Query(default=1)):
    """Prove a graph executes: compile it and run one probe batch on CPU.

    ``/graphs/infer-shapes`` only predicts shapes. This endpoint builds the model and
    actually runs it, so ``verified: true`` means the graph executes as drawn. Pass
    ``input_shape`` including the batch dimension, or just ``batch_size`` (1-64) to use
    the sample shapes configured on the Input nodes.
    """
    errors = validate_graph(payload)
    if errors:
        raise HTTPException(status_code=400, detail={"errors": errors})
    if input_shape:
        batch = min(max(int(input_shape[0]), 1), 64)
        primary_sample = list(input_shape[1:])
    else:
        batch = min(max(int(batch_size), 1), 64)
        primary_sample = None

    node_by_id = {node.id: node for node in payload.nodes}
    consumers: dict[str, list[NodeDef]] = defaultdict(list)
    for edge in payload.edges:
        target = node_by_id.get(edge.target)
        if target is not None:
            consumers[edge.source].append(target)

    torch.manual_seed(0)
    inputs = [node for node in payload.nodes if node.type == "Input"]
    probes = {
        node.id: _probe_tensor(node, consumers[node.id], batch,
                               primary_sample if index == 0 else None)
        for index, node in enumerate(inputs)
    }
    try:
        model = CompiledGraph(payload).eval()
    except Exception as exc:  # Reported, not raised: a failed build is the answer.
        return {"verified": False, "stage": "compile", "errors": [str(exc)]}
    model.shape_log = {}
    try:
        with torch.no_grad():
            outputs = model(probes[inputs[0].id],
                            extra_inputs={k: v for k, v in probes.items() if k != inputs[0].id})
    except Exception as exc:
        return {"verified": False, "stage": "execution", "errors": [str(exc)]}

    executed = model.shape_log or {}
    # Compare against the advisory preview using the real batch, but only when every Input
    # node shares a sample shape; a single preview shape cannot describe heterogeneous inputs.
    sample_shapes = {tuple(tensor.shape[1:]) for tensor in probes.values()}
    preview = infer_shapes(payload, list(next(iter(probes.values())).shape) if len(sample_shapes) == 1 else None)
    mismatches = [
        {"node": node_id, "advisory": list(predicted), "executed": list(executed[node_id])}
        for node_id, predicted in preview["shapes"].items()
        if predicted is not None and node_id in executed
        and all(dim is not None for dim in predicted) and list(predicted) != list(executed[node_id])
    ]
    statuses = {entry["type"]: entry["status"] for entry in CATALOG}
    unproven = sorted({f"{node.type}: {statuses.get(node.type, 'metadata-only')}"
                       for node in payload.nodes
                       if statuses.get(node.type) != "implemented-and-tested"})
    output_shapes = [list(o.shape) for o in outputs] if isinstance(outputs, tuple) else [list(outputs.shape)]
    return {
        "verified": True,
        "stage": "executed",
        "errors": [],
        "batch_size": batch,
        "input_shapes": {node_id: list(tensor.shape) for node_id, tensor in probes.items()},
        "output_shapes": output_shapes,
        "parameter_count": _logical_parameter_count(model),
        "node_shapes": executed,
        "advisory_mismatches": mismatches,
        "unproven_nodes": unproven,
        "note": "Executed once on CPU with a probe batch; this confirms shapes, not training accuracy.",
    }


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

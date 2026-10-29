import pytest
import torch

from services.backend.thinknet_backend_core import CompiledGraph, GraphDef, validate_graph


@pytest.mark.parametrize(
    ("node_type", "config", "sample_shape"),
    [
        ("MultiHeadAttention", {"d_model": 16, "num_heads": 4}, [5, 16]),
        ("CausalSelfAttention", {"d_model": 16, "num_heads": 4}, [5, 16]),
        ("PreNormTransformerBlock", {"d_model": 16, "num_heads": 4}, [5, 16]),
        ("MLP", {"d_model": 16, "hidden_features": 32}, [5, 16]),
        ("FeedForward", {"d_model": 16, "hidden_features": 32}, [5, 16]),
        ("SwiGLU", {"d_model": 16, "hidden_features": 32}, [5, 16]),
        ("LearnedPositionEmbedding", {"d_model": 16, "max_seq_len": 12}, [5, 16]),
        ("SinusoidalPositionEmbedding", {"d_model": 16}, [5, 16]),
        ("LayerScale", {"d_model": 16}, [5, 16]),
    ],
)
def test_new_executable_nodes_compile_and_preserve_expected_shape(node_type, config, sample_shape):
    graph = GraphDef.model_validate({
        "name": f"test-{node_type.lower()}",
        "nodes": [
            {"id": "input", "type": "Input", "config": {"shape": sample_shape}},
            {"id": "operation", "type": node_type, "config": config},
            {"id": "output", "type": "Output", "config": {}},
        ],
        "edges": [
            {"source": "input", "target": "operation"},
            {"source": "operation", "target": "output"},
        ],
    })
    assert validate_graph(graph) == []
    model = CompiledGraph(graph).eval()
    inputs = torch.randn(2, *sample_shape)
    with torch.no_grad():
        outputs = model(inputs)
    assert tuple(outputs.shape) == tuple(inputs.shape)
    assert torch.isfinite(outputs).all()


def test_attention_node_rejects_incompatible_feature_width():
    graph = GraphDef.model_validate({
        "name": "bad-attention",
        "nodes": [
            {"id": "input", "type": "Input", "config": {"shape": [5, 15]}},
            {"id": "attention", "type": "MultiHeadAttention", "config": {"d_model": 15, "num_heads": 4}},
            {"id": "output", "type": "Output", "config": {}},
        ],
        "edges": [
            {"source": "input", "target": "attention"},
            {"source": "attention", "target": "output"},
        ],
    })
    with pytest.raises(ValueError, match="divisible by num_heads"):
        CompiledGraph(graph)

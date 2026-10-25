import pytest
import torch

from backend.thinknet_backend_core import CompiledGraph, GraphDef, infer_shapes, validate_graph


def architecture_graph(sample_shape, architecture, config):
    return GraphDef.model_validate({
        "name": f"graph-{architecture}",
        "nodes": [
            {"id": "input", "type": "Input", "config": {"shape": sample_shape}},
            {"id": "model", "type": "Architecture", "config": {
                "architecture": architecture, "config": config
            }},
            {"id": "output", "type": "Output"},
        ],
        "edges": [
            {"source": "input", "target": "model"},
            {"source": "model", "target": "output"},
        ],
    })


@pytest.mark.parametrize(
    "sample_shape,architecture,config,input_factory,expected_shape",
    [
        ([12], "mlp", {"input_dim": 12, "output_dim": 4, "hidden_dims": [8]},
         lambda: torch.randn(2, 12), (2, 4)),
        ([6], "decoder_transformer_lm",
         {"vocab_size": 23, "d_model": 16, "num_layers": 1,
          "num_heads": 4, "max_seq_len": 8},
         lambda: torch.randint(0, 23, (2, 6)), (2, 6, 23)),
        ([3, 16, 16], "vit_classifier",
         {"image_size": 16, "patch_size": 4, "num_classes": 5,
          "d_model": 16, "num_layers": 1, "num_heads": 4},
         lambda: torch.randn(2, 3, 16, 16), (2, 5)),
        ([3, 16, 16], "cnn_classifier",
         {"num_classes": 5, "base_channels": 4},
         lambda: torch.randn(2, 3, 16, 16), (2, 5)),
    ],
)
def test_reference_architecture_executes_inside_graph(
    sample_shape, architecture, config, input_factory, expected_shape
):
    graph = architecture_graph(sample_shape, architecture, config)
    assert validate_graph(graph) == []
    assert infer_shapes(graph)["outputs"]["output"] == [None, *list(expected_shape[1:])]

    model = CompiledGraph(graph)
    x = input_factory()
    y = model(x)
    assert tuple(y.shape) == expected_shape

    # The architecture is an actual PyTorch module in the graph, not metadata.
    if y.is_floating_point():
        y.square().mean().backward()
        assert any(p.grad is not None for p in model.parameters())


def test_unknown_architecture_is_rejected_during_graph_validation():
    graph = architecture_graph([12], "not-a-real-model", {})
    errors = validate_graph(graph)
    assert any("config.architecture" in error for error in errors)


def test_invalid_architecture_config_has_node_context():
    graph = architecture_graph([12], "mlp", {"input_dim": 12, "output_dim": 0})
    with pytest.raises(ValueError, match="Invalid architecture config on node 'model'"):
        CompiledGraph(graph)

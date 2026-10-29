import torch

from services.backend.thinknet_backend_core import CompiledGraph, GraphDef, infer_shapes, validate_graph


def graph(nodes, edges):
    return GraphDef.model_validate({"nodes": nodes, "edges": edges})


def test_flatten_linear_softmax_pipeline_executes():
    model_graph = graph(
        [
            {"id": "input", "type": "Input", "config": {"shape": [4, 4]}},
            {"id": "flatten", "type": "Flatten", "config": {"start_dim": 1}},
            {"id": "linear", "type": "Linear", "config": {"in_features": 16, "out_features": 3}},
            {"id": "softmax", "type": "Softmax", "config": {"dim": -1}},
            {"id": "output", "type": "Output"},
        ],
        [
            {"source": "input", "target": "flatten"},
            {"source": "flatten", "target": "linear"},
            {"source": "linear", "target": "softmax"},
            {"source": "softmax", "target": "output"},
        ],
    )
    assert validate_graph(model_graph) == []
    assert infer_shapes(model_graph)["outputs"]["output"] == [None, 3]
    output = CompiledGraph(model_graph)(torch.randn(2, 4, 4))
    assert output.shape == (2, 3)
    torch.testing.assert_close(output.sum(dim=-1), torch.ones(2))


def test_concat_and_add_execute_fan_in_edges():
    model_graph = graph(
        [
            {"id": "input", "type": "Input", "config": {"shape": [4]}},
            {"id": "left", "type": "Identity"},
            {"id": "right", "type": "Identity"},
            {"id": "concat", "type": "Concat", "config": {"dim": -1}},
            {"id": "add", "type": "Add"},
            {"id": "output", "type": "Output"},
        ],
        [
            {"source": "input", "target": "left"},
            {"source": "input", "target": "right"},
            {"source": "left", "target": "concat"},
            {"source": "right", "target": "concat"},
            {"source": "left", "target": "add"},
            {"source": "right", "target": "add"},
            {"source": "add", "target": "output"},
        ],
    )
    assert validate_graph(model_graph) == []
    x = torch.randn(2, 4)
    # Both merge nodes are compiled as executable graph operations.
    model = CompiledGraph(model_graph)
    result = model(x)
    torch.testing.assert_close(result, x * 2)


def test_reshape_preserves_batch_dimension():
    model_graph = graph(
        [
            {"id": "input", "type": "Input", "config": {"shape": [2, 3]}},
            {"id": "reshape", "type": "Reshape", "config": {"shape": [6]}},
            {"id": "output", "type": "Output"},
        ],
        [
            {"source": "input", "target": "reshape"},
            {"source": "reshape", "target": "output"},
        ],
    )
    x = torch.randn(5, 2, 3)
    output = CompiledGraph(model_graph)(x)
    assert output.shape == (5, 6)

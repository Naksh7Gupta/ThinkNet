import torch

from backend.thinknet_backend_core import (
    CompiledGraph, GraphDef, CATALOG, infer_shapes, validate_graph
)


def mlp_graph():
    return GraphDef.model_validate({
        "name": "dimension-aware-mlp",
        "nodes": [
            {"id": "input", "type": "Input", "config": {"shape": [24]}},
            {"id": "projection", "type": "Linear", "config": {"in_features": 24, "out_features": 10}},
            {"id": "output", "type": "Output"},
        ],
        "edges": [
            {"source": "input", "target": "projection"},
            {"source": "projection", "target": "output"},
        ],
    })


def test_catalog_has_49_nodes():
    assert len(CATALOG) >= 45


def test_user_dimensions_are_previewed_and_enforced():
    graph = mlp_graph()
    assert validate_graph(graph) == []
    assert infer_shapes(graph)["outputs"]["output"] == [None, 10]
    assert infer_shapes(graph, [2, 24])["outputs"]["output"] == [2, 10]
    model = CompiledGraph(graph)
    assert model(torch.randn(3, 24)).shape == (3, 10)


def test_runtime_input_dimension_mismatch_is_clear():
    model = CompiledGraph(mlp_graph())
    try:
        model(torch.randn(2, 12))
    except ValueError as exc:
        assert "dimension mismatch" in str(exc)
    else:
        raise AssertionError("Expected a dimension mismatch error")


def test_cycles_are_rejected():
    graph = GraphDef.model_validate({
        "nodes": [
            {"id": "input", "type": "Input"},
            {"id": "identity", "type": "Identity"},
            {"id": "output", "type": "Output"},
        ],
        "edges": [
            {"source": "input", "target": "identity"},
            {"source": "identity", "target": "output"},
            {"source": "output", "target": "identity"},
        ],
    })
    assert any("cycle" in error.lower() for error in validate_graph(graph))

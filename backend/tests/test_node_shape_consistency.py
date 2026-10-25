import torch

from backend.thinknet_backend_core import CompiledGraph, GraphDef, infer_shapes


def test_embedding_node_shape_and_runtime_agree():
    graph = GraphDef.model_validate({
        "nodes": [
            {"id": "input", "type": "Input", "config": {"shape": [5]}},
            {"id": "embedding", "type": "Embedding", "config": {
                "num_embeddings": 32, "embedding_dim": 8
            }},
            {"id": "output", "type": "Output"},
        ],
        "edges": [
            {"source": "input", "target": "embedding"},
            {"source": "embedding", "target": "output"},
        ],
    })
    assert infer_shapes(graph)["outputs"]["output"] == [None, 5, 8]
    output = CompiledGraph(graph)(torch.randint(0, 32, (2, 5)))
    assert output.shape == (2, 5, 8)


def test_batch_norm_shape_and_runtime_agree():
    graph = GraphDef.model_validate({
        "nodes": [
            {"id": "input", "type": "Input", "config": {"shape": [8]}},
            {"id": "norm", "type": "BatchNorm1d", "config": {"num_features": 8}},
            {"id": "output", "type": "Output"},
        ],
        "edges": [
            {"source": "input", "target": "norm"},
            {"source": "norm", "target": "output"},
        ],
    })
    assert infer_shapes(graph)["outputs"]["output"] == [None, 8]
    output = CompiledGraph(graph)(torch.randn(4, 8))
    assert output.shape == (4, 8)

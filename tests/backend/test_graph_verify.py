"""``POST /api/v1/graphs/verify`` must prove execution, not predict it."""
from fastapi.testclient import TestClient

from services.backend.thinknet_backend_core import app
from test_attention_variants import attention_graph, cross_attention_graph
from test_cnn_components import cnn_graph
from test_vit_components import vit_graph

URL = "/api/v1/graphs/verify"


def report_for(client, graph, **params):
    response = client.post(URL, json=graph, params=params)
    assert response.status_code == 200, response.text
    return response.json()


def test_verify_proves_a_cnn_built_from_primitives():
    client = TestClient(app)
    graph = cnn_graph("adaptive")
    report = report_for(client, graph.model_dump(), batch_size=2)
    assert report["verified"] is True
    assert report["stage"] == "executed"
    assert report["errors"] == []
    assert report["batch_size"] == 2
    assert report["input_shapes"] == {"input": [2, 3, 32, 32]}
    assert report["output_shapes"] == [[2, 10]]
    assert report["parameter_count"] > 0
    assert report["unproven_nodes"] == []
    assert report["advisory_mismatches"] == []
    assert set(report["node_shapes"]) == {node.id for node in graph.nodes}
    assert report["node_shapes"]["pool"] == [2, 16, 1, 1]


def test_verify_proves_a_vit_built_from_primitives():
    client = TestClient(app)
    report = report_for(client, vit_graph().model_dump())
    assert report["verified"] is True and report["stage"] == "executed"
    assert report["output_shapes"] == [[1, 10]]
    assert report["node_shapes"]["cls"] == [1, 17, 16]
    assert report["node_shapes"]["readout"] == [1, 16]
    assert report["advisory_mismatches"] == []
    assert report["unproven_nodes"] == []


def test_verify_is_deterministic_for_the_same_graph():
    client = TestClient(app)
    graph = vit_graph().model_dump()
    first = report_for(client, graph)
    second = report_for(client, graph)
    assert first["node_shapes"] == second["node_shapes"]
    assert first["parameter_count"] == second["parameter_count"]


def test_verify_honours_an_explicit_input_shape():
    client = TestClient(app)
    report = report_for(client, cnn_graph("global").model_dump(), input_shape=[4, 3, 32, 32])
    assert report["verified"] is True
    assert report["batch_size"] == 4
    assert report["input_shapes"] == {"input": [4, 3, 32, 32]}
    assert report["output_shapes"] == [[4, 10]]


def test_verify_handles_two_input_graphs():
    client = TestClient(app)
    report = report_for(client, cross_attention_graph().model_dump(), batch_size=3)
    assert report["verified"] is True
    assert report["input_shapes"] == {"query": [3, 6], "source": [3, 6]}
    assert report["output_shapes"] == [[3, 6, 40]]
    assert report["advisory_mismatches"] == []


def test_verify_reports_nodes_that_are_not_fully_tested():
    client = TestClient(app)
    report = report_for(client, attention_graph("FlashAttention").model_dump())
    assert report["verified"] is True
    assert report["unproven_nodes"] == ["FlashAttention: partial"]


def test_verify_rejects_structural_errors_with_400():
    client = TestClient(app)
    graph = cnn_graph("adaptive").model_dump()
    graph["edges"][0]["target"] = "missing-node"
    response = client.post(URL, json=graph)
    assert response.status_code == 400
    assert response.json()["detail"]["errors"]


def test_verify_reports_a_module_that_cannot_be_built():
    client = TestClient(app)
    graph = {
        "name": "unbuildable",
        "nodes": [
            {"id": "input", "type": "Input", "config": {"shape": [8]}},
            {"id": "body", "type": "Architecture",
             "config": {"architecture": "decoder_transformer_lm",
                        "config": {"vocab_size": 40, "d_model": 65, "num_heads": 4}}},
            {"id": "output", "type": "Output"},
        ],
        "edges": [{"source": "input", "target": "body"}, {"source": "body", "target": "output"}],
    }
    report = report_for(client, graph)
    assert report["verified"] is False
    assert report["stage"] == "compile"
    assert "divisible" in report["errors"][0]


def test_verify_reports_a_runtime_failure():
    """Channel mismatches are invisible to validation and shape inference, but not to a run."""
    client = TestClient(app)
    graph = {
        "name": "bad-channels",
        "nodes": [
            {"id": "input", "type": "Input", "config": {"shape": [3, 8, 8]}},
            {"id": "conv", "type": "Conv2d",
             "config": {"in_channels": 4, "out_channels": 2, "kernel_size": 1}},
            {"id": "output", "type": "Output"},
        ],
        "edges": [{"source": "input", "target": "conv"}, {"source": "conv", "target": "output"}],
    }
    report = report_for(client, graph)
    assert report["verified"] is False
    assert report["stage"] == "execution"
    assert "4 channels" in report["errors"][0]


def test_shape_preview_points_at_the_verify_endpoint():
    client = TestClient(app)
    response = client.post("/api/v1/graphs/infer-shapes", json=cnn_graph("adaptive").model_dump())
    assert "/api/v1/graphs/verify" in response.json()["note"]

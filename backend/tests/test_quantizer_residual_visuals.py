import torch
import pytest
from fastapi.testclient import TestClient
from torch import nn

from backend.thinknet_backend_core import (
    CATALOG, MODEL_STORE, CompiledGraph, GraphDef, app, infer_shapes, validate_graph,
)
from backend.thinknet_quantization import QuantizerNode, SUPPORTED_DTYPES, quantization_report


def make_graph(nodes, edges):
    return GraphDef.model_validate({"nodes": nodes, "edges": edges})


def test_quantizer_float16_returns_new_model_and_preserves_source():
    source = nn.Sequential(nn.Linear(4, 3), nn.GELU()).eval()
    result = QuantizerNode("float16")(source)

    assert result is not source
    assert next(result.parameters()).dtype == torch.float16
    assert next(source.parameters()).dtype == torch.float32
    output = result(torch.randn(2, 4, dtype=torch.float16))
    assert output.shape == (2, 3)


def test_quantizer_int8_dynamically_quantizes_linear_and_runs():
    source = nn.Sequential(nn.Linear(4, 3), nn.ReLU(), nn.Linear(3, 2)).eval()
    result = QuantizerNode("int8")(source)

    assert result is not source
    dynamic_linears = [
        module for module in result.modules()
        if "quantized.dynamic" in type(module).__module__.lower()
        and "linear" in type(module).__module__.lower()
    ]
    assert dynamic_linears
    assert quantization_report(result, "int8")["dynamic_int8_linear_modules"] == len(dynamic_linears)
    assert result(torch.randn(2, 4)).shape == (2, 2)
    assert sum(type(module) is nn.Linear for module in source.modules()) == 2
    assert sum(type(module) is nn.Linear for module in result.modules()) == 0


def test_quantizer_validates_dtype_and_model_input():
    with pytest.raises(ValueError, match="Unsupported dtype"):
        QuantizerNode("fp8")
    with pytest.raises(TypeError, match="torch.nn.Module"):
        QuantizerNode("int8")(object())


def test_node_catalog_has_visual_style_for_every_node():
    by_type = {node["type"]: node for node in CATALOG}
    assert len(by_type) == len(CATALOG)
    for node in CATALOG:
        assert node["size"] in {"small", "medium", "large"}
        assert isinstance(node["width"], int) and node["width"] > 0
        assert isinstance(node["height"], int) and node["height"] > 0
        assert len(node["color"]) == 7 and node["color"].startswith("#")

    assert by_type["Quantizer"]["size"] == "large"
    assert by_type["Quantizer"]["width"] > by_type["Linear"]["width"]
    assert by_type["Quantizer"]["height"] > by_type["LMHead"]["height"]
    assert by_type["LMHead"]["size"] == "small"
    assert by_type["Quantizer"]["execution_domain"] == "model-transform"
    assert by_type["Quantizer"]["input_kind"] == "model"
    assert by_type["Quantizer"]["output_kind"] == "quantized-model"
    assert {option["value"] for option in by_type["Quantizer"]["config_fields"][0]["options"]} == set(SUPPORTED_DTYPES)


def test_lm_head_compiles_and_infers_vocabulary_dimension():
    graph = make_graph(
        [
            {"id": "input", "type": "Input", "config": {"shape": [8]}},
            {"id": "head", "type": "LMHead", "config": {"d_model": 8, "vocab_size": 19}},
            {"id": "output", "type": "Output"},
        ],
        [
            {"source": "input", "target": "head"},
            {"source": "head", "target": "output"},
        ],
    )
    assert validate_graph(graph) == []
    assert infer_shapes(graph)["outputs"]["output"] == [None, 19]
    assert CompiledGraph(graph)(torch.randn(2, 8)).shape == (2, 19)


def test_residual_add_executes_skip_connection_with_gradients():
    graph = make_graph(
        [
            {"id": "input", "type": "Input", "config": {"shape": [4]}},
            {"id": "linear1", "type": "Linear", "config": {"in_features": 4, "out_features": 4}},
            {"id": "activation", "type": "GELU"},
            {"id": "linear2", "type": "Linear", "config": {"in_features": 4, "out_features": 4}},
            {"id": "residual", "type": "ResidualAdd"},
            {"id": "output", "type": "Output"},
        ],
        [
            {"source": "input", "target": "linear1"},
            {"source": "linear1", "target": "activation"},
            {"source": "activation", "target": "linear2"},
            {"source": "linear2", "target": "residual"},
            {"source": "input", "target": "residual"},
            {"source": "residual", "target": "output"},
        ],
    )
    assert validate_graph(graph) == []
    assert infer_shapes(graph)["outputs"]["output"] == [None, 4]
    model = CompiledGraph(graph)
    x = torch.randn(3, 4)
    with torch.no_grad():
        hidden = model.modules_by_key[model.keys["linear1"]](x)
        hidden = model.modules_by_key[model.keys["activation"]](hidden)
        main_branch = model.modules_by_key[model.keys["linear2"]](hidden)
        expected = main_branch + x
    output = model(x)
    assert output.shape == (3, 4)
    torch.testing.assert_close(output, expected)
    output.square().mean().backward()
    assert all(module.weight.grad is not None for module in model.modules() if isinstance(module, nn.Linear))


def test_quantize_api_returns_distinct_model_handle():
    client = TestClient(app)
    payload = {
        "name": "quantizer-api-test",
        "nodes": [
            {"id": "input", "type": "Input", "config": {"shape": [4]}},
            {"id": "projection", "type": "Linear", "config": {"in_features": 4, "out_features": 3}},
            {"id": "output", "type": "Output"},
        ],
        "edges": [
            {"source": "input", "target": "projection"},
            {"source": "projection", "target": "output"},
        ],
    }
    compiled = client.post("/api/v1/models/compile", json=payload)
    assert compiled.status_code == 200
    source_id = compiled.json()["model_id"]
    source = MODEL_STORE[source_id]

    response = client.post(
        "/api/v1/models/quantize",
        json={"model_id": source_id, "dtype": "int8"},
    )
    assert response.status_code == 200, response.text
    data = response.json()
    assert data["quantized"] is True
    assert data["model_id"] != source_id
    assert data["source_model_id"] == source_id
    assert data["report"]["dynamic_int8_linear_modules"] >= 1
    assert data["parameter_count"] == compiled.json()["parameter_count"]
    assert MODEL_STORE[source_id] is source

    assert client.get(f"/api/v1/models/{data['model_id']}").status_code == 200
    assert client.delete(f"/api/v1/models/{data['model_id']}").json()["deleted"] is True
    assert client.delete(f"/api/v1/models/{source_id}").json()["deleted"] is True


def test_quantize_api_rejects_unknown_dtype_and_missing_model():
    client = TestClient(app)
    missing = client.post(
        "/api/v1/models/quantize",
        json={"model_id": "missing-model", "dtype": "int8"},
    )
    assert missing.status_code == 404
    invalid = client.post(
        "/api/v1/models/quantize",
        json={"model_id": "missing-model", "dtype": "fp8"},
    )
    assert invalid.status_code == 400
    assert "Unsupported dtype" in invalid.json()["detail"]

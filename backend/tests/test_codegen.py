import ast
import json

import torch
from fastapi.testclient import TestClient

from backend.thinknet_backend_core import app


def simple_graph():
    return {
        "name": "exportable-mlp",
        "nodes": [
            {"id": "input", "type": "Input", "config": {"shape": [4]}},
            {"id": "linear", "type": "Linear", "config": {"in_features": 4, "out_features": 3}},
            {"id": "activation", "type": "GELU"},
            {"id": "output", "type": "Output"},
        ],
        "edges": [
            {"source": "input", "target": "linear"},
            {"source": "linear", "target": "activation"},
            {"source": "activation", "target": "output"},
        ],
    }


def test_codegen_returns_valid_reusable_python_source():
    client = TestClient(app)
    response = client.post("/api/v1/models/export", json=simple_graph())
    assert response.status_code == 200, response.text
    payload = response.json()
    assert payload["exported"] is True
    assert payload["filename"] == "exported_model.py"
    source = payload["python_source"]
    ast.parse(source)
    assert "class GeneratedThinkNetModel(nn.Module)" in source
    assert "GRAPH_SPEC = json.loads(" in source
    assert "CompiledGraph(graph)" in source


def test_codegen_rejects_invalid_or_non_executable_graphs():
    client = TestClient(app)
    invalid = simple_graph()
    invalid["edges"][0]["target"] = "missing-node"
    response = client.post("/api/v1/models/export", json=invalid)
    assert response.status_code == 400

    metadata_only = simple_graph()
    metadata_only["nodes"][1] = {"id": "unsupported", "type": "FlashAttention", "config": {}}
    metadata_only["edges"][0]["target"] = "unsupported"
    metadata_only["edges"][1]["source"] = "unsupported"
    response = client.post("/api/v1/models/export", json=metadata_only)
    assert response.status_code == 400


def test_codegen_embeds_graph_spec_as_json_string():
    client = TestClient(app)
    response = client.post("/api/v1/models/export", json=simple_graph())
    assert response.status_code == 200
    source = response.json()["python_source"]
    # Ensure the encoded graph is valid JSON data, not interpolated Python code.
    marker = "GRAPH_SPEC = json.loads("
    start = source.index(marker) + len(marker)
    end = source.index(")\n", start)
    encoded_literal = source[start:end]
    import ast
    serialized = ast.literal_eval(encoded_literal)
    parsed = json.loads(serialized)
    assert parsed["name"] == "exportable-mlp"


def test_exported_source_executes_and_builds_a_working_model():
    client = TestClient(app)
    response = client.post("/api/v1/models/export", json=simple_graph())
    assert response.status_code == 200, response.text
    source = response.json()["python_source"]
    namespace = {"__name__": "thinknet_export_runtime_test"}
    exec(compile(source, "exported_model.py", "exec"), namespace)
    model = namespace["build_model"]().eval()
    with torch.no_grad():
        output = model(torch.randn(2, 4))
    assert tuple(output.shape) == (2, 3)

import json
from fastapi.testclient import TestClient

from services.backend.thinknet_backend_core import app
from services.backend.thinknet_training import TrainingSettings, build_training_notebook


def lm_graph():
    return {
        "name": "tiny-text-model",
        "nodes": [
            {"id": "tokens", "type": "Input", "config": {"shape": [8]}},
            {"id": "model", "type": "Architecture", "config": {
                "architecture": "decoder_transformer_lm",
                "config": {"vocab_size": 50257, "d_model": 16, "num_layers": 1,
                           "num_heads": 4, "max_seq_len": 8}
            }},
            {"id": "output", "type": "Output", "config": {}}
        ],
        "edges": [
            {"source": "tokens", "target": "model"},
            {"source": "model", "target": "output"}
        ]
    }


def test_training_settings_validate_user_controls():
    settings = TrainingSettings(learning_rate=1e-4, max_steps=20,
                                 log_every_steps=5, save_every_steps=10)
    assert settings.learning_rate == 1e-4
    assert settings.log_every_steps == 5


def test_training_settings_reject_invalid_intervals():
    try:
        TrainingSettings(max_steps=5, log_every_steps=10)
    except Exception as exc:
        assert "cannot exceed max_steps" in str(exc)
    else:
        raise AssertionError("Expected invalid log interval to be rejected")


def test_notebook_has_configurable_training_and_artifact_cells():
    notebook = build_training_notebook(lm_graph(), TrainingSettings())
    assert notebook["nbformat"] == 4
    source = "\n".join("".join(cell["source"]) for cell in notebook["cells"])
    assert "learning_rate" in source
    assert "save_every_steps" in source
    assert "AdamW" in source
    assert "checkpoint-" in source
    assert "model_state_dict.pt" in source
    json.dumps(notebook)


def test_training_notebook_endpoint_validates_and_returns_ipynb_json():
    response = TestClient(app).post(
        "/api/v1/training/notebook",
        json={"graph": lm_graph(), "training": {
            "learning_rate": 0.0002, "batch_size": 2, "sequence_length": 8,
            "max_steps": 20, "log_every_steps": 5, "save_every_steps": 10
        }}
    )
    assert response.status_code == 200, response.text
    payload = response.json()
    assert payload["generated"] is True
    assert payload["filename"].endswith("_training.ipynb")
    assert payload["notebook"]["nbformat"] == 4
    assert payload["training"]["learning_rate"] == 0.0002


def test_training_notebook_endpoint_rejects_invalid_graph():
    response = TestClient(app).post(
        "/api/v1/training/notebook",
        json={"graph": {"name": "bad", "nodes": [], "edges": []}}
    )
    assert response.status_code == 400

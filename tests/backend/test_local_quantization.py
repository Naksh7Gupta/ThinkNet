import time

import pytest
import torch
from fastapi.testclient import TestClient

transformers = pytest.importorskip("transformers")
pytest.importorskip("safetensors")

from services.backend import thinknet_local_quantization as local_quantization
from services.backend.thinknet_backend_core import app


@pytest.fixture
def tiny_local_model(tmp_path):
    source = tmp_path / "source-model"
    source.mkdir()
    config = transformers.BertConfig(
        vocab_size=32,
        hidden_size=16,
        num_hidden_layers=1,
        num_attention_heads=2,
        intermediate_size=24,
    )
    transformers.BertModel(config).save_pretrained(source, safe_serialization=True)
    return source


def test_inspect_local_model_reports_hugging_face_checkpoint(tiny_local_model):
    result = local_quantization.inspect_local_model(str(tiny_local_model))

    assert result["format"] == "Hugging Face safetensors"
    assert result["architecture"] == "BertModel"
    assert result["parameter_count"] > 0
    assert result["size_bytes"] >= result["weight_bytes"]
    assert result["dtype_counts"]["F32"] == result["parameter_count"]


def test_quantize_local_model_writes_validated_fp16_without_changing_source(
    tiny_local_model, tmp_path
):
    output_parent = tmp_path / "output"
    output_parent.mkdir()
    source_weights = (tiny_local_model / "model.safetensors").read_bytes()
    model_info = local_quantization.inspect_local_model(str(tiny_local_model))

    result = local_quantization.quantize_local_model(
        str(tiny_local_model), str(output_parent), "converted-fp16", "float16"
    )

    output = output_parent / "converted-fp16"
    assert result["validation_status"] == "passed"
    assert result["parameter_count"] == model_info["parameter_count"]
    assert result["size_reduction_bytes"] > 0
    assert result["size_reduction_percent"] > 0
    assert result["output_size_bytes"] == sum(path.stat().st_size for path in output.rglob("*") if path.is_file())
    assert (tiny_local_model / "model.safetensors").read_bytes() == source_weights

    converted = transformers.AutoModel.from_pretrained(
        output, local_files_only=True, use_safetensors=True, trust_remote_code=False
    )
    assert str(next(converted.parameters()).dtype) == "torch.float16"


def test_local_model_inspection_rejects_pickle_checkpoint(tmp_path):
    model_dir = tmp_path / "unsafe"
    model_dir.mkdir()
    (model_dir / "config.json").write_text('{"model_type":"bert"}', encoding="utf-8")
    (model_dir / "pytorch_model.bin").write_bytes(b"not loaded")

    with pytest.raises(local_quantization.LocalModelError, match="Legacy pickle"):
        local_quantization.inspect_local_model(str(model_dir))


@pytest.mark.parametrize("suffix", [".pt", ".pth", ".bin", ".ckpt"])
def test_inspect_local_model_accepts_tensor_only_pytorch_checkpoint(tmp_path, suffix):
    model_dir = tmp_path / "pytorch-model"
    model_dir.mkdir()
    model = transformers.BertModel(
        transformers.BertConfig(
            vocab_size=32,
            hidden_size=16,
            num_hidden_layers=1,
            num_attention_heads=2,
            intermediate_size=24,
        )
    )
    model.config.architectures = ["BertModel"]
    model.config.save_pretrained(model_dir)
    checkpoint = model_dir / f"weights{suffix}"
    torch.save({"state_dict": model.state_dict()}, checkpoint)

    result = local_quantization.inspect_local_model(str(checkpoint))

    assert result["format"] == "PyTorch state dictionary"
    assert result["architecture"] == "BertModel"
    assert result["parameter_count"] > 0
    assert result["size_bytes"] >= checkpoint.stat().st_size
    assert result["dtype_counts"]["F32"] > 0


def test_quantize_selected_pytorch_checkpoint_to_validated_safetensors(tmp_path):
    model_dir = tmp_path / "pytorch-model"
    model_dir.mkdir()
    output_parent = tmp_path / "output"
    output_parent.mkdir()
    model = transformers.BertModel(
        transformers.BertConfig(
            vocab_size=32,
            hidden_size=16,
            num_hidden_layers=1,
            num_attention_heads=2,
            intermediate_size=24,
        )
    )
    model.config.architectures = ["BertModel"]
    model.config.save_pretrained(model_dir)
    checkpoint = model_dir / "weights.pth"
    torch.save(model.state_dict(), checkpoint)

    result = local_quantization.quantize_local_model(
        str(checkpoint), str(output_parent), "converted-pytorch", "float16"
    )

    assert result["validation_status"] == "passed"
    assert result["format"] == "Hugging Face safetensors"
    converted = transformers.AutoModel.from_pretrained(
        output_parent / "converted-pytorch",
        local_files_only=True,
        use_safetensors=True,
        trust_remote_code=False,
    )
    assert str(next(converted.parameters()).dtype) == "torch.float16"
    assert checkpoint.is_file()


def test_quantize_selected_safetensors_checkpoint(tmp_path):
    source = tmp_path / "safetensors-model"
    source.mkdir()
    output_parent = tmp_path / "output"
    output_parent.mkdir()
    model = transformers.BertModel(
        transformers.BertConfig(
            vocab_size=32,
            hidden_size=16,
            num_hidden_layers=1,
            num_attention_heads=2,
            intermediate_size=24,
        )
    )
    model.config.architectures = ["BertModel"]
    model.save_pretrained(source, safe_serialization=True)
    checkpoint = source / "model.safetensors"

    result = local_quantization.quantize_local_model(
        str(checkpoint), str(output_parent), "converted-safetensors", "bfloat16"
    )

    assert result["validation_status"] == "passed"
    assert checkpoint.is_file()
    converted = transformers.AutoModel.from_pretrained(
        output_parent / "converted-safetensors",
        local_files_only=True,
        use_safetensors=True,
        trust_remote_code=False,
    )
    assert str(next(converted.parameters()).dtype) == "torch.bfloat16"


def test_local_model_inspection_rejects_non_tensor_pytorch_checkpoint(tmp_path):
    model_dir = tmp_path / "invalid"
    model_dir.mkdir()
    config = transformers.BertConfig()
    config.save_pretrained(model_dir)
    torch.save({"optimizer": {"step": 3}}, model_dir / "pytorch_model.bin")

    with pytest.raises(local_quantization.LocalModelError, match="plain tensor state dictionary"):
        local_quantization.inspect_local_model(str(model_dir))


def test_local_model_inspection_never_unpickles_model_objects(tmp_path):
    model_dir = tmp_path / "pickled-model"
    model_dir.mkdir()
    transformers.BertConfig().save_pretrained(model_dir)
    torch.save(torch.nn.Linear(2, 2), model_dir / "pytorch_model.bin")

    with pytest.raises(local_quantization.LocalModelError, match="Could not safely read"):
        local_quantization.inspect_local_model(str(model_dir))


def test_quantization_preflight_rejects_overlapping_output_and_low_memory(
    tiny_local_model, tmp_path, monkeypatch
):
    info = local_quantization.inspect_local_model(str(tiny_local_model))
    with pytest.raises(local_quantization.LocalModelError, match="must not overlap"):
        local_quantization._validate_output(
            tiny_local_model,
            info,
            str(tiny_local_model),
            "nested-output",
            "float16",
        )

    output_parent = tmp_path / "low-memory-output"
    output_parent.mkdir()
    monkeypatch.setattr(local_quantization, "available_system_memory_bytes", lambda: 1)
    with pytest.raises(local_quantization.LocalModelError, match="Insufficient available RAM"):
        local_quantization._validate_output(
            tiny_local_model,
            info,
            str(output_parent),
            "converted",
            "float16",
        )


def test_quantization_preflight_rejects_invalid_windows_output_names(tiny_local_model, tmp_path):
    output_parent = tmp_path / "output"
    output_parent.mkdir()
    info = local_quantization.inspect_local_model(str(tiny_local_model))

    for output_name in ("CON", "model.", "nested\\folder"):
        with pytest.raises(local_quantization.LocalModelError, match="single valid folder name"):
            local_quantization._validate_output(
                tiny_local_model, info, str(output_parent), output_name, "bfloat16"
            )


def test_inspect_endpoint_returns_clear_format_error(tmp_path):
    client = TestClient(app)
    response = client.post(
        "/api/v1/local-models/inspect",
        json={"model_path": str(tmp_path)},
    )

    assert response.status_code == 400
    assert "config.json" in response.json()["detail"]


def test_quantization_job_api_reports_real_completion(tiny_local_model, tmp_path):
    output_parent = tmp_path / "output"
    output_parent.mkdir()
    client = TestClient(app)
    started = client.post(
        "/api/v1/local-models/quantization-jobs",
        json={
            "model_path": str(tiny_local_model),
            "output_directory": str(output_parent),
            "output_name": "job-output",
            "dtype": "bfloat16",
        },
    )
    assert started.status_code == 200, started.text
    job_id = started.json()["job_id"]

    deadline = time.monotonic() + 30
    while time.monotonic() < deadline:
        status = client.get(f"/api/v1/local-models/quantization-jobs/{job_id}")
        assert status.status_code == 200
        data = status.json()
        if data["status"] in {"completed", "failed"}:
            break
        time.sleep(0.1)

    assert data["status"] == "completed", data["error"]
    assert data["progress"] == 100
    assert data["result"]["validation_status"] == "passed"
    assert (output_parent / "job-output" / "model.safetensors").is_file()


def test_quantization_rejects_existing_output_without_overwriting(tiny_local_model, tmp_path):
    output_parent = tmp_path / "output"
    output_parent.mkdir()
    target = output_parent / "existing-model"
    target.mkdir()
    sentinel = target / "keep.txt"
    sentinel.write_text("unchanged", encoding="utf-8")
    info = local_quantization.inspect_local_model(str(tiny_local_model))

    with pytest.raises(local_quantization.LocalModelError, match="will not be overwritten"):
        local_quantization._validate_output(
            tiny_local_model, info, str(output_parent), "existing-model", "bfloat16"
        )
    assert sentinel.read_text(encoding="utf-8") == "unchanged"

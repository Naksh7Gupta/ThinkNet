from __future__ import annotations

import csv

import pytest

from services.backend import thinknet_pipelines as pipelines


@pytest.fixture
def artifact_root(tmp_path, monkeypatch):
    monkeypatch.setattr(pipelines, "ARTIFACT_ROOT", tmp_path)
    return tmp_path


def write_csv(path, rows):
    with path.open("w", newline="", encoding="utf-8") as stream:
        writer = csv.DictWriter(stream, fieldnames=list(rows[0]))
        writer.writeheader()
        writer.writerows(rows)


def test_catalog_exposes_core_pipeline_components():
    names = {item["type"] for item in pipelines.component_catalog()}
    assert {
        "csv.load",
        "text.load",
        "image.folder",
        "audio.wav_folder",
        "dataset.inspect",
        "dataset.select_xy",
        "dataset.split_xy",
        "model.build_graph",
        "model.import_weights",
        "model.train_classifier",
        "model.evaluate_classifier",
        "model.infer",
        "model.save",
        "model.load",
        "mnist.load",
        "mnist.train",
        "mnist.evaluate",
        "mnist.predict",
        "python.custom",
        "multimodal.join",
        "llm.train_causal",
        "llm.generate",
        "text.tfidf_split",
        "torch.fit",
        "torch.evaluate",
        "torch.predict",
    } <= names


def test_graph_validation_rejects_cycles():
    graph = pipelines.PipelineGraph(
        nodes=[
            {"id": "a", "type": "dataset.inspect"},
            {"id": "b", "type": "dataset.inspect"},
        ],
        edges=[
            {"source": "a", "target": "b"},
            {"source": "b", "target": "a"},
        ],
    )
    result = pipelines.validate_pipeline(graph)
    assert result["valid"] is False
    assert "cycle" in result["errors"][0].lower()


def test_xy_split_keeps_features_and_targets_aligned(tmp_path, artifact_root):
    source = tmp_path / "rows.csv"
    write_csv(source, [{"feature": str(i), "label": f"label-{i}"} for i in range(20)])
    graph = pipelines.PipelineGraph(
        name="paired-data",
        nodes=[
            {"id": "load", "type": "csv.load", "config": {"path": str(source)}},
            {"id": "xy", "type": "dataset.select_xy",
             "config": {"feature_columns": ["feature"], "target_column": "label"}},
            {"id": "split", "type": "dataset.split_xy",
             "config": {"validation_fraction": 0.2, "test_fraction": 0.1}},
        ],
        edges=[
            {"source": "load", "target": "xy", "source_port": "dataset", "target_port": "dataset"},
            {"source": "xy", "target": "split", "source_port": "X", "target_port": "X"},
            {"source": "xy", "target": "split", "source_port": "Y", "target_port": "Y"},
        ],
    )
    result = pipelines.execute_pipeline(graph, seed=7)
    assert result["status"] == "completed"
    outputs = result["outputs"]["split"]
    assert outputs["metadata"]["counts"] == {"train": 14, "validation": 4, "test": 2}
    for split in ("train", "validation", "test"):
        x_rows, _ = pipelines._read_csv(outputs[f"X_{split}"])
        y_rows, _ = pipelines._read_csv(outputs[f"Y_{split}"])
        assert len(x_rows) == len(y_rows)
        assert all(y["label"] == f"label-{x['feature']}" for x, y in zip(x_rows, y_rows))


def test_unlabeled_split_does_not_require_y(tmp_path, artifact_root):
    source = tmp_path / "features.csv"
    write_csv(source, [{"a": str(i), "b": str(i + 1)} for i in range(10)])
    graph = pipelines.PipelineGraph(
        nodes=[
            {"id": "load", "type": "csv.load", "config": {"path": str(source)}},
            {"id": "xy", "type": "dataset.select_xy", "config": {"feature_columns": ["a", "b"]}},
            {"id": "split", "type": "dataset.split_xy", "config": {"validation_fraction": 0.2}},
        ],
        edges=[
            {"source": "load", "target": "xy", "source_port": "dataset", "target_port": "dataset"},
            {"source": "xy", "target": "split", "source_port": "X", "target_port": "X"},
        ],
    )
    result = pipelines.execute_pipeline(graph)
    assert result["status"] == "completed"
    assert result["outputs"]["split"]["metadata"]["has_targets"] is False
    assert "Y_train" not in result["outputs"]["split"]


def test_select_xy_rejects_unknown_columns(tmp_path, artifact_root):
    source = tmp_path / "rows.csv"
    write_csv(source, [{"known": "value"}])
    dataset = pipelines._load_csv({"path": str(source)}, {}, {})["dataset"]
    with pytest.raises(ValueError, match="Unknown CSV column"):
        pipelines._select_xy({"feature_columns": ["missing"]}, {"dataset": dataset}, {})


def test_pipeline_failure_is_reported_at_node(tmp_path, artifact_root):
    source = tmp_path / "empty.csv"
    source.write_text("a,b\n", encoding="utf-8")
    graph = pipelines.PipelineGraph(
        nodes=[{"id": "load", "type": "csv.load", "config": {"path": str(source)}}]
    )
    result = pipelines.execute_pipeline(graph)
    assert result["status"] == "failed"
    assert result["nodes"][0]["status"] == "failed"
    assert "no data rows" in result["error"].lower()


def test_missing_required_input_is_rejected():
    graph = pipelines.PipelineGraph(
        nodes=[{"id": "inspect", "type": "dataset.inspect"}]
    )
    result = pipelines.validate_pipeline(graph)
    assert result["valid"] is False
    assert "dataset" in result["errors"][0]


def test_graph_rejects_incompatible_port_types():
    graph = pipelines.PipelineGraph(
        nodes=[
            {"id": "load", "type": "csv.load"},
            {"id": "inspect_a", "type": "dataset.inspect"},
            {"id": "inspect_b", "type": "dataset.inspect"},
        ],
        edges=[
            {"source": "load", "target": "inspect_a", "source_port": "dataset", "target_port": "dataset"},
            {"source": "inspect_a", "target": "inspect_b", "source_port": "report", "target_port": "dataset"},
        ],
    )
    result = pipelines.validate_pipeline(graph)
    assert result["valid"] is False
    assert "incompatible connection" in result["errors"][0].lower()


def test_split_rejects_misaligned_xy(artifact_root):
    x_ref = pipelines._write_csv([{"x": "1"}, {"x": "2"}], ["x"])
    y_ref = pipelines._write_csv([{"y": "1"}], ["y"])
    with pytest.raises(ValueError, match="row counts differ"):
        pipelines._split_xy({}, {"X": x_ref, "Y": y_ref}, {"seed": 1})


def test_text_loader_creates_document_dataset(tmp_path, artifact_root):
    source = tmp_path / "notes.txt"
    source.write_text("first sentence\n\nsecond sentence", encoding="utf-8")
    result = pipelines._load_text({"path": str(source)}, {}, {})
    rows, columns = pipelines._read_csv(result["dataset"])
    assert columns == ["text", "label"]
    assert [row["text"] for row in rows] == ["first sentence", "second sentence"]
    assert result["metadata"]["modality"] == "text"


def test_image_folder_loader_uses_class_subfolders(tmp_path, artifact_root):
    class_dir = tmp_path / "cats"
    class_dir.mkdir()
    (class_dir / "one.png").write_bytes(b"image-placeholder")
    result = pipelines._load_image_folder({"path": str(tmp_path)}, {}, {})
    rows, _ = pipelines._read_csv(result["dataset"])
    assert rows[0]["label"] == "cats"
    assert rows[0]["path"].endswith("one.png")


def test_audio_loader_reads_wav_metadata(tmp_path, artifact_root):
    import wave
    import struct

    class_dir = tmp_path / "beeps"
    class_dir.mkdir()
    path = class_dir / "tone.wav"
    with wave.open(str(path), "wb") as audio:
        audio.setnchannels(1)
        audio.setsampwidth(2)
        audio.setframerate(8000)
        audio.writeframes(struct.pack("<h", 0) * 8000)
    result = pipelines._load_audio_folder({"path": str(tmp_path)}, {}, {})
    rows, _ = pipelines._read_csv(result["dataset"])
    assert rows[0]["label"] == "beeps"
    assert float(rows[0]["duration_seconds"]) == 1.0


def test_project_save_load_and_delete(tmp_path, monkeypatch):
    monkeypatch.setattr(pipelines, "PROJECT_ROOT", tmp_path)
    graph = pipelines.PipelineGraph(
        name="saved",
        nodes=[{"id": "load", "type": "csv.load", "config": {"path": "data.csv"}}],
    )
    project = pipelines.PipelineProject(project_id="demo", name="Demo", graph=graph)
    saved = pipelines.save_pipeline_project("demo", project)
    assert saved["project_id"] == "demo"
    assert pipelines.get_pipeline_project("demo")["name"] == "Demo"
    assert pipelines.list_pipeline_projects()["projects"][0]["project_id"] == "demo"
    assert pipelines.delete_pipeline_project("demo")["deleted"] is True


def test_multimodal_join_matches_shared_sample_ids(artifact_root):
    left = pipelines._write_csv(
        [{"sample_id": "a", "image_path": "a.png"}, {"sample_id": "b", "image_path": "b.png"}],
        ["sample_id", "image_path"],
    )
    right = pipelines._write_csv(
        [{"sample_id": "b", "text": "second"}, {"sample_id": "a", "text": "first"}],
        ["sample_id", "text"],
    )
    result = pipelines._multimodal_join({"key": "sample_id"}, {"left": left, "right": right}, {})
    rows, _ = pipelines._read_csv(result["dataset"])
    assert result["metadata"]["matched_samples"] == 2
    assert rows[0]["text"] == "first"
    assert rows[1]["text"] == "second"

def _mnist_test_graph():
    return {
        "name": "mnist-mlp",
        "nodes": [
            {"id": "input", "type": "Input", "config": {"shape": [1, 28, 28]}},
            {"id": "flatten", "type": "Flatten", "config": {"start_dim": 1}},
            {"id": "hidden", "type": "Linear", "config": {"in_features": 784, "out_features": 32}},
            {"id": "activation", "type": "ReLU", "config": {}},
            {"id": "classes", "type": "Linear", "config": {"in_features": 32, "out_features": 10}},
            {"id": "output", "type": "Output", "config": {}},
        ],
        "edges": [
            {"source": "input", "target": "flatten"},
            {"source": "flatten", "target": "hidden"},
            {"source": "hidden", "target": "activation"},
            {"source": "activation", "target": "classes"},
            {"source": "classes", "target": "output"},
        ],
    }


def test_mnist_artifact_round_trip(artifact_root):
    import torch

    images = torch.randint(0, 256, (12, 1, 28, 28), dtype=torch.uint8)
    labels = torch.arange(12, dtype=torch.long) % 10
    ref = pipelines._write_mnist_tensor_dataset(images, labels, "train")
    loaded_images, loaded_labels = pipelines._read_mnist_tensor_dataset(ref)
    assert torch.equal(images, loaded_images)
    assert torch.equal(labels, loaded_labels)
    assert ref["kind"] == "mnist_tensor_dataset"


def test_mnist_pipeline_trains_evaluates_saves_and_reloads(tmp_path, artifact_root, monkeypatch):
    import torch
    from services.backend import thinknet_backend_core as core

    monkeypatch.setattr(pipelines, "MODEL_ROOT", tmp_path / "models")
    train_images = torch.randint(0, 256, (40, 1, 28, 28), dtype=torch.uint8)
    train_labels = torch.arange(40, dtype=torch.long) % 10
    test_images = torch.randint(0, 256, (20, 1, 28, 28), dtype=torch.uint8)
    test_labels = torch.arange(20, dtype=torch.long) % 10
    train_ref = pipelines._write_mnist_tensor_dataset(train_images, train_labels, "train")
    test_ref = pipelines._write_mnist_tensor_dataset(test_images, test_labels, "test")

    monkeypatch.setitem(pipelines.COMPONENTS["mnist.load"], "run",
                        lambda _config, _inputs, _context: {
                            "train": train_ref, "test": test_ref,
                            "metadata": {"dataset": "synthetic-mnist", "train_rows": 40, "test_rows": 20},
                        })
    graph = pipelines.PipelineGraph(
        name="mnist-e2e-test",
        nodes=[
            {"id": "data", "type": "mnist.load"},
            {"id": "build", "type": "model.build_graph", "config": {"graph": _mnist_test_graph()}},
            {"id": "train", "type": "mnist.train", "config": {
                "epochs": 1, "batch_size": 10, "learning_rate": 0.001, "device": "cpu"}},
            {"id": "evaluate", "type": "mnist.evaluate"},
            {"id": "save", "type": "model.save"},
            {"id": "predict", "type": "mnist.predict", "config": {"limit": 5}},
        ],
        edges=[
            {"source": "build", "target": "train", "source_port": "model", "target_port": "model"},
            {"source": "data", "target": "train", "source_port": "train", "target_port": "dataset"},
            {"source": "train", "target": "evaluate", "source_port": "model", "target_port": "model"},
            {"source": "data", "target": "evaluate", "source_port": "test", "target_port": "dataset"},
            {"source": "train", "target": "save", "source_port": "model", "target_port": "model"},
            {"source": "train", "target": "predict", "source_port": "model", "target_port": "model"},
            {"source": "data", "target": "predict", "source_port": "test", "target_port": "dataset"},
        ],
    )
    result = pipelines.execute_pipeline(graph, seed=11)
    assert result["status"] == "completed", result.get("error")
    assert result["outputs"]["train"]["metrics"]["epochs"] == 1
    assert 0 <= result["outputs"]["evaluate"]["report"]["accuracy"] <= 1
    assert result["outputs"]["predict"]["predictions"]["count"] == 5

    saved_ref = result["outputs"]["save"]["model"]
    core.MODEL_STORE.pop(saved_ref["model_id"], None)
    restored = pipelines._model_load({"checkpoint_id": saved_ref["checkpoint_id"]}, {}, {})
    restored_model = pipelines._get_model(restored["model"])
    assert restored_model is not None
    assert restored["model"]["parameter_count"] > 0

def test_mnist_loader_creates_train_and_test_artifacts(tmp_path, artifact_root, monkeypatch):
    import sys
    import types
    import torch

    class FakeMNIST:
        def __init__(self, root, train, download):
            self.data = torch.zeros((8 if train else 4, 28, 28), dtype=torch.uint8)
            self.targets = torch.arange(len(self.data), dtype=torch.long) % 10

    torchvision = types.ModuleType("torchvision")
    datasets = types.ModuleType("torchvision.datasets")
    datasets.MNIST = FakeMNIST
    torchvision.datasets = datasets
    monkeypatch.setitem(sys.modules, "torchvision", torchvision)
    monkeypatch.setitem(sys.modules, "torchvision.datasets", datasets)

    result = pipelines._mnist_load({"root": str(tmp_path), "train_limit": 5}, {}, {})
    train_images, train_labels = pipelines._read_mnist_tensor_dataset(result["train"])
    test_images, test_labels = pipelines._read_mnist_tensor_dataset(result["test"])
    assert tuple(train_images.shape) == (5, 1, 28, 28)
    assert tuple(test_images.shape) == (4, 1, 28, 28)
    assert len(train_labels) == 5
    assert len(test_labels) == 4
    assert result["metadata"]["dataset"] == "MNIST"



def test_pipeline_cancellation_is_cooperative(artifact_root):
    import threading

    source = threading.Event()
    source.set()
    graph = pipelines.PipelineGraph(
        nodes=[{"id": "load", "type": "csv.load", "config": {"path": "unused.csv"}}]
    )
    result = pipelines.execute_pipeline(graph, cancel_event=source)
    assert result["status"] == "cancelled"
    assert result["nodes"] == []


def test_background_pipeline_job_persists_experiment(tmp_path, monkeypatch):
    import time
    from services.backend import thinknet_pipeline_jobs as jobs

    monkeypatch.setattr(pipelines, "ARTIFACT_ROOT", tmp_path / "artifacts")
    monkeypatch.setattr(jobs, "RUN_ROOT", tmp_path / "experiments")
    source = tmp_path / "input.csv"
    source.write_text("value\n1\n2\n", encoding="utf-8")
    graph = pipelines.PipelineGraph(
        name="background-smoke",
        nodes=[
            {"id": "load", "type": "csv.load", "config": {"path": str(source)}},
            {"id": "inspect", "type": "dataset.inspect"},
        ],
        edges=[{"source": "load", "target": "inspect", "source_port": "dataset", "target_port": "dataset"}],
    )
    accepted = jobs.start_pipeline_job(jobs.PipelineJobRequest(graph=graph, seed=11))
    job_id = accepted["job_id"]
    deadline = time.monotonic() + 10
    status = "queued"
    while time.monotonic() < deadline:
        status = jobs.get_pipeline_job(job_id)["status"]
        if status in {"completed", "failed", "cancelled"}:
            break
        time.sleep(0.05)
    assert status == "completed"
    run_id = jobs.get_pipeline_job(job_id)["run_id"]
    experiment = jobs.get_experiment(run_id)
    assert experiment["name"] == "background-smoke"
    assert experiment["seed"] == 11
    assert experiment["status"] == "completed"
    assert experiment["outputs"]["inspect"]["report"]["rows"] == 2


def test_causal_llm_pipeline_component_wraps_managed_training(tmp_path, monkeypatch):
    from services.backend import thinknet_training_jobs as training_jobs

    job_id = "0123456789ab"
    monkeypatch.setattr(training_jobs, "JOB_ROOT", tmp_path)
    output = tmp_path / job_id
    output.mkdir()
    (output / "manifest.json").write_text(
        '{"steps_completed": 12, "total_steps": 12, "parameter_count": 2048, '
        '"token_count": 900, "vocabulary_size": 50257, "device": "cpu"}',
        encoding="utf-8",
    )
    (output / "metrics.jsonl").write_text('{"step": 12, "loss": 2.5}\n', encoding="utf-8")
    monkeypatch.setattr(training_jobs, "start_training_job",
                        lambda _payload: {"job": {"job_id": job_id}})
    monkeypatch.setattr(training_jobs, "get_training_job",
                        lambda _job_id: {"status": "completed", "progress": 100, "message": "done"})
    result = pipelines._llm_train_causal(
        {"model_graph": {"nodes": [{"id": "placeholder"}]},
         "training": {"dataset_path": "unused.txt", "max_steps": 12, "log_every_steps": 3, "save_every_steps": 6}},
        {},
        {},
    )
    assert result["model"]["job_id"] == job_id
    assert result["metrics"]["steps_completed"] == 12
    assert result["metrics"]["last_metrics"]["loss"] == 2.5

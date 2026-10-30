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


def test_catalog_exposes_only_implemented_components():
    names = {item["type"] for item in pipelines.component_catalog()}
    assert names == {"csv.load", "dataset.inspect", "dataset.select_xy", "dataset.split_xy"}


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


def test_robotics_jsonl_adapter_reads_flattened_records(tmp_path, artifact_root):
    source = tmp_path / "telemetry.jsonl"
    source.write_text('{"timestamp": 1, "linear_x": 0.4}\\n{"timestamp": 2, "linear_x": 0.5}', encoding="utf-8")
    result = pipelines._robotics_jsonl({"path": str(source)}, {}, {})
    rows, columns = pipelines._read_csv(result["dataset"])
    assert "sample_id" in columns
    assert len(rows) == 2
    assert result["metadata"]["modality"] == "robotics"

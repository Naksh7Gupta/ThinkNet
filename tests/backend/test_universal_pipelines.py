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

from __future__ import annotations

from services.backend import thinknet_ml_engine as ml
from services.backend import thinknet_pipelines as pipelines


def test_universal_ml_components_are_registered():
    names = {item["type"] for item in pipelines.component_catalog()}
    assert {"text.tfidf", "ml.fit", "ml.evaluate", "ml.predict", "torch.fit", "torch.evaluate", "torch.predict"} <= names


def test_text_tfidf_and_classification_workflow(tmp_path, monkeypatch):
    monkeypatch.setattr(pipelines, "ARTIFACT_ROOT", tmp_path)
    ml.ML_MODELS.clear()
    source = pipelines._write_csv([
        {"text": "great helpful product", "label": "positive"},
        {"text": "excellent and wonderful", "label": "positive"},
        {"text": "terrible broken product", "label": "negative"},
        {"text": "awful and disappointing", "label": "negative"},
        {"text": "really great experience", "label": "positive"},
        {"text": "very bad experience", "label": "negative"},
    ], ["text", "label"])
    vectorized = ml._tfidf({"max_features": 32}, {"dataset": source}, {})
    rows, columns = pipelines._read_csv(vectorized["dataset"])
    assert len(rows) == 6
    assert vectorized["metadata"]["features"] > 0
    x_ref = pipelines._write_csv(
        [{column: row[column] for column in columns if column != "label"} for row in rows],
        [column for column in columns if column != "label"],
    )
    y_ref = pipelines._write_csv([{"label": row["label"]} for row in rows], ["label"])
    fitted = ml._fit({"task": "classification", "estimator": "logistic_regression"},
                     {"X": x_ref, "Y": y_ref}, {"seed": 7})
    report = ml._evaluate({}, {"model": fitted["model"], "X": x_ref, "Y": y_ref}, {})
    predictions = ml._predict({}, {"model": fitted["model"], "X": x_ref}, {})
    assert fitted["model"]["task"] == "classification"
    assert 0 <= report["report"]["accuracy"] <= 1
    assert predictions["predictions"]["count"] == 6


def test_universal_ml_regression_workflow(tmp_path, monkeypatch):
    monkeypatch.setattr(pipelines, "ARTIFACT_ROOT", tmp_path)
    ml.ML_MODELS.clear()
    x_ref = pipelines._write_csv(
        [{"area": str(i), "rooms": str(i % 3)} for i in range(1, 12)],
        ["area", "rooms"],
    )
    y_ref = pipelines._write_csv(
        [{"price": str(2 * i + 3)} for i in range(1, 12)], ["price"],
    )
    fitted = ml._fit({"task": "regression", "estimator": "linear_regression"},
                     {"X": x_ref, "Y": y_ref}, {"seed": 4})
    report = ml._evaluate({}, {"model": fitted["model"], "X": x_ref, "Y": y_ref}, {})
    assert report["report"]["task"] == "regression"
    assert report["report"]["mae"] < 1e-8


def test_universal_ml_clustering_workflow(tmp_path, monkeypatch):
    monkeypatch.setattr(pipelines, "ARTIFACT_ROOT", tmp_path)
    ml.ML_MODELS.clear()
    x_ref = pipelines._write_csv(
        [{"x": str(x), "y": str(y)} for x, y in
         [(0, 0), (0, 1), (1, 0), (10, 10), (10, 11), (11, 10)]],
        ["x", "y"],
    )
    fitted = ml._fit({"task": "clustering", "estimator": "kmeans", "clusters": 2},
                     {"X": x_ref}, {"seed": 3})
    report = ml._evaluate({}, {"model": fitted["model"], "X": x_ref}, {})
    assert report["report"]["clusters"] == 2
    assert "silhouette_score" in report["report"]


def test_universal_classifier_runs_through_shared_dag(tmp_path, monkeypatch):
    monkeypatch.setattr(pipelines, "ARTIFACT_ROOT", tmp_path)
    ml.ML_MODELS.clear()
    source = tmp_path / "classification.csv"
    source.write_text(
        "length,width,label\n"
        "1,1,small\n2,1,small\n1,2,small\n"
        "8,8,large\n9,8,large\n8,9,large\n"
        "2,2,small\n9,9,large\n",
        encoding="utf-8",
    )
    graph = pipelines.PipelineGraph(
        name="universal-classification",
        nodes=[
            {"id": "load", "type": "csv.load", "config": {"path": str(source)}},
            {"id": "xy", "type": "dataset.select_xy",
             "config": {"feature_columns": ["length", "width"], "target_column": "label"}},
            {"id": "split", "type": "dataset.split_xy",
             "config": {"validation_fraction": 0, "test_fraction": 0.25}},
            {"id": "fit", "type": "ml.fit",
             "config": {"task": "classification", "estimator": "logistic_regression"}},
            {"id": "evaluate", "type": "ml.evaluate"},
            {"id": "predict", "type": "ml.predict"},
        ],
        edges=[
            {"source": "load", "target": "xy", "source_port": "dataset", "target_port": "dataset"},
            {"source": "xy", "target": "split", "source_port": "X", "target_port": "X"},
            {"source": "xy", "target": "split", "source_port": "Y", "target_port": "Y"},
            {"source": "split", "target": "fit", "source_port": "X_train", "target_port": "X"},
            {"source": "split", "target": "fit", "source_port": "Y_train", "target_port": "Y"},
            {"source": "fit", "target": "evaluate", "source_port": "model", "target_port": "model"},
            {"source": "split", "target": "evaluate", "source_port": "X_test", "target_port": "X"},
            {"source": "split", "target": "evaluate", "source_port": "Y_test", "target_port": "Y"},
            {"source": "fit", "target": "predict", "source_port": "model", "target_port": "model"},
            {"source": "split", "target": "predict", "source_port": "X_test", "target_port": "X"},
        ],
    )
    result = pipelines.execute_pipeline(graph, seed=12)
    assert result["status"] == "completed", result.get("error")
    assert result["outputs"]["evaluate"]["report"]["accuracy"] >= 0.5
    assert result["outputs"]["predict"]["predictions"]["count"] == 2


def test_tfidf_split_fits_vocabulary_on_training_only(tmp_path, monkeypatch):
    monkeypatch.setattr(pipelines, "ARTIFACT_ROOT", tmp_path)
    train = pipelines._write_csv(
        [{"text": "bright helpful", "label": "positive"},
         {"text": "awful broken", "label": "negative"}],
        ["text", "label"],
    )
    test = pipelines._write_csv([{"text": "unseenword", "label": "positive"}], ["text", "label"])
    result = ml._tfidf_split({"text_column": "text"}, {"X_train": train, "X_test": test}, {})
    train_rows, train_columns = pipelines._read_csv(result["X_train"])
    test_rows, test_columns = pipelines._read_csv(result["X_test"])
    assert train_columns == test_columns
    assert len(train_rows) == 2 and len(test_rows) == 1
    assert result["metadata"]["fit_scope"] == "training_split_only"
    assert all(value == "0.0" for value in test_rows[0].values())


def test_pytorch_adapter_trains_evaluates_and_predicts_tabular_classifier(tmp_path, monkeypatch):
    monkeypatch.setattr(pipelines, "ARTIFACT_ROOT", tmp_path)
    graph = {
        "name": "small-tabular-mlp",
        "nodes": [
            {"id": "input", "type": "Input", "config": {"shape": [2]}},
            {"id": "network", "type": "Architecture",
             "config": {"architecture": "mlp", "config": {"input_dim": 2, "output_dim": 2, "hidden_dims": [8]}}},
            {"id": "output", "type": "Output", "config": {}},
        ],
        "edges": [
            {"source": "input", "target": "network", "source_port": "output", "target_port": "input"},
            {"source": "network", "target": "output", "source_port": "output", "target_port": "input"},
        ],
    }
    model_ref = pipelines._model_build({"graph": graph}, {}, {})["model"]
    x_ref = pipelines._write_csv(
        [{"x1": str(i), "x2": str(i % 2)} for i in range(20)],
        ["x1", "x2"],
    )
    y_ref = pipelines._write_csv(
        [{"label": "left" if i < 10 else "right"} for i in range(20)], ["label"],
    )
    fitted = ml._torch_fit(
        {"task": "classification", "epochs": 3, "batch_size": 5, "learning_rate": 0.01},
        {"model": model_ref, "X": x_ref, "Y": y_ref}, {"seed": 5},
    )
    report = ml._torch_evaluate({}, {"model": fitted["model"], "X": x_ref, "Y": y_ref}, {})
    predicted = ml._torch_predict({}, {"model": fitted["model"], "X": x_ref}, {})
    assert fitted["model"]["task"] == "classification"
    assert report["report"]["samples"] == 20
    assert predicted["predictions"]["count"] == 20
    assert set(predicted["predictions"]["values"]) <= {"left", "right"}
    monkeypatch.setattr(pipelines, "MODEL_ROOT", tmp_path / "checkpoints")
    saved = pipelines._model_save({}, {"model": fitted["model"]}, {})
    pipelines.MODEL_STORE.pop(fitted["model"]["model_id"], None)
    restored = pipelines._model_load(
        {"checkpoint_id": saved["model"]["checkpoint_id"]}, {}, {},
    )["model"]
    assert restored["classes"] == ["left", "right"]
    assert restored["feature_columns"] == ["x1", "x2"]

from __future__ import annotations

from services.backend import thinknet_ml_engine as ml
from services.backend import thinknet_pipelines as pipelines


def test_universal_ml_components_are_registered():
    names = {item["type"] for item in pipelines.component_catalog()}
    assert {"text.tfidf", "ml.fit", "ml.evaluate", "ml.predict"} <= names


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

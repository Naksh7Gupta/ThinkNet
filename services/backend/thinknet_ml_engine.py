"""Task adapters for ThinkNet's shared ML pipeline.

The DAG runner owns scheduling and artifacts; this module supplies reusable
estimators for common tabular and text-classification workflows.
"""
from __future__ import annotations

import uuid
from typing import Any

ML_MODELS: dict[str, dict[str, Any]] = {}


def _matrix(ref: dict[str, Any]) -> tuple[list[list[float]], list[str]]:
    from services.backend.thinknet_pipelines import _read_csv

    rows, columns = _read_csv(ref)
    if not rows or not columns:
        raise ValueError("Feature dataset is empty.")
    try:
        values = [[float(row[column]) for column in columns] for row in rows]
    except (TypeError, ValueError) as exc:
        raise ValueError("ML estimators require numeric features. Encode or vectorize text first.") from exc
    return values, columns


def _targets(ref: dict[str, Any]) -> list[str]:
    from services.backend.thinknet_pipelines import _read_csv

    rows, columns = _read_csv(ref)
    if len(columns) != 1 or not rows:
        raise ValueError("Target dataset must contain exactly one non-empty column.")
    return [str(row[columns[0]]) for row in rows]


def _estimator(task: str, name: str, seed: int):
    if task == "classification":
        from sklearn.ensemble import RandomForestClassifier
        from sklearn.linear_model import LogisticRegression
        if name == "logistic_regression":
            return LogisticRegression(max_iter=1000, random_state=seed)
        if name == "random_forest":
            return RandomForestClassifier(n_estimators=100, random_state=seed, n_jobs=1)
    elif task == "regression":
        from sklearn.ensemble import RandomForestRegressor
        from sklearn.linear_model import LinearRegression
        if name == "linear_regression":
            return LinearRegression()
        if name == "random_forest":
            return RandomForestRegressor(n_estimators=100, random_state=seed, n_jobs=1)
    elif task == "clustering":
        from sklearn.cluster import KMeans
        if name == "kmeans":
            return KMeans(n_clusters= int(2), random_state=seed, n_init=10)
    raise ValueError(f"Unsupported estimator '{name}' for task '{task}'.")


def _fit(config: dict[str, Any], inputs: dict[str, Any], context: dict[str, Any]) -> dict[str, Any]:
    from sklearn.metrics import accuracy_score

    task = str(config.get("task", "classification"))
    estimator_name = str(config.get("estimator", "logistic_regression"))
    x, columns = _matrix(inputs["X"])
    if task == "clustering":
        estimator = _estimator(task, estimator_name, context["seed"])
        estimator.set_params(n_clusters=int(config.get("clusters", 2)))
        estimator.fit(x)
        model = {"task": task, "estimator": estimator, "columns": columns, "classes": []}
        labels = estimator.labels_.tolist()
        metrics = {"samples": len(x), "clusters": len(set(labels)), "inertia": float(estimator.inertia_)}
    else:
        if "Y" not in inputs:
            raise ValueError(f"Task '{task}' requires a connected target dataset (Y).")
        y = _targets(inputs["Y"])
        if len(x) != len(y):
            raise ValueError("Feature and target row counts differ.")
        estimator = _estimator(task, estimator_name, context["seed"])
        if task == "classification":
            estimator.fit(x, y)
            predicted = estimator.predict(x)
            metrics = {"samples": len(x), "training_accuracy": float(accuracy_score(y, predicted)),
                       "classes": sorted(set(y))}
        elif task == "regression":
            numeric_y = [float(value) for value in y]
            estimator.fit(x, numeric_y)
            metrics = {"samples": len(x), "features": len(columns)}
        else:
            raise ValueError("task must be classification, regression, or clustering.")
        model = {"task": task, "estimator": estimator, "columns": columns,
                 "classes": sorted(set(y)) if task == "classification" else []}
    model_id = uuid.uuid4().hex
    ML_MODELS[model_id] = model
    return {"model": {"kind": "ml_model_ref", "model_id": model_id, "task": task,
                      "estimator": estimator_name, "features": columns},
            "metrics": metrics}


def _evaluate(_config: dict[str, Any], inputs: dict[str, Any], _context: dict[str, Any]) -> dict[str, Any]:
    from sklearn.metrics import accuracy_score, f1_score, mean_absolute_error, mean_squared_error, r2_score

    ref = inputs["model"]
    model = ML_MODELS.get(str(ref.get("model_id", "")))
    if model is None:
        raise ValueError("ML model handle expired; run the training component again.")
    x, columns = _matrix(inputs["X"])
    if columns != model["columns"]:
        raise ValueError("Evaluation feature columns/order do not match training.")
    predicted = model["estimator"].predict(x)
    task = model["task"]
    if task == "clustering":
        from sklearn.metrics import silhouette_score
        report = {"task": task, "samples": len(x), "clusters": len(set(predicted.tolist()))}
        if len(set(predicted.tolist())) > 1 and len(x) > len(set(predicted.tolist())):
            report["silhouette_score"] = float(silhouette_score(x, predicted))
    else:
        if "Y" not in inputs:
            raise ValueError("Evaluation requires a connected target dataset (Y).")
        y = _targets(inputs["Y"])
        if len(y) != len(predicted):
            raise ValueError("Evaluation feature and target row counts differ.")
        if task == "classification":
            report = {"task": task, "samples": len(y), "accuracy": float(accuracy_score(y, predicted)),
                      "f1_weighted": float(f1_score(y, predicted, average="weighted", zero_division=0))}
        else:
            actual = [float(value) for value in y]
            report = {"task": task, "samples": len(y),
                      "mae": float(mean_absolute_error(actual, predicted)),
                      "rmse": float(mean_squared_error(actual, predicted) ** 0.5),
                      "r2": float(r2_score(actual, predicted))}
    return {"report": report}


def _predict(_config: dict[str, Any], inputs: dict[str, Any], _context: dict[str, Any]) -> dict[str, Any]:
    ref = inputs["model"]
    model = ML_MODELS.get(str(ref.get("model_id", "")))
    if model is None:
        raise ValueError("ML model handle expired; run the training component again.")
    x, columns = _matrix(inputs["X"])
    if columns != model["columns"]:
        raise ValueError("Inference feature columns/order do not match training.")
    values = model["estimator"].predict(x).tolist()
    return {"predictions": {"task": model["task"], "count": len(values), "values": values}}


def _tfidf(config: dict[str, Any], inputs: dict[str, Any], _context: dict[str, Any]) -> dict[str, Any]:
    from sklearn.feature_extraction.text import TfidfVectorizer
    from services.backend.thinknet_pipelines import _read_csv, _write_csv

    rows, columns = _read_csv(inputs["dataset"])
    text_column = str(config.get("text_column", "text"))
    label_column = str(config.get("label_column", "label"))
    if text_column not in columns:
        raise ValueError(f"Text column '{text_column}' does not exist.")
    max_features = int(config.get("max_features", 256))
    if not 2 <= max_features <= 20000:
        raise ValueError("max_features must be between 2 and 20000.")
    texts = [row.get(text_column, "") for row in rows]
    if not any(text.strip() for text in texts):
        raise ValueError("Text dataset contains no non-empty documents.")
    vectorizer = TfidfVectorizer(max_features=max_features, ngram_range=(1, 2))
    matrix = vectorizer.fit_transform(texts).toarray()
    feature_names = [f"tfidf_{index}" for index in range(matrix.shape[1])]
    output_rows = []
    for index, vector in enumerate(matrix):
        item = {name: float(value) for name, value in zip(feature_names, vector)}
        if label_column in columns:
            item[label_column] = rows[index].get(label_column, "")
        output_rows.append(item)
    return {"dataset": _write_csv(output_rows, feature_names + ([label_column] if label_column in columns else [])),
            "metadata": {"method": "tfidf", "documents": len(rows),
                         "features": len(feature_names), "vocabulary_size": len(vectorizer.vocabulary_)}}


def register(components: dict[str, dict[str, Any]]) -> None:
    components.update({
        "text.tfidf": {"inputs": {"dataset": "dataset_ref"}, "outputs": {
            "dataset": "dataset_ref", "metadata": "metadata"}, "run": _tfidf},
        "ml.fit": {"inputs": {"X": "dataset_ref", "Y": "dataset_ref?"}, "outputs": {
            "model": "ml_model_ref", "metrics": "metadata"}, "run": _fit},
        "ml.evaluate": {"inputs": {"model": "ml_model_ref", "X": "dataset_ref", "Y": "dataset_ref?"}, "outputs": {
            "report": "metadata"}, "run": _evaluate},
        "ml.predict": {"inputs": {"model": "ml_model_ref", "X": "dataset_ref"}, "outputs": {
            "predictions": "metadata"}, "run": _predict},
    })

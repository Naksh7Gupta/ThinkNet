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


def _torch_fit(config: dict[str, Any], inputs: dict[str, Any], context: dict[str, Any]) -> dict[str, Any]:
    import torch
    import torch.nn.functional as F
    from torch.utils.data import DataLoader, TensorDataset
    from services.backend.thinknet_pipelines import _get_model, _resolve_device

    task = str(config.get("task", "classification"))
    if task not in {"classification", "regression"}:
        raise ValueError("PyTorch supervised training supports classification or regression.")
    x_values, columns = _matrix(inputs["X"])
    y_values = _targets(inputs["Y"])
    if len(x_values) != len(y_values):
        raise ValueError("Feature and target row counts differ.")
    classes = sorted(set(y_values)) if task == "classification" else []
    x = torch.tensor(x_values, dtype=torch.float32)
    if task == "classification":
        y = torch.tensor([classes.index(value) for value in y_values], dtype=torch.long)
    else:
        try:
            y = torch.tensor([float(value) for value in y_values], dtype=torch.float32).reshape(-1, 1)
        except ValueError as exc:
            raise ValueError("Regression targets must be numeric.") from exc
    epochs = int(config.get("epochs", 10))
    batch_size = int(config.get("batch_size", 32))
    learning_rate = float(config.get("learning_rate", 1e-3))
    if not 1 <= epochs <= 1000 or not 1 <= batch_size <= 4096 or not 0 < learning_rate <= 1:
        raise ValueError("Use epochs 1–1000, batch_size 1–4096, and learning_rate in (0, 1].")
    model_ref = inputs["model"]
    model = _get_model(model_ref)
    device = _resolve_device(config.get("device", "auto"))
    generator = torch.Generator().manual_seed(int(context["seed"]))
    loader = DataLoader(TensorDataset(x, y), batch_size=batch_size, shuffle=True,
                        generator=generator, num_workers=0)
    optimizer_name = str(config.get("optimizer", "adamw")).lower()
    if optimizer_name == "adamw":
        optimizer = torch.optim.AdamW(model.parameters(), lr=learning_rate)
    elif optimizer_name == "sgd":
        optimizer = torch.optim.SGD(model.parameters(), lr=learning_rate, momentum=0.9)
    else:
        raise ValueError("optimizer must be 'adamw' or 'sgd'.")
    model.to(device)
    history = []
    for epoch in range(epochs):
        if context.get("cancel_event") is not None and context["cancel_event"].is_set():
            raise RuntimeError("PyTorch training cancelled.")
        model.train()
        total_loss, correct, seen = 0.0, 0, 0
        for batch_x, batch_y in loader:
            if context.get("cancel_event") is not None and context["cancel_event"].is_set():
                raise RuntimeError("PyTorch training cancelled.")
            batch_x, batch_y = batch_x.to(device), batch_y.to(device)
            optimizer.zero_grad(set_to_none=True)
            output = model(batch_x)
            if isinstance(output, (tuple, list)):
                output = output[0]
            if task == "classification":
                if output.ndim != 2 or output.shape != (len(batch_y), len(classes)):
                    raise ValueError(f"Classifier graph must output [batch, {len(classes)}] logits.")
                loss = F.cross_entropy(output, batch_y)
                correct += int((output.argmax(dim=1) == batch_y).sum())
            else:
                output = output.reshape(-1)
                if output.shape != batch_y.reshape(-1).shape:
                    raise ValueError("Regression graph must output one scalar per sample.")
                loss = F.mse_loss(output, batch_y.reshape(-1))
            loss.backward()
            optimizer.step()
            total_loss += float(loss.detach()) * len(batch_y)
            seen += len(batch_y)
        record = {"epoch": epoch + 1, "loss": total_loss / max(1, seen)}
        if task == "classification":
            record["accuracy"] = correct / max(1, seen)
        history.append(record)
        callback = context.get("progress_callback")
        if callback:
            callback(str(context.get("current_node_id", "torch_fit")),
                     100.0 * (epoch + 1) / epochs, f"PyTorch {task} training epoch {epoch + 1}/{epochs}")
    model.to("cpu").eval()
    enriched_ref = {**model_ref, "task": task, "classes": classes, "feature_columns": columns}
    return {"model": enriched_ref, "metrics": {"task": task, "epochs": epochs,
            "samples": len(x_values), "training_loss": history[-1]["loss"],
            "training_accuracy": history[-1].get("accuracy"), "history": history,
            "device": str(device), "classes": classes}}


def _torch_evaluate(_config: dict[str, Any], inputs: dict[str, Any], _context: dict[str, Any]) -> dict[str, Any]:
    import torch
    import torch.nn.functional as F
    from services.backend.thinknet_pipelines import _get_model

    ref = inputs["model"]
    task = str(ref.get("task", "classification"))
    classes = list(ref.get("classes", []))
    x_values, columns = _matrix(inputs["X"])
    if columns != ref.get("feature_columns"):
        raise ValueError("Evaluation feature columns/order do not match training.")
    y_values = _targets(inputs["Y"])
    if len(x_values) != len(y_values):
        raise ValueError("Evaluation feature and target row counts differ.")
    model = _get_model(ref).eval()
    with torch.no_grad():
        output = model(torch.tensor(x_values, dtype=torch.float32))
        if isinstance(output, (tuple, list)):
            output = output[0]
        if task == "classification":
            if output.ndim != 2 or output.shape[1] != len(classes):
                raise ValueError("Classifier output width does not match its saved class labels.")
            target = torch.tensor([classes.index(value) for value in y_values], dtype=torch.long)
            predicted = output.argmax(dim=1)
            return {"report": {"task": task, "samples": len(y_values),
                    "accuracy": float((predicted == target).float().mean()),
                    "loss": float(F.cross_entropy(output, target)),
                    "classes": classes}}
        actual = torch.tensor([float(value) for value in y_values], dtype=torch.float32)
        predicted = output.reshape(-1)
        if predicted.shape != actual.shape:
            raise ValueError("Regression graph must output one scalar per sample.")
        error = predicted - actual
        mae = float(error.abs().mean())
        rmse = float(torch.sqrt((error ** 2).mean()))
        denominator = float(((actual - actual.mean()) ** 2).sum())
        r2 = 1.0 - float((error ** 2).sum()) / denominator if denominator > 0 else None
        return {"report": {"task": task, "samples": len(y_values), "mae": mae, "rmse": rmse, "r2": r2}}


def _torch_predict(_config: dict[str, Any], inputs: dict[str, Any], _context: dict[str, Any]) -> dict[str, Any]:
    import torch
    from services.backend.thinknet_pipelines import _get_model

    ref = inputs["model"]
    x_values, columns = _matrix(inputs["X"])
    if columns != ref.get("feature_columns"):
        raise ValueError("Inference feature columns/order do not match training.")
    model = _get_model(ref).eval()
    with torch.no_grad():
        output = model(torch.tensor(x_values, dtype=torch.float32))
        if isinstance(output, (tuple, list)):
            output = output[0]
        if ref.get("task") == "classification":
            indices = output.argmax(dim=1).tolist()
            values = [ref["classes"][index] for index in indices]
        else:
            values = output.reshape(-1).tolist()
    return {"predictions": {"task": ref.get("task"), "count": len(values), "values": values}}


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
                         "features": len(feature_names), "feature_columns": feature_names,
                         "vocabulary_size": len(vectorizer.vocabulary_)}}


def _tfidf_split(config: dict[str, Any], inputs: dict[str, Any], _context: dict[str, Any]) -> dict[str, Any]:
    """Fit vocabulary on training text only, then transform held-out text."""
    from sklearn.feature_extraction.text import TfidfVectorizer
    from services.backend.thinknet_pipelines import _read_csv, _write_csv

    text_column = str(config.get("text_column", "text"))
    max_features = int(config.get("max_features", 2048))
    if not 2 <= max_features <= 50000:
        raise ValueError("max_features must be between 2 and 50000.")
    train_rows, train_columns = _read_csv(inputs["X_train"])
    test_rows, test_columns = _read_csv(inputs["X_test"])
    if text_column not in train_columns or text_column not in test_columns:
        raise ValueError(f"Both text splits must contain '{text_column}'.")
    train_text = [row.get(text_column, "") for row in train_rows]
    test_text = [row.get(text_column, "") for row in test_rows]
    if not train_rows or not any(value.strip() for value in train_text):
        raise ValueError("Training text split is empty.")
    vectorizer = TfidfVectorizer(max_features=max_features, ngram_range=(1, 2))
    train_matrix = vectorizer.fit_transform(train_text)
    test_matrix = vectorizer.transform(test_text)
    names = [f"tfidf_{index}" for index in range(train_matrix.shape[1])]
    train_ref = _write_csv([{name: float(value) for name, value in zip(names, row)}
                            for row in train_matrix.toarray()], names)
    test_ref = _write_csv([{name: float(value) for name, value in zip(names, row)}
                           for row in test_matrix.toarray()], names)
    return {"X_train": train_ref, "X_test": test_ref,
            "metadata": {"method": "tfidf", "train_documents": len(train_rows),
                         "test_documents": len(test_rows), "features": len(names),
                         "vocabulary_size": len(vectorizer.vocabulary_),
                         "fit_scope": "training_split_only"}}


def register(components: dict[str, dict[str, Any]]) -> None:
    components.update({
        "text.tfidf_split": {"inputs": {"X_train": "dataset_ref", "X_test": "dataset_ref"}, "outputs": {"X_train": "dataset_ref", "X_test": "dataset_ref", "metadata": "metadata"}, "run": _tfidf_split},
        "text.tfidf": {"inputs": {"dataset": "dataset_ref"}, "outputs": {
            "dataset": "dataset_ref", "metadata": "metadata"}, "run": _tfidf},
        "torch.fit": {"inputs": {"model": "model_ref", "X": "dataset_ref", "Y": "dataset_ref"}, "outputs": {"model": "model_ref", "metrics": "metadata"}, "run": _torch_fit},
        "torch.evaluate": {"inputs": {"model": "model_ref", "X": "dataset_ref", "Y": "dataset_ref"}, "outputs": {"report": "metadata"}, "run": _torch_evaluate},
        "torch.predict": {"inputs": {"model": "model_ref", "X": "dataset_ref"}, "outputs": {"predictions": "metadata"}, "run": _torch_predict},
        "ml.fit": {"inputs": {"X": "dataset_ref", "Y": "dataset_ref?"}, "outputs": {
            "model": "ml_model_ref", "metrics": "metadata"}, "run": _fit},
        "ml.evaluate": {"inputs": {"model": "ml_model_ref", "X": "dataset_ref", "Y": "dataset_ref?"}, "outputs": {
            "report": "metadata"}, "run": _evaluate},
        "ml.predict": {"inputs": {"model": "ml_model_ref", "X": "dataset_ref"}, "outputs": {
            "predictions": "metadata"}, "run": _predict},
    })

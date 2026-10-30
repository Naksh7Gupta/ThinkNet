# ThinkNet end-to-end pipeline workspace

ThinkNet's primary engineering focus is now the complete, local-first ML project lifecycle. A pipeline is not just a diagram: it must take a user from raw data to a trained, evaluated, saved, reloadable, and invokable model, with reproducible runs and inspectable artifacts.

This document separates what the current branch implements from the remaining work required to make that full lifecycle dependable. Robotics and ROS 2 are not part of this milestone and are deferred.

## Implemented in this milestone

- A component catalog with declared input and output ports.
- DAG validation: unique IDs, known components, valid ports, compatible port types, one connection per input, no self-loops or cycles, and required-input checks.
- One dependency-ordered execution path with per-node status and actionable failure messages.
- CSV loading into ThinkNet-managed artifact references (not raw dataset contents passed over every graph edge).
- Dataset inspection: row count, columns, missing-value counts, and a small preview.
- X/Y selection, with Y optional for unlabeled workflows.
- Deterministic train/validation/test splitting. X and Y use the exact same shuffled row indices.
- JSON run records and CSV artifacts persisted below `training_output/pipeline_artifacts` by default.
- Backend endpoints and typed frontend API methods.

## API

- `GET /api/v1/pipelines/components`
- `POST /api/v1/pipelines/validate`
- `POST /api/v1/pipelines/run`

Example request to `POST /api/v1/pipelines/run`:

```json
{
  "seed": 42,
  "graph": {
    "name": "tabular-classification-data",
    "nodes": [
      {
        "id": "load",
        "type": "csv.load",
        "config": { "path": "C:/datasets/example.csv" }
      },
      {
        "id": "select",
        "type": "dataset.select_xy",
        "config": {
          "feature_columns": ["age", "income"],
          "target_column": "approved"
        }
      },
      {
        "id": "split",
        "type": "dataset.split_xy",
        "config": { "validation_fraction": 0.2, "test_fraction": 0.1 }
      }
    ],
    "edges": [
      {
        "source": "load",
        "target": "select",
        "source_port": "dataset",
        "target_port": "dataset"
      },
      {
        "source": "select",
        "target": "split",
        "source_port": "X",
        "target_port": "X"
      },
      {
        "source": "select",
        "target": "split",
        "source_port": "Y",
        "target_port": "Y"
      }
    ]
  }
}
```

Use `dataset.select_xy` without `target_column` and connect only X when preparing unlabeled data.

## Current implementation in this branch

The visual Pipeline Builder is available alongside Architecture Designer. It loads the backend component catalog, lets users add/connect nodes, edit node configuration JSON, validate and run the graph, and save/open local pipeline projects.

Additional local components:

- `text.load`: reads a UTF-8 text file as one document per non-empty line (or one whole-file document with `split: "file"`).
- `image.folder`: indexes PNG/JPEG/BMP/WebP files in class-name subfolders.
- `audio.wav_folder`: indexes WAV files in class-name subfolders and records sample rate, channels and duration.
- `model.build_graph` and `model.import_weights`: compile a supplied ThinkNet graph or safely load a state-dict checkpoint with its matching graph.
- `model.train_classifier`, `model.evaluate_classifier`, and `model.infer`: basic supervised numeric-tabular classification using the compiled model.
- `model.save` and `model.load`: durable local PyTorch checkpoint save/restore with the architecture graph.
- `mnist.load`, `mnist.train`, `mnist.evaluate`, and `mnist.predict`: a complete first image-classification workflow using real MNIST tensor data.
- `multimodal.join`: inner-joins two modality datasets on a shared sample ID.
- `python.custom`: invokes a user-selected Python script with JSON input/output files and a 30-second timeout. The script must accept input and output file paths as its two command-line arguments; input JSON contains `rows`, `columns`, and `config`; it must write a JSON list of row objects to the output path. **Only run scripts you trust**: custom Python executes on the local machine with the backend user’s permissions.

Persistent projects are stored locally below `projects/pipelines` by default. Configure the directory with `THINKNET_PIPELINE_PROJECT_DIR`.

## Current component examples

- Tabular classification/regression can use either the scikit-learn `ml.*` adapters or a user-built PyTorch MLP with `model.build_graph → torch.fit → torch.evaluate → torch.predict → model.save`.
- Text ingestion: `text.load → dataset.inspect`.
- Image/audio ingestion: `image.folder` or `audio.wav_folder → dataset.inspect`.
- Multimodal sample pairing: image/text/audio datasets with shared `sample_id` values → `multimodal.join`.

The image/audio nodes currently index files and labels; they do not yet decode, augment, batch, or train neural vision/audio models. Text ingestion currently creates document records; tokenizer, embedding, language-model training, and text evaluation adapters are still follow-up work. The multimodal join aligns records by sample ID but does not itself fuse neural embeddings. Model handles are process-local while executing; `model.save`/`model.load` now persist and restore checkpoint files, while a searchable model registry and experiment browser remain future work. Remote GPU execution is intentionally out of scope for this PR. Robotics and ROS 2 work is explicitly deferred; this branch will not expand those adapters.


## First complete example: MNIST classification

The Pipeline Builder now includes an **MNIST starter** that creates a real executable graph:

\`\`\`text
MNIST loader ──────────────┬── train images ──┐
                          └── test images ─┬─┼── evaluate
Model graph → MLP → train ────────────────┘ ├── save checkpoint
                                            └── predict samples
\`\`\`

The starter defines a small image MLP using the existing architecture graph compiler:

- Input: \`[1, 28, 28]\`
- Flatten: \`1 × 28 × 28 → 784\`
- Linear: \`784 → 128\`
- ReLU
- Linear: \`128 → 10\`
- Output: ten class logits

### MNIST components

- \`mnist.load\`: loads the official MNIST train/test splits through torchvision. Defaults to downloading into \`datasets/mnist\`; \`root\`, \`download\`, \`train_limit\`, and \`test_limit\` can be set in its config. It stores compact uint8 tensor artifacts in the ThinkNet artifact store.
- \`mnist.train\`: minibatch AdamW + cross-entropy training. Config: \`epochs\` (default 3), \`batch_size\` (128), \`learning_rate\` (0.001), and \`device\` (\`auto\`, \`cpu\`, or \`cuda\`). \`auto\` uses CUDA when available and CPU otherwise.
- \`mnist.evaluate\`: computes held-out loss, overall accuracy, and per-class accuracy.
- \`mnist.predict\`: returns up to 1,000 prediction rows with predicted digit, true digit, and confidence; default limit is 20.
- \`model.save\`: saves the architecture graph and PyTorch state dict under \`training_output/pipeline_models\` (configurable with \`THINKNET_PIPELINE_MODEL_DIR\`). Its output includes a \`checkpoint_id\`.
- \`model.load\`: restores a saved model using \`{"checkpoint_id": "<id>" }\` in the node config. This works after restarting the backend because the checkpoint is stored on disk.

Install the backend requirements, including torchvision, before running the starter. The first run downloads MNIST and therefore needs an internet connection. The dataset and checkpoint remain local after download/save.

### Reproducible starter workflow

1. Open Pipeline Builder and select **MNIST starter**.
2. Inspect the model graph inside the \`model.build_graph\` node configuration, or edit its layers.
3. Adjust epochs/batch size/device in the \`mnist.train\` node if needed.
4. Run the pipeline. The run summary reports test accuracy and the saved checkpoint ID.
5. Save the pipeline project. Keep the checkpoint ID from the run record to restore the model later with a \`model.load\` node and connect it to \`mnist.predict\`.

The end-to-end automated test uses a synthetic in-memory MNIST-shaped dataset so it does not download files or rely on network access. It covers DAG execution, training, evaluation, prediction, checkpoint persistence, and reload. The actual official-dataset download should still be verified in a local desktop run.

## Full-project completion target

The intended project is one coherent pipeline system, with shared artifacts and execution semantics across these stages:

1. **Project workspace:** create/open projects, persist graphs and settings, manage datasets, models, runs, and experiment history.
2. **Data ingestion and preparation:** import tabular, text, image, and audio data; inspect schemas and samples; clean, transform, encode, tokenize, augment, batch, and split data without breaking X/Y or sample-ID alignment.
3. **Model definition:** build models visually from ThinkNet graph components or import compatible pretrained models/checkpoints; validate tensor shapes and component compatibility.
4. **Training:** configure task, loss, optimizer, scheduler, batch size, epochs, device, validation, checkpoints, and reproducible seeds; stream progress and logs without blocking the UI.
5. **Evaluation:** run task-appropriate metrics on held-out data, inspect predictions/errors, and compare experiments.
6. **Model lifecycle:** save durable checkpoints and metadata, reload models after restart, version artifacts, and export supported formats.
7. **Inference:** invoke saved models on new inputs through a reusable inference interface and inspect outputs.
8. **Reliability:** cancellation, failure recovery, resource monitoring, clear errors, run manifests, and automated tests for complete example projects.

These are completion goals, not claims that every stage is implemented today. The current branch now includes a complete first image-classification vertical slice for MNIST, in addition to DAG execution, local artifact references, basic data operations, a visual editor, and project save/open. This is not yet a general-purpose trainer; arbitrary image/audio/text model training, a searchable model registry, complete experiment management, and robust task-specific preprocessing remain unfinished. The existing architecture compiler and causal-language-model training API are separate paths and are not falsely labelled as universal.

**Priority rule:** finish and verify the end-to-end ML pipeline lifecycle before expanding into robotics, ROS 2, simulation, or hardware integrations.

The artifact store is local to the backend machine. The default directory can be changed with `THINKNET_PIPELINE_ARTIFACT_DIR`. The local backend should only be exposed to trusted local clients; the current CSV loader intentionally reads the path selected by the user.

## Verification status

Tests have been added but must be executed locally/CI before this PR is considered complete. Do not treat a successful graph validation or one classifier run as proof that the full project lifecycle is finished.

## Tests

Run:

```bash
python -m pytest tests/backend/test_universal_pipelines.py -q
```


## Reusable task engine (new foundation)

The same DAG runner now exposes a reusable estimator adapter layer through
`services/backend/thinknet_ml_engine.py`. The graph engine remains task-neutral;
the adapters interpret task configuration and select an appropriate estimator.

### Registered components

- `text.tfidf`: converts a complete text dataset into numeric TF-IDF features. This convenience component fits on all rows; for a held-out evaluation workflow, prefer `text.tfidf_split`.
- `text.tfidf_split`: accepts paired `X_train` and `X_test` text artifacts, fits its vocabulary on training text only, then transforms test text with the same vocabulary.
- `ml.fit`, `ml.evaluate`, and `ml.predict`: scikit-learn adapters for classification, regression and clustering. Supported estimators:
  - classification: `logistic_regression`, `random_forest`
  - regression: `linear_regression`, `random_forest`
  - clustering: `kmeans` (configure `clusters`)
- `torch.fit`, `torch.evaluate`, and `torch.predict`: train and evaluate a user-built ThinkNet/PyTorch graph for numeric tabular classification or regression. Supports minibatches, AdamW/SGD, cancellation checks, progress callbacks and task-aware metrics. Connect a model from `model.build_graph`, feature artifacts to `X`, and a one-column target artifact to `Y`. The graph output width must equal the number of classes for classification, or one for regression.
- `model.save` preserves PyTorch task labels and feature-column metadata; `model.load` restores them.

### Example: sentiment classification

```text
csv.load (CSV has text and label columns)
   ↓
dataset.select_xy (feature_columns=["text"], target_column="label")
   ↓
dataset.split_xy
   ├── X_train + X_test → text.tfidf_split
   ├── X_train features + Y_train → ml.fit
   └── X_test features + Y_test → ml.evaluate ← fitted model
                                 fitted model + X_test → ml.predict
```

The actual canvas wires the split's `X_train` and `X_test` through `text.tfidf_split`, then sends the resulting feature artifacts to `ml.fit`, `ml.evaluate`, and `ml.predict`. This prevents the test split from influencing the fitted TF-IDF vocabulary.

### Boundaries of this first adapter layer

- TF-IDF is a bounded dense-feature baseline for small/medium experiments, not huge corpora.
- Scikit-learn model handles are process-local and expire when the backend restarts; durable sklearn serialization and a unified model registry remain follow-up work. These adapters do not use the PyTorch `model.save` component.
- PyTorch supervised adapters currently expect numeric feature columns. Categorical encoding, missing-value strategies, cross-validation and richer preprocessing remain future reusable components.
- Generic image/audio folder components still index file metadata; arbitrary image/audio neural training is not implemented yet. MNIST is the current complete vision example.
- Causal language-model pretraining is integrated through the managed LLM trainer. Instruction fine-tuning, SFT, LoRA/QLoRA, preference optimization, distributed training and remote GPU provisioning are not included in this milestone.
- Scikit-learn is an additional backend dependency; PyTorch and Transformers use the existing backend environment.

This is an incremental universal foundation: DAG execution, artifact contracts, background jobs and experiment records are shared, while specialized components select the appropriate library, model family, training loop and metrics. It does not force every AI task into one algorithm.

## Universal task adapters, LLM training, jobs and experiments

### Reusable text and tabular tasks

The universal estimator layer in `services/backend/thinknet_ml_engine.py` is not intended to be the limit of ThinkNet's algorithm support. It is one adapter family behind the same typed DAG/component contract. Current scikit-learn adapters cover classification, regression and clustering, while the PyTorch graph and MNIST components remain available for neural workflows.

For text classification, use `text.tfidf_split` after the paired train/test split. It fits its vocabulary on the training text only and transforms held-out text with that same vocabulary, avoiding test-set vocabulary leakage.

### Causal LLM training inside the pipeline

- `llm.train_causal` wraps ThinkNet's existing managed causal-language-model training job. Configure `model_graph` (a ThinkNet graph with integer token input, decoder/token embedding and LM head) and a `training` object using the existing TrainingSettings fields: `dataset_path`, `tokenizer_name`, `sequence_length`, `batch_size`, `max_steps`, `learning_rate`, `log_every_steps`, `save_every_steps`, `weight_decay`, `gradient_clip_norm`, `seed`, and `output_dir`.
- The node waits for the managed training job, then emits an `llm_model_ref` and final metrics. The underlying trainer writes model weights, aligned graph, tokenizer, manifest, metrics and checkpoints under `training_output/jobs/<job_id>`.
- `llm.generate` accepts that model reference and runs local seeded temperature-sampled autoregressive generation. Configure `prompt`, `max_new_tokens` (1–256), and `temperature` (0–2).
- This is a first causal-LM workflow, not a general Hugging Face fine-tuning framework: no instruction tuning, SFT, LoRA/QLoRA, preference optimization, distributed training or remote GPU provisioning is claimed here.

### Background execution

- `POST /api/v1/pipelines/jobs` accepts a validated graph and returns a job ID immediately (HTTP 202).
- `GET /api/v1/pipelines/jobs` lists active jobs and recent history.
- `GET /api/v1/pipelines/jobs/{job_id}` returns status, current component, progress and result.
- `POST /api/v1/pipelines/jobs/{job_id}/cancel` requests cooperative cancellation.
- The local backend runs one pipeline job at a time by default to protect local resources. Set `THINKNET_PIPELINE_WORKERS=2` to opt into two concurrent workers. Individual components run in that worker; the UI stays responsive. Cancellation is checked between components; the MNIST trainer checks between minibatches, and the LLM adapter forwards cancellation to its managed training job. Other components already in progress may need to finish before the pipeline stops.
- Active worker state is process-local and is lost if the backend exits; completed experiment records persist locally.

### Experiment tracking

- Every background run stores a JSON experiment record containing the graph snapshot, seed, node statuses/timestamps, outputs, metrics and final status.
- Default directory: `training_output/experiments`; override with `THINKNET_EXPERIMENT_DIR`.
- `GET /api/v1/pipelines/experiments` lists saved experiments.
- `GET /api/v1/pipelines/experiments/{run_id}` retrieves the full record.
- The Pipeline Builder exposes a recent Experiments selector. This is local run history, not yet a full experiment analytics dashboard or multi-user tracking server.

### Pipeline templates

The Pipeline Builder now offers templates for:
- Sentiment / spam classification: CSV text+label → paired split → train-only TF-IDF → logistic regression → evaluation and prediction.
- Tabular classification: scikit-learn logistic regression or a custom PyTorch MLP → evaluation and prediction.
- Regression: scikit-learn linear regression or a custom PyTorch MLP → MAE/RMSE/R² and prediction.
- Clustering: CSV → feature selection → K-means → cluster evaluation.
- Causal LLM training: a small decoder-only transformer graph → tokenizer/text training → generation.
- MNIST image classification remains available as its own starter.

Templates are editable starting points. Users must set real dataset paths and actual column names; they should validate the graph before running it.

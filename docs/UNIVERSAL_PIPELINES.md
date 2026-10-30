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
- `multimodal.join`: inner-joins two modality datasets on a shared sample ID.
- `model.train_classifier`, `model.evaluate_classifier`, and `model.infer`: basic supervised numeric-tabular classification using the compiled model.
- `python.custom`: invokes a user-selected Python script with JSON input/output files and a 30-second timeout. The script must accept input and output file paths as its two command-line arguments; input JSON contains `rows`, `columns`, and `config`; it must write a JSON list of row objects to the output path. **Only run scripts you trust**: custom Python executes on the local machine with the backend user’s permissions.

Persistent projects are stored locally below `projects/pipelines` by default. Configure the directory with `THINKNET_PIPELINE_PROJECT_DIR`.

## Current component examples

- Tabular classification: `csv.load → dataset.select_xy → dataset.split_xy → model.build_graph → model.train_classifier → model.evaluate_classifier`.
- Text ingestion: `text.load → dataset.inspect`.
- Image/audio ingestion: `image.folder` or `audio.wav_folder → dataset.inspect`.
- Multimodal sample pairing: image/text/audio datasets with shared `sample_id` values → `multimodal.join`.

The image/audio nodes currently index files and labels; they do not yet decode, augment, batch, or train neural vision/audio models. Text ingestion currently creates document records; tokenizer, embedding, language-model training, and text evaluation adapters are still follow-up work. The multimodal join aligns records by sample ID but does not itself fuse neural embeddings. Model handles currently live in backend memory during a run; durable model registry/checkpoint lifecycle is still future work. Remote GPU execution is intentionally out of scope for this PR. Robotics and ROS 2 work is explicitly deferred; this branch will not expand those adapters.

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

These are completion goals, not claims that every stage is implemented today. The current branch is an initial executable foundation: DAG execution, local artifact references, basic data operations, a visual editor, project save/open, and a limited numeric-tabular classifier path. The model workflow is not yet a general-purpose trainer; image/audio/text model training, durable model registry, complete experiment management, and robust task-specific preprocessing remain unfinished. The existing architecture compiler and causal-language-model training API are separate paths and are not falsely labelled as universal.

**Priority rule:** finish and verify the end-to-end ML pipeline lifecycle before expanding into robotics, ROS 2, simulation, or hardware integrations.

The artifact store is local to the backend machine. The default directory can be changed with `THINKNET_PIPELINE_ARTIFACT_DIR`. The local backend should only be exposed to trusted local clients; the current CSV loader intentionally reads the path selected by the user.

## Verification status

Tests have been added but must be executed locally/CI before this PR is considered complete. Do not treat a successful graph validation or one classifier run as proof that the full project lifecycle is finished.

## Tests

Run:

```bash
python -m pytest tests/backend/test_universal_pipelines.py -q
```

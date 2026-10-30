# Universal pipeline foundation

ThinkNet now has a first executable, local-first data-pipeline path alongside its existing neural-architecture graph compiler.

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

## Important boundaries

This is the first vertical slice, not the complete universal ML product. The current data loader supports local CSV files up to 50 MiB. Data operations are currently tabular; image, audio, text dataset adapters, model build/import, general-purpose training/evaluation/inference components, custom Python components, visual pipeline editor, and remote GPU execution remain future milestones. The existing architecture compiler and causal-language-model training API are separate existing paths and have not been falsely re-labelled as universal.

The artifact store is local to the backend machine. The default directory can be changed with `THINKNET_PIPELINE_ARTIFACT_DIR`. The local backend should only be exposed to trusted local clients; the current CSV loader intentionally reads the path selected by the user.

## Tests

Run:

```bash
python -m pytest tests/backend/test_universal_pipelines.py -q
```

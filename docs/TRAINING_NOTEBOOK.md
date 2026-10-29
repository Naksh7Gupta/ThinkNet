# ThinkNet training

## Notebook export

`POST /api/v1/training/notebook` accepts a validated graph and training settings, and returns a Jupyter notebook JSON document. The initial notebook template targets causal language modelling.

## Local managed training

The Model Training Studio uses these endpoints:

- `POST /api/v1/training/jobs` — start a local causal-LM training job from a graph and settings.
- `GET /api/v1/training/jobs/{job_id}` — read job state, progress, latest loss, device and errors.
- `GET /api/v1/training/jobs` — list jobs known to the current backend process.
- `POST /api/v1/training/jobs/{job_id}/cancel` — request cooperative cancellation.
- `GET /api/v1/training/jobs/{job_id}/download` — download the completed ZIP bundle.

The frontend polls the job status while it is queued or running, so progress and loss update during training. Jobs run in a background thread and are held in memory; restarting the backend clears the job registry. This is suitable for a local prototype, not a durable multi-user job scheduler.

## Current supported objective and limitations

The managed runner currently supports **causal language modelling** only. The compiled model must accept token-ID tensors shaped `[batch, sequence]` and return logits shaped `[batch, sequence, vocabulary]`. The selected tokenizer's IDs must fit the model vocabulary. A graph passing structural validation does not automatically make it trainable for this objective.

The runner uses CUDA if PyTorch detects a usable CUDA device; otherwise it uses the local CPU. It does not provision GPUs or connect Colab/Kaggle. The runner saves a final state dict, periodic checkpoints, JSONL metrics, graph/training configuration, a manifest and a ZIP artifact bundle. Checkpoints include optimizer state, but resume-from-checkpoint is not implemented yet.

Install the backend requirements, including `transformers`, and start the API from the repository root:

```bash
python -m pip install -r services/backend/requirements.txt
uvicorn services.backend.thinknet_backend_core:app --reload
```

The default dataset is a small placeholder at `services/backend/data/text.txt`; replace it with a real, properly licensed corpus before doing meaningful training. The default tokenizer is GPT-2, so the model architecture's vocabulary size must be compatible with that tokenizer (typically 50,257 for GPT-2). Small local test models should use a tokenizer/vocabulary configuration that matches their output layer.

# ThinkNet training notebook pipeline

This milestone adds a validated training-settings schema and an API endpoint that
generates a Jupyter notebook from a ThinkNet graph configuration.

## Endpoint

POST /api/v1/training/notebook

Example payload:

```json
{
  "graph": {
    "name": "tiny-text-model",
    "nodes": [],
    "edges": []
  },
  "training": {
    "learning_rate": 0.0003,
    "batch_size": 4,
    "sequence_length": 128,
    "max_steps": 100,
    "log_every_steps": 10,
    "save_every_steps": 50,
    "tokenizer_name": "gpt2",
    "dataset_path": "backend/data/text.txt",
    "output_dir": "training_output"
  }
}
```

The graph must pass ThinkNet's existing schema validation and compiler check.
The response includes a notebook document that can be saved as an .ipynb file.

## Current scope

- The default task is causal language modelling on a local text file.
- The generated notebook uses the prebuilt GPT-2 tokenizer by default.
- The user controls learning rate, batch size, sequence length, step count,
  logging interval, checkpoint interval, weight decay, gradient clipping, seed,
  tokenizer, dataset path, and output directory.
- The notebook writes JSONL metrics, resumable checkpoint dictionaries, and final
  model weights.
- CUDA is used only if already available in the notebook's Python environment.
  ThinkNet does not provision remote GPUs in this milestone.

This is a notebook generator, not yet a backend-managed training job. Training
runs inside the notebook environment, so live progress streaming into the desktop
frontend, cancellation/resume APIs, general task-specific loss functions, and a
persistent experiment registry remain follow-up work. A valid graph is not
automatically compatible with causal language modelling: the selected graph must
produce vocabulary logits compatible with the chosen tokenizer. The compiler rejects
unsupported graph nodes before notebook generation.

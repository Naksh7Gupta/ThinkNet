# ThinkNet Backend Core (v0.2)

This is the first backend milestone for ThinkNet's visual AI architecture editor.

## User-editable dimensions

An Input node's `config.shape` describes **one sample and excludes the batch axis**. Examples:

- `{"shape":[128]}` accepts tensors shaped `[batch, 128]`.
- `{"shape":[196,768]}` describes token embeddings shaped `[batch,196,768]`.
- `{"shape":[-1,768]}` permits a variable sequence length and fixed feature width. At most one `-1` is allowed.
- The shape-preview endpoint can accept a concrete runtime shape including batch, e.g. `[2,24]`.

Node configuration can expose `in_features`, `out_features`, `d_model`, `num_heads`, `num_kv_heads`, `hidden_dim`, `num_layers`, `patch_size`, `in_channels`, and other architecture-specific settings. Use `AutoLinear` if the input feature width should be inferred from the first runtime tensor.

## Run

From the repository root:

```bash
python -m venv .venv
# Windows: .venv\\Scripts\\activate
# macOS/Linux: source .venv/bin/activate
pip install -r backend/requirements.txt
uvicorn backend.thinknet_backend_core:app --reload
```

The source file is standalone at `backend/thinknet_backend_core.py`; run Uvicorn from the repository root.

## API

- `GET /health` — health check
- `GET /api/v1/nodes` — node catalog for the GUI's "+" menus
- `POST /api/v1/graphs/validate` — validate graph structure/configuration
- `POST /api/v1/graphs/infer-shapes` — best-effort shape preview
- `POST /api/v1/models/compile` — compile the currently supported execution subset

For the shape-preview endpoint, the current handler accepts a body containing both `payload` (the graph object) and optional `input_shape`, e.g. `{ "payload": { ...graph... }, "input_shape": [2, 24] }`.

Example graph:

```json
{
  "name": "tiny-mlp",
  "nodes": [
    {"id": "input", "type": "Input", "config": {"shape": [24]}},
    {"id": "projection", "type": "Linear", "config": {"in_features": 24, "out_features": 10}},
    {"id": "output", "type": "Output"}
  ],
  "edges": [
    {"source": "input", "target": "projection"},
    {"source": "projection", "target": "output"}
  ]
}
```

## Executable reference architectures

The graph compiler can now run the four reference builders from PR #5 through an `Architecture` node. The node configuration contains the builder name and its constructor configuration:

```json
{
  "id": "model",
  "type": "Architecture",
  "config": {
    "architecture": "mlp",
    "config": {"input_dim": 24, "output_dim": 10, "hidden_dims": [64, 32]}
  }
}
```

Connect an `Input` node to the `Architecture` node and then to an `Output` node. The input tensor must match the selected model's contract: feature tensors for `mlp`, integer token IDs for `decoder_transformer_lm`, and image tensors for `vit_classifier` / `cnn_classifier`. Architecture constructor errors identify the graph node that has the invalid configuration.

- `GET /api/v1/architectures` lists only the implemented reference builders.
- `POST /api/v1/models/compile` validates and compiles supported graph definitions.
- The architecture integration tests execute all four presets through `CompiledGraph` on CPU.

This is graph-level execution integration; it does not yet provide a persistent model registry, training-job API, dataset pipeline, or full visual-node implementation.

## Scope and limitations

The catalog is a discoverability list, not proof that every entry executes. The compiler now supports Input/Output, Linear/AutoLinear, Embedding/TokenEmbedding, LayerNorm/RMSNorm, BatchNorm1d, Dropout, common activations, Flatten/Reshape, Conv2d/MaxPool2d/GlobalAveragePool, Add/Multiply/ResidualAdd/Concat, Identity, and the four reference architectures through an Architecture node. Other catalog entries remain metadata-only until they have configuration validation, runtime behavior, and tests. Port typing, broad operator coverage (including advanced attention variants), full code generation, stronger schema validation, and CI remain follow-up work.

Shape inference is advisory, not a proof of runtime compatibility. Always run a small inference test before training. Avoid executing generated code from untrusted sources without isolation.

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

## Scope and limitations

The catalog currently advertises **49 node types**, while this first compiler executes a deliberately smaller subset (Input/Output, Linear/AutoLinear, LayerNorm/RMSNorm, Dropout, GELU/ReLU/SiLU, Identity, and basic merge nodes). Other catalog entries are metadata for the growing node ecosystem, not a claim that every operator is implemented. ViT/Transformer presets, richer port typing, multi-input attention execution, full code generation, robust parameter schema validation, and end-to-end CI remain follow-up work.

Shape inference is advisory, not a proof of runtime compatibility. Always run a small inference test before training. Avoid executing generated code from untrusted sources without isolation.

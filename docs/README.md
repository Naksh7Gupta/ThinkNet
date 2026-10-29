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
python -m venv services/backend/.venv
# Windows PowerShell: .\services\backend\.venv\Scripts\Activate.ps1
# macOS/Linux: source services/backend/.venv/bin/activate
pip install -r services/backend/requirements.txt
uvicorn services.backend.thinknet_backend_core:app --reload
```

The source file is standalone at `services/backend/thinknet_backend_core.py`; run Uvicorn from the repository root.

## API

- `GET /health` — health check
- `GET /api/v1/nodes` — node catalog for the GUI's "+" menus
- `POST /api/v1/graphs/validate` — validate graph structure/configuration
- `POST /api/v1/graphs/infer-shapes` — best-effort shape preview
- `POST /api/v1/models/compile` — compile a graph and return a process-local `model_id`
- `POST /api/v1/models/quantize` — create a new model handle from an existing compiled model using the selected dtype
- `GET /api/v1/models/{model_id}` — inspect a stored model handle
- `DELETE /api/v1/models/{model_id}` — release a model handle from memory

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

## Model quantization node

The `Quantizer` is a **model-transform** node: its input is a compiled model, its configuration requests an output dtype, and its output is a new model handle. It is intentionally not a tensor activation node, so add it to the model-operations stage rather than as an edge in the tensor graph.

1. Compile a valid graph with `POST /api/v1/models/compile`; the response includes `model_id`.
2. Request `POST /api/v1/models/quantize` with `{"model_id":"<source-id>","dtype":"int8"}`.
3. The response returns a different `model_id` for the transformed model. The source model remains unchanged.
4. Call `DELETE /api/v1/models/{model_id}` when either model handle is no longer needed.

Supported output choices:

- `int8`: dynamic INT8 quantization for `nn.Linear` modules. Non-Linear layers are not claimed to be INT8.
- `float16`: converts floating parameters and buffers to FP16.
- `bfloat16`: converts floating parameters and buffers to BF16.

FP16/BF16 inputs at inference time must use a compatible dtype; benchmark the target device and validate outputs before deployment. Model handles are stored in process memory and are lost on backend restart; this is an initial local workflow, not persistent storage.

## Node layout metadata

Every entry from `GET /api/v1/nodes` now includes a category color and concrete `size`, `width`, and `height` values for the canvas. Simple layers and `LMHead` use compact geometry; composite/model-level operations are larger. The `Quantizer` uses a larger, orange-highlighted shape so it reads as a model transformation. Category colors give related operations a consistent visual family.

## Residual connections

`ResidualAdd` is an executable two-input merge. Connect the main branch and the skip branch to it; both tensors must have compatible shapes. It computes `main + skip`, enabling residual blocks with a branch from an earlier node. Shape preview is advisory, so runtime tensor shapes must still be tested.

## Scope and limitations

The node catalog includes a `status` field for every entry: `implemented-and-tested`, `partial`, or `metadata-only`. The compiler supports Input/Output, Linear/AutoLinear, Embedding/TokenEmbedding, LayerNorm/RMSNorm, BatchNorm1d, Dropout, common activations, Flatten/Reshape, Conv2d/MaxPool2d/GlobalAveragePool, Add/Multiply/ResidualAdd/Concat, Identity, MultiHeadAttention, CausalSelfAttention, PreNormTransformerBlock, MLP/FeedForward, SwiGLU, learned and sinusoidal position embeddings, LayerScale, and the four reference architectures through an Architecture node. A `partial` status means an execution path exists but broader acceptance coverage is still needed; metadata-only entries must not be treated as executable. Port typing, broader operator coverage (including advanced attention variants), a fully standalone export, stronger schema validation, and a complete training workflow remain follow-up work.

Shape inference is advisory, not a proof of runtime compatibility. Always run a small inference test before training. Avoid executing generated code from untrusted sources without isolation.

## Export graph architectures to Python

Use `POST /api/v1/models/export` with the same graph JSON accepted by the compile endpoint. The API validates the graph and attempts to compile it before returning source:

```bash
curl -X POST http://127.0.0.1:8000/api/v1/models/export \
  -H "Content-Type: application/json" \
  --data-binary @graph.json
```

The response contains `filename`, `python_source`, and graph counts. Save the returned `python_source` value as `exported_model.py`. It embeds the graph specification and defines `build_model()` plus a reusable `GeneratedThinkNetModel(nn.Module)` wrapper.

**Scope:** this is a reproducible source export, not yet a standalone vendored implementation. The generated file imports ThinkNet's compiler, so run it from the repository root with the backend dependencies installed. This deliberately keeps exported behavior aligned with the tested graph engine. Nodes that are catalogued but not executable are rejected during export rather than producing misleading code. The exported file does not include trained weights; save/load checkpoints and a full training pipeline remain separate work.

### Executable node coverage update

The graph compiler now has tested execution paths for batch-first multi-head self-attention (causal and non-causal), a pre-norm transformer block, feed-forward/MLP, SwiGLU, learned and sinusoidal positional embeddings, and LayerScale. The CPU tests run each node on a real tensor and check shape and finite outputs. This does not imply that every node shown in the catalog is executable; check each node's `status` field.

The export endpoint is also tested by parsing and executing the generated Python, building the exported model, and running a forward pass. The current export still depends on ThinkNet's backend package and does not include trained weights; it is not yet a self-contained, standalone file.

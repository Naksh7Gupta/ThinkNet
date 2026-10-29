# ThinkNet executable reference architectures

This module adds four small, configurable PyTorch reference builders. Defaults are intentionally CPU-friendly for CI and local development; they are engineering baselines, not pretrained models or claims of frontier performance.

```python
from services.backend.thinknet_architectures import build_architecture, count_parameters

model = build_architecture("decoder_transformer_lm", {
    "vocab_size": 256, "d_model": 64, "num_layers": 2,
    "num_heads": 4, "max_seq_len": 128,
})
print(count_parameters(model))
```

| Name | Purpose | Input | Output |
|---|---|---|---|
| `mlp` | Classification or regression | `[..., input_dim]` | `[..., output_dim]` |
| `decoder_transformer_lm` | Decoder-only causal language model | integer token IDs `[batch, sequence]` | logits `[batch, sequence, vocab_size]`; optionally logits and cross-entropy loss when targets are supplied |
| `vit_classifier` | Vision Transformer classifier | `[batch, channels, image_size, image_size]` | class logits `[batch, num_classes]` |
| `cnn_classifier` | Compact convolutional classifier | `[batch, in_channels, height, width]` | class logits `[batch, num_classes]` |

Use `architecture_catalog()` to inspect the supported preset names and explicit status. `count_parameters()` reports parameter counts only; it does not estimate activation memory, FLOPs, throughput, or device fit.

## Test

From the repository root, install the existing backend dependencies and run:

```bash
python -m pytest tests/backend -q
```

Tests cover forward passes, backward propagation, an optimizer update, input validation, and a `state_dict` save/load round-trip on small CPU tensors.

## Scope

These presets are standalone builders. They do **not** mean every entry in the existing visual-node catalog is implemented, and they are not yet serialized into the graph compiler. That remains a separate integration milestone. For language-model training, this baseline computes cross-entropy over supplied targets; dataset shifting, batching, evaluation, checkpoint management, and generation policy remain responsibilities of the training runtime.

"""Configurable, CPU-friendly PyTorch reference architectures for ThinkNet."""
from __future__ import annotations
from typing import Any, Callable
import torch
from torch import Tensor, nn
import torch.nn.functional as F

def _positive(name: str, value: int) -> None:
    if isinstance(value, bool) or not isinstance(value, int) or value < 1:
        raise ValueError(f"{name} must be a positive integer; got {value!r}.")

class MLP(nn.Module):
    """MLP for classification or regression."""
    def __init__(self, input_dim: int, output_dim: int, hidden_dims: tuple[int, ...] | list[int] = (128, 64), dropout: float = 0.0, activation: str = "gelu"):
        super().__init__()
        _positive("input_dim", input_dim); _positive("output_dim", output_dim)
        if not 0 <= dropout < 1: raise ValueError("dropout must be in [0, 1).")
        acts = {"relu": nn.ReLU, "gelu": nn.GELU, "silu": nn.SiLU, "tanh": nn.Tanh}
        if activation.lower() not in acts: raise ValueError(f"Unsupported activation {activation!r}; choose {sorted(acts)}.")
        layers: list[nn.Module] = []; previous = input_dim
        for width in hidden_dims:
            _positive("hidden_dims entry", width)
            layers.extend((nn.Linear(previous, width), acts[activation.lower()]()))
            if dropout: layers.append(nn.Dropout(dropout))
            previous = width
        layers.append(nn.Linear(previous, output_dim))
        self.input_dim = input_dim; self.network = nn.Sequential(*layers)
    def forward(self, x: Tensor) -> Tensor:
        if x.shape[-1] != self.input_dim: raise ValueError(f"MLP expects final dimension {self.input_dim}, got {x.shape[-1]}.")
        return self.network(x)

class CausalSelfAttention(nn.Module):
    """Multi-head causal self-attention."""
    def __init__(self, d_model: int, num_heads: int, dropout: float = 0.0, max_seq_len: int = 512):
        super().__init__()
        for n, v in (("d_model", d_model), ("num_heads", num_heads), ("max_seq_len", max_seq_len)): _positive(n, v)
        if d_model % num_heads: raise ValueError("d_model must be divisible by num_heads.")
        if not 0 <= dropout < 1: raise ValueError("dropout must be in [0, 1).")
        self.d_model = d_model; self.num_heads = num_heads; self.head_dim = d_model // num_heads
        self.qkv = nn.Linear(d_model, 3 * d_model); self.proj = nn.Linear(d_model, d_model)
        self.dropout = dropout; self.resid_dropout = nn.Dropout(dropout)
        self.register_buffer("causal_mask", torch.tril(torch.ones(max_seq_len, max_seq_len, dtype=torch.bool)), persistent=False)
    def forward(self, x: Tensor) -> Tensor:
        batch, length, width = x.shape
        if width != self.d_model: raise ValueError(f"Attention expects feature width {self.d_model}, got {width}.")
        if length > self.causal_mask.shape[0]: raise ValueError(f"Sequence length exceeds max_seq_len={self.causal_mask.shape[0]}.")
        q, k, v = self.qkv(x).chunk(3, dim=-1)
        def split(t: Tensor) -> Tensor: return t.view(batch, length, self.num_heads, self.head_dim).transpose(1, 2)
        q, k, v = split(q), split(k), split(v)
        y = F.scaled_dot_product_attention(q, k, v, attn_mask=self.causal_mask[:length, :length], dropout_p=self.dropout if self.training else 0.0)
        y = y.transpose(1, 2).contiguous().view(batch, length, width)
        return self.resid_dropout(self.proj(y))

class DecoderBlock(nn.Module):
    def __init__(self, d_model: int, num_heads: int, dropout: float, max_seq_len: int, mlp_ratio: int = 4):
        super().__init__(); _positive("mlp_ratio", mlp_ratio)
        self.norm1 = nn.LayerNorm(d_model); self.attn = CausalSelfAttention(d_model, num_heads, dropout, max_seq_len)
        self.norm2 = nn.LayerNorm(d_model)
        self.ffn = nn.Sequential(nn.Linear(d_model, mlp_ratio*d_model), nn.GELU(), nn.Dropout(dropout), nn.Linear(mlp_ratio*d_model, d_model), nn.Dropout(dropout))
    def forward(self, x: Tensor) -> Tensor:
        x = x + self.attn(self.norm1(x)); return x + self.ffn(self.norm2(x))

class DecoderTransformerLM(nn.Module):
    """Decoder-only LM returning logits and optional cross-entropy loss."""
    def __init__(self, vocab_size: int, d_model: int = 128, num_layers: int = 2, num_heads: int = 4, max_seq_len: int = 128, dropout: float = 0.0, tie_embeddings: bool = True):
        super().__init__()
        for n, v in (("vocab_size", vocab_size), ("d_model", d_model), ("num_layers", num_layers), ("num_heads", num_heads), ("max_seq_len", max_seq_len)): _positive(n, v)
        if d_model % num_heads: raise ValueError("d_model must be divisible by num_heads.")
        if not 0 <= dropout < 1: raise ValueError("dropout must be in [0, 1).")
        self.vocab_size = vocab_size; self.max_seq_len = max_seq_len
        self.token_embedding = nn.Embedding(vocab_size, d_model); self.position_embedding = nn.Embedding(max_seq_len, d_model)
        self.embedding_dropout = nn.Dropout(dropout)
        self.blocks = nn.ModuleList([DecoderBlock(d_model, num_heads, dropout, max_seq_len) for _ in range(num_layers)])
        self.final_norm = nn.LayerNorm(d_model); self.lm_head = nn.Linear(d_model, vocab_size, bias=False)
        self.apply(self._init_weights)
        if tie_embeddings: self.lm_head.weight = self.token_embedding.weight
    @staticmethod
    def _init_weights(module: nn.Module) -> None:
        if isinstance(module, (nn.Linear, nn.Embedding)):
            nn.init.normal_(module.weight, mean=0.0, std=0.02)
            if isinstance(module, nn.Linear) and module.bias is not None: nn.init.zeros_(module.bias)
    def forward(self, input_ids: Tensor, targets: Tensor | None = None) -> Tensor | tuple[Tensor, Tensor]:
        if input_ids.ndim != 2: raise ValueError("input_ids must have shape [batch, sequence].")
        batch, length = input_ids.shape
        if length < 1 or length > self.max_seq_len: raise ValueError(f"Sequence length must be between 1 and max_seq_len={self.max_seq_len}; got {length}.")
        if input_ids.dtype not in (torch.int32, torch.int64): raise ValueError("input_ids must contain integer token IDs.")
        if input_ids.numel() and (input_ids.min() < 0 or input_ids.max() >= self.vocab_size): raise ValueError(f"Token IDs must be in [0, {self.vocab_size - 1}].")
        positions = torch.arange(length, device=input_ids.device).expand(batch, length)
        x = self.embedding_dropout(self.token_embedding(input_ids) + self.position_embedding(positions))
        for block in self.blocks: x = block(x)
        logits = self.lm_head(self.final_norm(x))
        if targets is None: return logits
        if targets.shape != input_ids.shape: raise ValueError("targets must have the same shape as input_ids.")
        return logits, F.cross_entropy(logits.reshape(-1, self.vocab_size), targets.reshape(-1))

class VisionTransformerClassifier(nn.Module):
    """Fixed-resolution ViT classifier."""
    def __init__(self, image_size: int = 32, patch_size: int = 8, in_channels: int = 3, num_classes: int = 10, d_model: int = 128, num_layers: int = 2, num_heads: int = 4, mlp_ratio: int = 4, dropout: float = 0.0):
        super().__init__()
        for n, v in (("image_size", image_size), ("patch_size", patch_size), ("in_channels", in_channels), ("num_classes", num_classes), ("d_model", d_model), ("num_layers", num_layers), ("num_heads", num_heads), ("mlp_ratio", mlp_ratio)): _positive(n, v)
        if image_size % patch_size: raise ValueError("image_size must be divisible by patch_size.")
        if d_model % num_heads: raise ValueError("d_model must be divisible by num_heads.")
        self.image_size = image_size; self.in_channels = in_channels; grid = image_size // patch_size
        self.patch_embed = nn.Conv2d(in_channels, d_model, patch_size, stride=patch_size)
        self.cls_token = nn.Parameter(torch.zeros(1, 1, d_model)); self.position_embedding = nn.Parameter(torch.zeros(1, grid*grid+1, d_model))
        layer = nn.TransformerEncoderLayer(d_model, num_heads, mlp_ratio*d_model, dropout, activation="gelu", batch_first=True, norm_first=True)
        self.encoder = nn.TransformerEncoder(layer, num_layers, norm=nn.LayerNorm(d_model), enable_nested_tensor=False)
        self.head = nn.Linear(d_model, num_classes)
        nn.init.trunc_normal_(self.cls_token, std=0.02); nn.init.trunc_normal_(self.position_embedding, std=0.02)
    def forward(self, images: Tensor) -> Tensor:
        if images.ndim != 4: raise ValueError("images must have shape [batch, channels, height, width].")
        if images.shape[1] != self.in_channels or images.shape[2:] != (self.image_size, self.image_size):
            raise ValueError(f"Expected [batch, {self.in_channels}, {self.image_size}, {self.image_size}], got {list(images.shape)}.")
        x = self.patch_embed(images).flatten(2).transpose(1, 2)
        x = torch.cat((self.cls_token.expand(images.shape[0], -1, -1), x), dim=1) + self.position_embedding
        return self.head(self.encoder(x)[:, 0])

class ConvNetClassifier(nn.Module):
    """Compact CNN classifier with adaptive pooling."""
    def __init__(self, in_channels: int = 3, num_classes: int = 10, base_channels: int = 32, dropout: float = 0.0):
        super().__init__()
        for n, v in (("in_channels", in_channels), ("num_classes", num_classes), ("base_channels", base_channels)): _positive(n, v)
        if not 0 <= dropout < 1: raise ValueError("dropout must be in [0, 1).")
        c = base_channels; self.in_channels = in_channels
        self.features = nn.Sequential(
            nn.Conv2d(in_channels,c,3,padding=1,bias=False), nn.BatchNorm2d(c), nn.GELU(),
            nn.Conv2d(c,c,3,padding=1,bias=False), nn.BatchNorm2d(c), nn.GELU(), nn.MaxPool2d(2),
            nn.Conv2d(c,2*c,3,padding=1,bias=False), nn.BatchNorm2d(2*c), nn.GELU(),
            nn.Conv2d(2*c,2*c,3,padding=1,bias=False), nn.BatchNorm2d(2*c), nn.GELU(), nn.MaxPool2d(2),
            nn.AdaptiveAvgPool2d(1), nn.Flatten(), nn.Dropout(dropout), nn.Linear(2*c,num_classes))
    def forward(self, images: Tensor) -> Tensor:
        if images.ndim != 4 or images.shape[1] != self.in_channels: raise ValueError(f"Expected images shaped [batch, {self.in_channels}, height, width].")
        return self.features(images)

_BUILDERS: dict[str, Callable[..., nn.Module]] = {"mlp": MLP, "decoder_transformer_lm": DecoderTransformerLM, "vit_classifier": VisionTransformerClassifier, "cnn_classifier": ConvNetClassifier}

def build_architecture(name: str, config: dict[str, Any] | None = None) -> nn.Module:
    """Build one supported architecture from a JSON-friendly config."""
    key = name.strip().lower()
    if key not in _BUILDERS: raise ValueError(f"Unknown architecture {name!r}; available: {sorted(_BUILDERS)}.")
    try: return _BUILDERS[key](**dict(config or {}))
    except TypeError as exc: raise ValueError(f"Invalid config for architecture {key!r}: {exc}") from exc

def architecture_catalog() -> list[dict[str, str]]:
    """Report only architectures that have real builders and tests."""
    tasks = {"mlp": "classification-or-regression", "decoder_transformer_lm": "causal-language-modeling", "vit_classifier": "image-classification", "cnn_classifier": "image-classification"}
    return [{"name": name, "status": "implemented-and-tested", "task": task, "entrypoint": "build_architecture"} for name, task in tasks.items()]

def count_parameters(model: nn.Module, trainable_only: bool = False) -> int:
    """Count parameters; this is not a memory or FLOPs estimate."""
    return sum(p.numel() for p in model.parameters() if not trainable_only or p.requires_grad)

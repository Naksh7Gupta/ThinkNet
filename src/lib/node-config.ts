import type { CatalogNode } from "@/types/api";

export type FieldKind =
  | "int"
  | "float"
  | "bool"
  | "string"
  | "int-list"
  | "select";

export type ConfigField = {
  key: string;
  label: string;
  kind: FieldKind;
  nestedPath?: "config";
  options?: Array<{ label: string; value: string }>;
  min?: number;
  max?: number;
  step?: number;
  help?: string;
};

const ARCHITECTURE_FIELDS: Record<string, ConfigField[]> = {
  mlp: [
    { key: "input_dim", label: "input_dim", kind: "int", nestedPath: "config", min: 1 },
    { key: "output_dim", label: "output_dim", kind: "int", nestedPath: "config", min: 1 },
    {
      key: "hidden_dims",
      label: "hidden_dims",
      kind: "int-list",
      nestedPath: "config",
      help: "Comma-separated hidden widths, e.g. 64, 32",
    },
    { key: "dropout", label: "dropout", kind: "float", nestedPath: "config", min: 0, max: 0.999, step: 0.01 },
    {
      key: "activation",
      label: "activation",
      kind: "select",
      nestedPath: "config",
      options: [
        { label: "gelu", value: "gelu" },
        { label: "relu", value: "relu" },
        { label: "silu", value: "silu" },
        { label: "tanh", value: "tanh" },
      ],
    },
  ],
  decoder_transformer_lm: [
    { key: "vocab_size", label: "vocab_size", kind: "int", nestedPath: "config", min: 1 },
    { key: "d_model", label: "d_model", kind: "int", nestedPath: "config", min: 1 },
    { key: "num_layers", label: "num_layers", kind: "int", nestedPath: "config", min: 1 },
    { key: "num_heads", label: "num_heads", kind: "int", nestedPath: "config", min: 1 },
    { key: "max_seq_len", label: "max_seq_len", kind: "int", nestedPath: "config", min: 1 },
    { key: "dropout", label: "dropout", kind: "float", nestedPath: "config", min: 0, max: 0.999, step: 0.01 },
    { key: "tie_embeddings", label: "tie_embeddings", kind: "bool", nestedPath: "config" },
  ],
  vit_classifier: [
    { key: "image_size", label: "image_size", kind: "int", nestedPath: "config", min: 1 },
    { key: "patch_size", label: "patch_size", kind: "int", nestedPath: "config", min: 1 },
    { key: "in_channels", label: "in_channels", kind: "int", nestedPath: "config", min: 1 },
    { key: "num_classes", label: "num_classes", kind: "int", nestedPath: "config", min: 1 },
    { key: "d_model", label: "d_model", kind: "int", nestedPath: "config", min: 1 },
    { key: "num_layers", label: "num_layers", kind: "int", nestedPath: "config", min: 1 },
    { key: "num_heads", label: "num_heads", kind: "int", nestedPath: "config", min: 1 },
    { key: "mlp_ratio", label: "mlp_ratio", kind: "int", nestedPath: "config", min: 1 },
    { key: "dropout", label: "dropout", kind: "float", nestedPath: "config", min: 0, max: 0.999, step: 0.01 },
  ],
  cnn_classifier: [
    { key: "in_channels", label: "in_channels", kind: "int", nestedPath: "config", min: 1 },
    { key: "num_classes", label: "num_classes", kind: "int", nestedPath: "config", min: 1 },
    { key: "base_channels", label: "base_channels", kind: "int", nestedPath: "config", min: 1 },
    { key: "dropout", label: "dropout", kind: "float", nestedPath: "config", min: 0, max: 0.999, step: 0.01 },
  ],
};

const FIELDS_BY_TYPE: Record<string, ConfigField[]> = {
  Input: [
    {
      key: "shape",
      label: "shape",
      kind: "int-list",
      help: "One sample, excluding batch. Use -1 for one variable dimension.",
    },
  ],
  Linear: [
    { key: "in_features", label: "in_features", kind: "int", min: 1 },
    { key: "out_features", label: "out_features", kind: "int", min: 1 },
    { key: "bias", label: "bias", kind: "bool" },
  ],
  AutoLinear: [
    { key: "out_features", label: "out_features", kind: "int", min: 1 },
    { key: "bias", label: "bias", kind: "bool" },
  ],
  LMHead: [
    { key: "in_features", label: "in_features", kind: "int", min: 1 },
    { key: "d_model", label: "d_model (alias)", kind: "int", min: 1 },
    { key: "vocab_size", label: "vocab_size", kind: "int", min: 1 },
    { key: "out_features", label: "out_features (alias)", kind: "int", min: 1 },
    { key: "bias", label: "bias", kind: "bool" },
  ],
  Embedding: [
    { key: "num_embeddings", label: "num_embeddings", kind: "int", min: 1 },
    { key: "vocab_size", label: "vocab_size (alias)", kind: "int", min: 1 },
    { key: "embedding_dim", label: "embedding_dim", kind: "int", min: 1 },
    { key: "d_model", label: "d_model (alias)", kind: "int", min: 1 },
  ],
  TokenEmbedding: [
    { key: "num_embeddings", label: "num_embeddings", kind: "int", min: 1 },
    { key: "vocab_size", label: "vocab_size (alias)", kind: "int", min: 1 },
    { key: "embedding_dim", label: "embedding_dim", kind: "int", min: 1 },
    { key: "d_model", label: "d_model (alias)", kind: "int", min: 1 },
  ],
  LayerNorm: [
    { key: "normalized_shape", label: "normalized_shape", kind: "int", min: 1 },
    { key: "eps", label: "eps", kind: "float", min: 0, step: 1e-8 },
  ],
  RMSNorm: [
    { key: "normalized_shape", label: "normalized_shape", kind: "int", min: 1 },
    { key: "eps", label: "eps", kind: "float", min: 0, step: 1e-8 },
  ],
  BatchNorm1d: [
    { key: "num_features", label: "num_features", kind: "int", min: 1 },
    { key: "features", label: "features (alias)", kind: "int", min: 1 },
  ],
  BatchNorm2d: [
    { key: "num_features", label: "num_features", kind: "int", min: 1 },
    { key: "num_channels", label: "num_channels (alias)", kind: "int", min: 1 },
  ],
  GroupNorm: [
    { key: "num_groups", label: "num_groups", kind: "int", min: 1 },
    { key: "num_channels", label: "num_channels", kind: "int", min: 1 },
  ],
  Dropout: [{ key: "p", label: "p", kind: "float", min: 0, max: 0.999, step: 0.01 }],
  Softmax: [{ key: "dim", label: "dim", kind: "int" }],
  Concat: [{ key: "dim", label: "dim", kind: "int" }],
  Reshape: [
    {
      key: "shape",
      label: "shape",
      kind: "int-list",
      help: "Sample shape after reshape. At most one -1. Batch is preserved.",
    },
  ],
  Flatten: [
    { key: "start_dim", label: "start_dim", kind: "int" },
    { key: "end_dim", label: "end_dim", kind: "int" },
  ],
  Conv2d: [
    { key: "in_channels", label: "in_channels", kind: "int", min: 1 },
    { key: "out_channels", label: "out_channels", kind: "int", min: 1 },
    { key: "kernel_size", label: "kernel_size", kind: "int", min: 1 },
    { key: "stride", label: "stride", kind: "int", min: 1 },
    { key: "padding", label: "padding", kind: "int", min: 0 },
    { key: "bias", label: "bias", kind: "bool" },
  ],
  MaxPool2d: [
    { key: "kernel_size", label: "kernel_size", kind: "int", min: 1 },
    { key: "stride", label: "stride", kind: "int", min: 1 },
    { key: "padding", label: "padding", kind: "int", min: 0 },
  ],
  AvgPool2d: [
    { key: "kernel_size", label: "kernel_size", kind: "int", min: 1 },
    { key: "stride", label: "stride", kind: "int", min: 1 },
    { key: "padding", label: "padding", kind: "int", min: 0 },
  ],
  AdaptiveAvgPool2d: [
    {
      key: "output_size",
      label: "output_size",
      kind: "int",
      min: 1,
      help: "Spatial size per side; 1 is global pooling.",
    },
  ],
  MultiHeadAttention: [
    { key: "d_model", label: "d_model", kind: "int", min: 1 },
    { key: "num_heads", label: "num_heads", kind: "int", min: 1 },
    { key: "dropout", label: "dropout", kind: "float", min: 0, max: 0.999, step: 0.01 },
  ],
  CausalSelfAttention: [
    { key: "d_model", label: "d_model", kind: "int", min: 1 },
    { key: "num_heads", label: "num_heads", kind: "int", min: 1 },
    { key: "dropout", label: "dropout", kind: "float", min: 0, max: 0.999, step: 0.01 },
  ],
  GroupedQueryAttention: [
    { key: "d_model", label: "d_model", kind: "int", min: 1 },
    { key: "num_heads", label: "num_heads", kind: "int", min: 1 },
    { key: "num_kv_heads", label: "num_kv_heads", kind: "int", min: 1 },
    { key: "causal", label: "causal", kind: "bool" },
    { key: "dropout", label: "dropout", kind: "float", min: 0, max: 0.999, step: 0.01 },
  ],
  MultiQueryAttention: [
    { key: "d_model", label: "d_model", kind: "int", min: 1 },
    { key: "num_heads", label: "num_heads", kind: "int", min: 1 },
    { key: "causal", label: "causal", kind: "bool" },
    { key: "dropout", label: "dropout", kind: "float", min: 0, max: 0.999, step: 0.01 },
  ],
  CrossAttention: [
    { key: "d_model", label: "d_model", kind: "int", min: 1 },
    { key: "num_heads", label: "num_heads", kind: "int", min: 1 },
    { key: "causal", label: "causal", kind: "bool" },
    { key: "dropout", label: "dropout", kind: "float", min: 0, max: 0.999, step: 0.01 },
  ],
  ScaledDotProductAttention: [
    { key: "d_model", label: "d_model", kind: "int", min: 1 },
    { key: "num_heads", label: "num_heads", kind: "int", min: 1 },
    { key: "num_kv_heads", label: "num_kv_heads", kind: "int", min: 1 },
    { key: "causal", label: "causal", kind: "bool" },
    { key: "dropout", label: "dropout", kind: "float", min: 0, max: 0.999, step: 0.01 },
  ],
  FlashAttention: [
    { key: "d_model", label: "d_model", kind: "int", min: 1 },
    { key: "num_heads", label: "num_heads", kind: "int", min: 1 },
    { key: "num_kv_heads", label: "num_kv_heads", kind: "int", min: 1 },
    { key: "causal", label: "causal", kind: "bool" },
    { key: "dropout", label: "dropout", kind: "float", min: 0, max: 0.999, step: 0.01 },
  ],
  LinearAttention: [
    { key: "d_model", label: "d_model", kind: "int", min: 1 },
    { key: "num_heads", label: "num_heads", kind: "int", min: 1 },
    { key: "num_kv_heads", label: "num_kv_heads", kind: "int", min: 1 },
    { key: "causal", label: "causal", kind: "bool", help: "Fused kernel runs on CPU; causal masking is applied there." },
    { key: "dropout", label: "dropout", kind: "float", min: 0, max: 0.999, step: 0.01 },
  ],
  AdditiveAttention: [
    { key: "d_model", label: "d_model", kind: "int", min: 1 },
    { key: "num_heads", label: "num_heads", kind: "int", min: 1 },
    { key: "num_kv_heads", label: "num_kv_heads", kind: "int", min: 1 },
    { key: "causal", label: "causal", kind: "bool" },
    { key: "dropout", label: "dropout", kind: "float", min: 0, max: 0.999, step: 0.01 },
  ],
  PreNormTransformerBlock: [
    { key: "d_model", label: "d_model", kind: "int", min: 1 },
    { key: "num_heads", label: "num_heads", kind: "int", min: 1 },
    { key: "mlp_ratio", label: "mlp_ratio", kind: "int", min: 1 },
    { key: "dropout", label: "dropout", kind: "float", min: 0, max: 0.999, step: 0.01 },
    { key: "causal", label: "causal", kind: "bool" },
  ],
  MLP: [
    { key: "d_model", label: "d_model", kind: "int", min: 1 },
    { key: "in_features", label: "in_features (alias)", kind: "int", min: 1 },
    { key: "hidden_features", label: "hidden_features", kind: "int", min: 1 },
    { key: "hidden_dim", label: "hidden_dim (alias)", kind: "int", min: 1 },
    { key: "dropout", label: "dropout", kind: "float", min: 0, max: 0.999, step: 0.01 },
  ],
  FeedForward: [
    { key: "d_model", label: "d_model", kind: "int", min: 1 },
    { key: "in_features", label: "in_features (alias)", kind: "int", min: 1 },
    { key: "hidden_features", label: "hidden_features", kind: "int", min: 1 },
    { key: "hidden_dim", label: "hidden_dim (alias)", kind: "int", min: 1 },
    { key: "dropout", label: "dropout", kind: "float", min: 0, max: 0.999, step: 0.01 },
  ],
  SwiGLU: [
    { key: "d_model", label: "d_model", kind: "int", min: 1 },
    { key: "hidden_features", label: "hidden_features", kind: "int", min: 1 },
    { key: "hidden_dim", label: "hidden_dim (alias)", kind: "int", min: 1 },
  ],
  LearnedPositionEmbedding: [
    { key: "d_model", label: "d_model", kind: "int", min: 1 },
    { key: "max_seq_len", label: "max_seq_len", kind: "int", min: 1 },
  ],
  SinusoidalPositionEmbedding: [{ key: "d_model", label: "d_model", kind: "int", min: 1 }],
  RotaryPositionEmbedding: [
    { key: "d_model", label: "d_model", kind: "int", min: 1 },
    {
      key: "num_heads",
      label: "num_heads",
      kind: "int",
      min: 1,
      help: "d_model / num_heads must be an even head width.",
    },
    { key: "base", label: "base", kind: "float", min: 1, step: 100 },
  ],
  LayerScale: [
    { key: "d_model", label: "d_model", kind: "int", min: 1 },
    { key: "init_value", label: "init_value", kind: "float", min: 0, step: 1e-6 },
  ],
  VisionTransformerBlock: [
    { key: "d_model", label: "d_model", kind: "int", min: 1 },
    { key: "num_heads", label: "num_heads", kind: "int", min: 1 },
    { key: "mlp_ratio", label: "mlp_ratio", kind: "float", min: 0.01, step: 0.5 },
    { key: "dropout", label: "dropout", kind: "float", min: 0, max: 0.999, step: 0.01 },
    { key: "causal", label: "causal", kind: "bool" },
  ],
  TransformerEncoder: [
    { key: "d_model", label: "d_model", kind: "int", min: 1 },
    { key: "num_layers", label: "num_layers", kind: "int", min: 1 },
    { key: "num_heads", label: "num_heads", kind: "int", min: 1 },
    { key: "mlp_ratio", label: "mlp_ratio", kind: "float", min: 0.01, step: 0.5 },
    { key: "dropout", label: "dropout", kind: "float", min: 0, max: 0.999, step: 0.01 },
    { key: "causal", label: "causal", kind: "bool" },
    { key: "norm_first", label: "norm_first", kind: "bool" },
    { key: "final_norm", label: "final_norm", kind: "bool" },
  ],
  PatchEmbedding: [
    { key: "in_channels", label: "in_channels", kind: "int", min: 1 },
    { key: "d_model", label: "d_model", kind: "int", min: 1 },
    { key: "embed_dim", label: "embed_dim (alias)", kind: "int", min: 1 },
    { key: "patch_size", label: "patch_size", kind: "int", min: 1 },
  ],
  ClassToken: [
    { key: "d_model", label: "d_model", kind: "int", min: 1 },
    { key: "embed_dim", label: "embed_dim (alias)", kind: "int", min: 1 },
    { key: "num_tokens", label: "num_tokens", kind: "int", min: 1 },
  ],
  SelectToken: [
    { key: "index", label: "index", kind: "int", help: "0 selects the [CLS] token." },
    { key: "dim", label: "dim", kind: "int", help: "Sequence dimension, usually -2." },
  ],
  MeanPool: [
    { key: "dim", label: "dim", kind: "int", help: "Sequence dimension, usually -2." },
  ],
  // GlobalAveragePool takes no config: it always pools the spatial map to 1x1.
};

const DEFAULTS: Record<string, Record<string, unknown>> = {
  Input: { shape: [128] },
  Linear: { in_features: 128, out_features: 128, bias: true },
  AutoLinear: { out_features: 128, bias: true },
  LMHead: { in_features: 128, vocab_size: 256, bias: false },
  Embedding: { num_embeddings: 1000, embedding_dim: 128 },
  TokenEmbedding: { vocab_size: 1000, d_model: 128 },
  LayerNorm: { normalized_shape: 512, eps: 1e-5 },
  RMSNorm: { normalized_shape: 512, eps: 1e-6 },
  BatchNorm1d: { num_features: 128 },
  BatchNorm2d: { num_features: 16 },
  GroupNorm: { num_groups: 8, num_channels: 16 },
  Dropout: { p: 0.1 },
  Softmax: { dim: -1 },
  Concat: { dim: -1 },
  Reshape: { shape: [-1] },
  Flatten: { start_dim: 1, end_dim: -1 },
  Conv2d: { in_channels: 3, out_channels: 16, kernel_size: 3, stride: 1, padding: 0, bias: true },
  MaxPool2d: { kernel_size: 2, stride: 2, padding: 0 },
  AvgPool2d: { kernel_size: 2, stride: 2, padding: 0 },
  AdaptiveAvgPool2d: { output_size: 1 },
  PatchEmbedding: { in_channels: 3, d_model: 768, patch_size: 16 },
  ClassToken: { d_model: 768, num_tokens: 1 },
  SelectToken: { index: 0, dim: -2 },
  MeanPool: { dim: -2 },
  MultiHeadAttention: { d_model: 512, num_heads: 8, dropout: 0 },
  CausalSelfAttention: { d_model: 512, num_heads: 8, dropout: 0 },
  GroupedQueryAttention: { d_model: 512, num_heads: 8, num_kv_heads: 2, causal: true, dropout: 0 },
  MultiQueryAttention: { d_model: 512, num_heads: 8, causal: true, dropout: 0 },
  CrossAttention: { d_model: 512, num_heads: 8, causal: false, dropout: 0 },
  ScaledDotProductAttention: { d_model: 512, num_heads: 8, causal: false, dropout: 0 },
  FlashAttention: { d_model: 512, num_heads: 8, causal: false, dropout: 0 },
  LinearAttention: { d_model: 512, num_heads: 8, causal: false, dropout: 0 },
  AdditiveAttention: { d_model: 512, num_heads: 8, causal: false, dropout: 0 },
  RotaryPositionEmbedding: { d_model: 512, num_heads: 8, base: 10000 },
  VisionTransformerBlock: { d_model: 768, num_heads: 12, mlp_ratio: 4, dropout: 0, causal: false },
  TransformerEncoder: {
    d_model: 768,
    // The backend builds 12 layers by default; a dropped node starts small so the
    // canvas stays responsive while the shape still matches the ViT block default.
    num_layers: 2,
    num_heads: 12,
    mlp_ratio: 4,
    dropout: 0,
    causal: false,
    norm_first: false,
    final_norm: true,
  },
  PreNormTransformerBlock: { d_model: 512, num_heads: 8, mlp_ratio: 4, dropout: 0, causal: false },
  MLP: { d_model: 128, dropout: 0 },
  FeedForward: { d_model: 128, dropout: 0 },
  SwiGLU: { d_model: 128 },
  LearnedPositionEmbedding: { d_model: 128, max_seq_len: 2048 },
  SinusoidalPositionEmbedding: { d_model: 128 },
  LayerScale: { d_model: 128, init_value: 1e-5 },
  Architecture: {
    architecture: "mlp",
    config: { input_dim: 24, output_dim: 10, hidden_dims: [64, 32] },
  },
};

export function defaultConfigForType(
  typeName: string,
  catalog?: CatalogNode,
): Record<string, unknown> {
  if (typeName === "Quantizer") {
    const field = catalog?.config_fields?.find((item) => item.name === "dtype");
    return { dtype: field?.default ?? "int8" };
  }
  return structuredClone(DEFAULTS[typeName] ?? {});
}

export function fieldsForNode(
  typeName: string,
  config: Record<string, unknown>,
  catalog?: CatalogNode,
  architectureNames: string[] = [],
): ConfigField[] {
  if (typeName === "Quantizer" && catalog?.config_fields?.length) {
    return catalog.config_fields.map((field) => ({
      key: field.name,
      label: field.label,
      kind: field.type === "select" ? "select" : "string",
      options: field.options,
    }));
  }
  if (typeName === "Architecture") {
    const selected =
      typeof config.architecture === "string" ? config.architecture : "mlp";
    return [
      {
        key: "architecture",
        label: "architecture",
        kind: "select",
        options: architectureNames.map((name) => ({ label: name, value: name })),
      },
      ...(ARCHITECTURE_FIELDS[selected] ?? []),
    ];
  }
  return FIELDS_BY_TYPE[typeName] ?? [];
}

export function parseIntList(value: string): number[] | null {
  const parts = value
    .split(/[,\s]+/)
    .map((part) => part.trim())
    .filter(Boolean);
  if (parts.length === 0) return null;
  const nums = parts.map((part) => Number(part));
  if (nums.some((n) => !Number.isInteger(n))) return null;
  return nums;
}

export function formatIntList(value: unknown): string {
  if (Array.isArray(value)) return value.join(", ");
  return "";
}

export function getNestedConfig(config: Record<string, unknown>): Record<string, unknown> {
  const nested = config.config;
  if (nested && typeof nested === "object" && !Array.isArray(nested)) {
    return nested as Record<string, unknown>;
  }
  return {};
}

export function setConfigValue(
  config: Record<string, unknown>,
  field: ConfigField,
  value: unknown,
): Record<string, unknown> {
  if (field.nestedPath === "config") {
    return {
      ...config,
      config: {
        ...getNestedConfig(config),
        [field.key]: value,
      },
    };
  }
  return { ...config, [field.key]: value };
}

export function readConfigValue(
  config: Record<string, unknown>,
  field: ConfigField,
): unknown {
  if (field.nestedPath === "config") {
    return getNestedConfig(config)[field.key];
  }
  return config[field.key];
}

export function architectureDefaults(name: string): Record<string, unknown> {
  switch (name) {
    case "decoder_transformer_lm":
      return {
        vocab_size: 256,
        d_model: 64,
        num_layers: 2,
        num_heads: 4,
        max_seq_len: 128,
        dropout: 0,
        tie_embeddings: true,
      };
    case "vit_classifier":
      return {
        image_size: 32,
        patch_size: 8,
        in_channels: 3,
        num_classes: 10,
        d_model: 128,
        num_layers: 2,
        num_heads: 4,
        mlp_ratio: 4,
        dropout: 0,
      };
    case "cnn_classifier":
      return { in_channels: 3, num_classes: 10, base_channels: 32, dropout: 0 };
    case "mlp":
    default:
      return { input_dim: 24, output_dim: 10, hidden_dims: [64, 32], dropout: 0, activation: "gelu" };
  }
}

/* ------------------------------------------------------------------ *
 * Local config validation
 *
 * `localConfigIssues` mirrors `validate_graph` in thinknet_backend_core.py
 * so the canvas flags a bad config before a compile round-trip. The mirror
 * is only correct while it reads the *same* fallbacks: the backend resolves
 * an absent key to its own default, so a missing key must never be reported
 * here. Keep the messages in sync with the backend wording.
 * ------------------------------------------------------------------ */

const SEQUENCE_ATTENTION_TYPES = new Set([
  "MultiHeadAttention",
  "CausalSelfAttention",
  "GroupedQueryAttention",
  "MultiQueryAttention",
]);
const KERNEL_ATTENTION_TYPES = new Set([
  "ScaledDotProductAttention",
  "FlashAttention",
  "LinearAttention",
  "AdditiveAttention",
]);
const BLOCK_ATTENTION_TYPES = new Set([
  "VisionTransformerBlock",
  "TransformerEncoder",
  "CrossAttention",
]);

/** Value for the first key present, else `fallback`; non-numbers become NaN. */
function numericConfig(
  config: Record<string, unknown>,
  keys: string[],
  fallback: number,
): number {
  for (const key of keys) {
    const value = config[key];
    if (value === undefined || value === null) continue;
    return typeof value === "number" ? value : Number.NaN;
  }
  return fallback;
}

/** Like `numericConfig` but distinguishes "absent" from "present and invalid". */
function optionalNumeric(
  config: Record<string, unknown>,
  key: string,
): number | undefined {
  const value = config[key];
  if (value === undefined || value === null) return undefined;
  return typeof value === "number" ? value : Number.NaN;
}

function dimensionList(value: unknown, fallback: number): number[] {
  if (Array.isArray(value)) {
    return value.map((item) => (typeof item === "number" ? item : Number.NaN));
  }
  if (value === undefined || value === null) return [fallback];
  return [typeof value === "number" ? value : Number.NaN];
}

const isCount = (value: number): boolean => Number.isInteger(value) && value >= 1;

export function localConfigIssues(
  typeName: string,
  config: Record<string, unknown>,
): string[] {
  const issues: string[] = [];
  if (typeName === "Input") {
    const shape = config.shape;
    if (!Array.isArray(shape) || shape.length === 0) {
      issues.push("shape must be a non-empty list of sample dimensions.");
    } else if (shape.some((d) => !Number.isInteger(d) || d === 0 || d < -1)) {
      issues.push("dimensions must be positive integers; -1 is allowed for one variable dimension.");
    } else if (shape.filter((d) => d === -1).length > 1) {
      issues.push("shape may contain at most one -1 dimension.");
    }
  }
  if (typeName === "Reshape") {
    const shape = config.shape;
    if (
      !Array.isArray(shape)
      || shape.length === 0
      || shape.some((d) => !Number.isInteger(d) || d === 0 || d < -1)
      || shape.filter((d) => d === -1).length > 1
    ) {
      issues.push("shape must be a non-empty list of non-zero integers with at most one -1.");
    }
  }

  const headsSection =
    SEQUENCE_ATTENTION_TYPES.has(typeName)
    || KERNEL_ATTENTION_TYPES.has(typeName)
    || BLOCK_ATTENTION_TYPES.has(typeName)
    || typeName === "RotaryPositionEmbedding";

  if (headsSection) {
    const width = numericConfig(config, ["d_model"], 512);
    const heads = numericConfig(config, ["num_heads"], 8);
    const headWidth = width % heads === 0 ? width / heads : Number.NaN;
    const widthBad =
      !Number.isInteger(width) || !Number.isInteger(heads) || width < 1 || heads < 1 || width % heads !== 0;

    if (widthBad && typeName !== "RotaryPositionEmbedding") {
      issues.push("d_model must be divisible by num_heads.");
    }

    if (typeName === "RotaryPositionEmbedding") {
      // The backend reports one combined problem for an unusable head geometry.
      if (widthBad || headWidth % 2 !== 0) {
        issues.push("RoPE needs d_model divisible by num_heads with an even head width.");
      }
    } else if (typeName === "GroupedQueryAttention") {
      const kv = numericConfig(config, ["num_kv_heads"], 2);
      if (!Number.isInteger(kv) || kv < 1 || heads % kv !== 0) {
        issues.push("num_heads must be divisible by num_kv_heads.");
      }
    } else if (KERNEL_ATTENTION_TYPES.has(typeName)) {
      const kv = optionalNumeric(config, "num_kv_heads");
      if (kv !== undefined && (Number.isNaN(kv) || kv < 1 || heads % kv !== 0)) {
        issues.push("num_heads must be divisible by num_kv_heads.");
      }
    }

    if (BLOCK_ATTENTION_TYPES.has(typeName)) {
      const ratio = numericConfig(config, ["mlp_ratio"], 4);
      if (Number.isNaN(ratio) || ratio <= 0) {
        issues.push("mlp_ratio must be a positive number.");
      }
      if (typeName === "TransformerEncoder") {
        const layers = numericConfig(config, ["num_layers"], 2);
        if (!Number.isInteger(layers) || layers < 1) {
          issues.push("num_layers must be a positive integer.");
        }
      }
    }
  }

  if (typeName === "Conv2d") {
    const dims = [
      numericConfig(config, ["in_channels"], 3),
      numericConfig(config, ["out_channels"], 16),
      ...dimensionList(config.kernel_size, 3),
    ];
    if (dims.some((value) => !isCount(value))) {
      issues.push("Conv2d channels and kernel size must be positive integers.");
    }
  }

  if (typeName === "MaxPool2d" || typeName === "AvgPool2d") {
    const kernel = optionalNumeric(config, "kernel_size");
    const stride = optionalNumeric(config, "stride") ?? kernel ?? 2;
    const dims = [...dimensionList(kernel, 2), ...dimensionList(stride, 2)];
    if (dims.some((value) => !isCount(value))) {
      issues.push(`${typeName} kernel size and stride must be positive integers.`);
    }
  }

  if (typeName === "AdaptiveAvgPool2d") {
    const dims = dimensionList(config.output_size, 1);
    if (dims.length === 0 || dims.some((value) => !isCount(value))) {
      issues.push("output_size must be a positive integer or a pair of them.");
    }
  }

  if (typeName === "BatchNorm2d") {
    const features = numericConfig(config, ["num_features", "num_channels"], 16);
    if (!isCount(features)) {
      issues.push("num_features must be a positive integer.");
    }
  }

  if (typeName === "GroupNorm") {
    const groups = numericConfig(config, ["num_groups"], 8);
    const channels = numericConfig(config, ["num_channels"], 16);
    if (!isCount(groups) || !isCount(channels) || channels % groups !== 0) {
      issues.push("num_channels must be divisible by num_groups.");
    }
  }

  if (typeName === "PatchEmbedding") {
    const dims = [
      numericConfig(config, ["in_channels"], 3),
      numericConfig(config, ["d_model", "embed_dim"], 768),
      numericConfig(config, ["patch_size"], 16),
    ];
    if (dims.some((value) => !isCount(value))) {
      issues.push("in_channels, d_model and patch_size must be positive integers.");
    }
  }

  if (typeName === "ClassToken") {
    const dims = [
      numericConfig(config, ["d_model", "embed_dim"], 768),
      numericConfig(config, ["num_tokens"], 1),
    ];
    if (dims.some((value) => !isCount(value))) {
      issues.push("d_model and num_tokens must be positive integers.");
    }
  }

  if (typeName === "SelectToken" || typeName === "MeanPool") {
    const keys = typeName === "SelectToken" ? (["index", "dim"] as const) : (["dim"] as const);
    for (const key of keys) {
      const value = numericConfig(config, [key], key === "index" ? 0 : -2);
      if (!Number.isInteger(value)) {
        issues.push(`${key} must be an integer.`);
      }
    }
  }

  if (typeName === "Dropout") {
    const p = numericConfig(config, ["p"], 0.1);
    if (Number.isNaN(p) || p < 0 || p >= 1) {
      issues.push("dropout p must be in [0, 1).");
    }
  }

  return issues;
}

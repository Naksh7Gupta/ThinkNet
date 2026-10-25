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
  ],
  MultiQueryAttention: [
    { key: "d_model", label: "d_model", kind: "int", min: 1 },
    { key: "num_heads", label: "num_heads", kind: "int", min: 1 },
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
  LayerScale: [
    { key: "d_model", label: "d_model", kind: "int", min: 1 },
    { key: "init_value", label: "init_value", kind: "float", min: 0, step: 1e-6 },
  ],
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
  Dropout: { p: 0.1 },
  Softmax: { dim: -1 },
  Concat: { dim: -1 },
  Reshape: { shape: [-1] },
  Flatten: { start_dim: 1, end_dim: -1 },
  Conv2d: { in_channels: 3, out_channels: 16, kernel_size: 3, stride: 1, padding: 0, bias: true },
  MaxPool2d: { kernel_size: 2, stride: 2, padding: 0 },
  MultiHeadAttention: { d_model: 512, num_heads: 8, dropout: 0 },
  CausalSelfAttention: { d_model: 512, num_heads: 8, dropout: 0 },
  GroupedQueryAttention: { d_model: 512, num_heads: 8, num_kv_heads: 2 },
  MultiQueryAttention: { d_model: 512, num_heads: 8 },
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
    if (!Array.isArray(shape) || shape.length === 0) {
      issues.push("Reshape shape must be a non-empty integer list with at most one -1.");
    }
  }
  if (
    typeName === "MultiHeadAttention" ||
    typeName === "CausalSelfAttention" ||
    typeName === "GroupedQueryAttention" ||
    typeName === "MultiQueryAttention"
  ) {
    const width = Number(config.d_model);
    const heads = Number(config.num_heads);
    if (!Number.isInteger(width) || !Number.isInteger(heads) || width < 1 || heads < 1 || width % heads !== 0) {
      issues.push("d_model must be divisible by num_heads.");
    }
  }
  return issues;
}

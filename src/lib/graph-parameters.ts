import type { GraphDef } from "@/types/api";

export type GraphParameterEstimate = {
  parameterCount: number;
  unsupportedNodes: string[];
};

const NON_PARAMETER_TYPES = new Set([
  "Input", "Output", "Identity", "Dropout", "ReLU", "GELU", "SiLU", "Sigmoid",
  "Tanh", "Softmax", "Add", "Multiply", "Concat", "ResidualAdd", "SelectToken",
  "MeanPool", "SinusoidalPositionEmbedding", "RotaryPositionEmbedding",
  "GlobalAveragePool", "MaxPool2d", "AvgPool2d", "AdaptiveAvgPool2d", "Flatten",
  "Reshape",
]);

function count(value: unknown, fallback?: number): number | null {
  const resolved = value === undefined ? fallback : value;
  return typeof resolved === "number" && Number.isSafeInteger(resolved) && resolved > 0
    ? resolved
    : null;
}

function positiveNumber(value: unknown, fallback: number): number | null {
  const resolved = value === undefined ? fallback : value;
  return typeof resolved === "number" && Number.isFinite(resolved) && resolved > 0
    ? resolved
    : null;
}

function pythonRound(value: number): number {
  const floor = Math.floor(value);
  const fraction = value - floor;
  if (fraction < 0.5) return floor;
  if (fraction > 0.5) return floor + 1;
  return floor % 2 === 0 ? floor : floor + 1;
}

function bool(value: unknown, fallback: boolean): boolean {
  return typeof value === "boolean" ? value : fallback;
}

function linear(input: number, output: number, bias: boolean): number {
  return input * output + (bias ? output : 0);
}

function projectedAttention(
  width: number,
  kvHeads: number,
  heads: number,
  additive: boolean,
): number | null {
  if (width % heads !== 0 || heads % kvHeads !== 0) return null;
  const headWidth = width / heads;
  const kvWidth = headWidth * kvHeads;
  return (
    linear(width, width, true) +
    linear(width, kvWidth, false) * 2 +
    linear(width, width, true) +
    (additive ? headWidth : 0)
  );
}

function architectureParameters(config: Record<string, unknown>): number | null {
  const architecture = config.architecture;
  const options = config.config;
  if (typeof architecture !== "string" || !options || typeof options !== "object" || Array.isArray(options)) {
    return null;
  }
  const values = options as Record<string, unknown>;

  if (architecture === "mlp") {
    const input = count(values.input_dim);
    const output = count(values.output_dim);
    const hidden = values.hidden_dims;
    if (input === null || output === null || !Array.isArray(hidden)) return null;
    const widths = hidden.map((value) => count(value));
    if (widths.some((value) => value === null)) return null;
    const layers = [input, ...widths as number[], output];
    return layers.slice(1).reduce((total, width, index) => total + linear(layers[index], width, true), 0);
  }

  if (architecture === "decoder_transformer_lm") {
    const vocab = count(values.vocab_size);
    const width = count(values.d_model, 128);
    const layers = count(values.num_layers, 2);
    const sequence = count(values.max_seq_len, 128);
    if (vocab === null || width === null || layers === null || sequence === null) return null;
    const attention = linear(width, 3 * width, true) + linear(width, width, true);
    const feedForward = linear(width, 4 * width, true) + linear(4 * width, width, true);
    const block = 4 * width + attention + feedForward;
    return (
      vocab * width +
      sequence * width +
      layers * block +
      2 * width +
      (bool(values.tie_embeddings, true) ? 0 : vocab * width)
    );
  }

  if (architecture === "vit_classifier") {
    const image = count(values.image_size, 32);
    const patch = count(values.patch_size, 8);
    const channels = count(values.in_channels, 3);
    const classes = count(values.num_classes, 10);
    const width = count(values.d_model, 128);
    const layers = count(values.num_layers, 2);
    const heads = count(values.num_heads, 4);
    const ratio = count(values.mlp_ratio, 4);
    if ([image, patch, channels, classes, width, layers, heads, ratio].some((value) => value === null)) return null;
    if (image! % patch! !== 0 || width! % heads! !== 0) return null;
    const hidden = width! * ratio!;
    const block = 4 * width! +
      linear(width!, width! * 3, true) +
      linear(width!, width!, true) +
      linear(width!, hidden, true) +
      linear(hidden, width!, true);
    const grid = image! / patch!;
    return (
      channels! * width! * patch! * patch! + width! +
      width! +
      (grid * grid + 1) * width! +
      layers! * block +
      2 * width! +
      linear(width!, classes!, true)
    );
  }

  if (architecture === "cnn_classifier") {
    const channels = count(values.in_channels, 3);
    const classes = count(values.num_classes, 10);
    const base = count(values.base_channels, 32);
    if (channels === null || classes === null || base === null) return null;
    const bn = (width: number) => 2 * width;
    return (
      channels * base * 9 + bn(base) +
      base * base * 9 + bn(base) +
      base * 2 * base * 9 + bn(2 * base) +
      2 * base * 2 * base * 9 + bn(2 * base) +
      linear(2 * base, classes, true)
    );
  }

  return null;
}

function nodeParameters(type: string, config: Record<string, unknown>): number | null {
  const width = count(config.d_model, 512);
  const heads = count(config.num_heads, 8);

  if (type === "Linear") {
    const input = count(config.in_features, 128);
    const output = count(config.out_features, 128);
    return input === null || output === null ? null : linear(input, output, bool(config.bias, true));
  }
  if (type === "LMHead") {
    const input = count(config.in_features, count(config.d_model, 128) ?? undefined);
    const output = count(config.vocab_size, count(config.out_features, 256) ?? undefined);
    return input === null || output === null ? null : linear(input, output, bool(config.bias, false));
  }
  if (type === "Embedding" || type === "TokenEmbedding") {
    const entries = count(config.num_embeddings, count(config.vocab_size, 1000) ?? undefined);
    const embeddingWidth = count(config.embedding_dim, count(config.d_model, 128) ?? undefined);
    return entries === null || embeddingWidth === null ? null : entries * embeddingWidth;
  }
  if (type === "LayerNorm" || type === "RMSNorm" || type === "LayerScale") {
    const size = count(config.normalized_shape, type === "LayerScale" ? count(config.d_model, 128) ?? undefined : 512);
    return size === null ? null : size * (type === "RMSNorm" ? 1 : type === "LayerScale" ? 1 : 2);
  }
  if (type === "BatchNorm1d") {
    const size = count(config.num_features, count(config.features, 128) ?? undefined);
    return size === null ? null : 2 * size;
  }
  if (type === "BatchNorm2d") {
    const size = count(config.num_features, count(config.num_channels, 16) ?? undefined);
    return size === null ? null : 2 * size;
  }
  if (type === "GroupNorm") {
    const size = count(config.num_channels, 16);
    return size === null ? null : 2 * size;
  }
  if (type === "Conv2d") {
    const input = count(config.in_channels, 3);
    const output = count(config.out_channels, 16);
    const kernel = count(config.kernel_size, 3);
    return input === null || output === null || kernel === null
      ? null
      : input * output * kernel * kernel + (bool(config.bias, true) ? output : 0);
  }
  if (type === "MultiHeadAttention" || type === "CausalSelfAttention") {
    return width === null ? null : linear(width, 3 * width, true) + linear(width, width, true);
  }
  if ([
    "CrossAttention", "GroupedQueryAttention", "MultiQueryAttention", "AdditiveAttention",
    "LinearAttention", "ScaledDotProductAttention", "FlashAttention",
  ].includes(type)) {
    const kvHeads = type === "MultiQueryAttention" ? 1
      : count(config.num_kv_heads, type === "GroupedQueryAttention" ? 2 : heads ?? undefined);
    return width === null || heads === null || kvHeads === null
      ? null
      : projectedAttention(width, kvHeads, heads, type === "AdditiveAttention");
  }
  if (type === "PreNormTransformerBlock" || type === "VisionTransformerBlock") {
    const modelWidth = count(config.d_model, type === "VisionTransformerBlock" ? 768 : 512);
    const headCount = count(config.num_heads, type === "VisionTransformerBlock" ? 12 : 8);
    const ratio = type === "VisionTransformerBlock"
      ? positiveNumber(config.mlp_ratio, 4)
      : count(config.mlp_ratio, 4);
    if (modelWidth === null || headCount === null || ratio === null) return null;
    const attention = projectedAttention(modelWidth, headCount, headCount, false);
    const hiddenWidth = type === "VisionTransformerBlock"
      ? pythonRound(modelWidth * ratio)
      : modelWidth * ratio;
    if (!Number.isSafeInteger(hiddenWidth) || hiddenWidth < 1) return null;
    const feedForward = linear(modelWidth, hiddenWidth, true) + linear(hiddenWidth, modelWidth, true);
    return attention === null ? null : 4 * modelWidth + attention + feedForward;
  }
  if (type === "TransformerEncoder") {
    const modelWidth = count(config.d_model, 768);
    const headCount = count(config.num_heads, 12);
    const layers = count(config.num_layers, 12);
    const ratio = positiveNumber(config.mlp_ratio, 4);
    if (modelWidth === null || headCount === null || layers === null || ratio === null) return null;
    const attention = projectedAttention(modelWidth, headCount, headCount, false);
    if (attention === null) return null;
    const normFirst = bool(config.norm_first, false);
    const hiddenWidth = normFirst
      ? modelWidth * Math.trunc(ratio)
      : pythonRound(modelWidth * ratio);
    if (!Number.isSafeInteger(hiddenWidth) || hiddenWidth < 1) return null;
    const feedForward = linear(modelWidth, hiddenWidth, true) + linear(hiddenWidth, modelWidth, true);
    const block = 4 * modelWidth + attention + feedForward;
    return layers * block + (bool(config.final_norm, true) ? 2 * modelWidth : 0);
  }
  if (type === "MLP" || type === "FeedForward") {
    const modelWidth = count(config.d_model, count(config.in_features, 128) ?? undefined);
    if (modelWidth === null) return null;
    const hiddenWidth = count(config.hidden_features, count(config.hidden_dim, modelWidth * 4) ?? undefined);
    return hiddenWidth === null
      ? null
      : linear(modelWidth, hiddenWidth, true) + linear(hiddenWidth, modelWidth, true);
  }
  if (type === "SwiGLU") {
    const modelWidth = count(config.d_model, 128);
    if (modelWidth === null) return null;
    const hiddenWidth = count(config.hidden_features, count(config.hidden_dim, modelWidth * 4) ?? undefined);
    return hiddenWidth === null
      ? null
      : 2 * linear(modelWidth, hiddenWidth, true) + linear(hiddenWidth, modelWidth, true);
  }
  if (type === "LearnedPositionEmbedding") {
    const modelWidth = count(config.d_model, 128);
    const sequenceLength = count(config.max_seq_len, 2048);
    return modelWidth === null || sequenceLength === null ? null : modelWidth * sequenceLength;
  }
  if (type === "PatchEmbedding") {
    const channels = count(config.in_channels, 3);
    const modelWidth = count(config.d_model, count(config.embed_dim, 768) ?? undefined);
    const patch = count(config.patch_size, 16);
    return channels === null || modelWidth === null || patch === null
      ? null
      : channels * modelWidth * patch * patch + modelWidth;
  }
  if (type === "ClassToken") {
    const modelWidth = count(config.d_model, count(config.embed_dim, 768) ?? undefined);
    const tokens = count(config.num_tokens, 1);
    return modelWidth === null || tokens === null ? null : modelWidth * tokens;
  }
  if (type === "Architecture") return architectureParameters(config);
  if (NON_PARAMETER_TYPES.has(type)) return 0;
  return null;
}

export function estimateGraphParameters(graph: GraphDef): GraphParameterEstimate {
  let parameterCount = 0;
  const unsupportedNodes: string[] = [];

  for (const node of graph.nodes) {
    const parameters = nodeParameters(node.type, node.config);
    if (parameters === null || !Number.isSafeInteger(parameterCount + parameters)) {
      unsupportedNodes.push(`${node.id} (${node.type})`);
      continue;
    }
    parameterCount += parameters;
  }

  return { parameterCount, unsupportedNodes };
}

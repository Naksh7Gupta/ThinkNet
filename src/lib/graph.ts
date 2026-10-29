import { MarkerType, type Edge, type Node } from "@xyflow/react";
import type { CatalogNode, GraphDef } from "@/types/api";
import { defaultConfigForType } from "@/lib/node-config";

export const TENSOR_NODE_TYPE = "thinknet";
export const FRAME_NODE_TYPE = "thinknet-frame";
export const MODEL_LOADER_NODE_TYPE = "thinknet-model-loader";
export const QUANTIZER_NODE_TYPE = "thinknet-quantizer";
export const MODEL_TRANSFORM_TYPES = new Set(["Quantizer"]);
export const MODEL_WORKFLOW_TYPES = new Set(["ModelLoader", "Quantizer"]);
export const MODEL_WORKFLOW_NODE_TYPES = new Set([
  MODEL_LOADER_NODE_TYPE,
  QUANTIZER_NODE_TYPE,
]);

export const MODEL_LOADER_CATALOG: CatalogNode = {
  type: "ModelLoader",
  category: "Model workflow",
  status: "implemented-and-tested",
  size: "large",
  width: 280,
  height: 270,
  color: "#38BDF8",
  input_kind: "none",
  output_kind: "model",
  execution_domain: "model-transform",
};

export type ThinkNetNodeData = {
  typeName: string;
  config: Record<string, unknown>;
  catalog?: CatalogNode;
  /** Vertical layout: flow runs bottom to top, skip handles sit on the right. */
  vertical?: boolean;
  /** Diagram caption on the node body; the graph payload always keeps `typeName`. */
  label?: string;
  /** Only used by frame nodes. */
  frameLabel?: string;
  /** How many identical blocks one frame stands for: drawn as a ×N badge. */
  frameCount?: number;
};

export type ThinkNetNode = Node<
  ThinkNetNodeData,
  | typeof TENSOR_NODE_TYPE
  | typeof FRAME_NODE_TYPE
  | typeof MODEL_LOADER_NODE_TYPE
  | typeof QUANTIZER_NODE_TYPE
>;
export type ThinkNetEdge = Edge;

export type NodePositions = Record<string, { x: number; y: number }>;

export type FrameDef = {
  id: string;
  label: string;
  x: number;
  y: number;
  width: number;
  height: number;
  /** Identical blocks folded into this frame; shown as a ×N badge on its left edge. */
  count?: number;
  /**
   * Duplicate node id -> the node drawn in its place. Duplicates stay in the graph
   * and in every export; they are only hidden on the canvas.
   */
  duplicates?: Record<string, string>;
};

export type GraphLayout = {
  graph: GraphDef;
  positions: NodePositions;
  vertical?: boolean;
  frames?: FrameDef[];
};

export type LayoutOptions = Omit<GraphLayout, "graph">;

export function isMergeType(typeName: string): boolean {
  return typeName === "Add" || typeName === "Multiply" || typeName === "ResidualAdd";
}

/**
 * Nodes whose executor consumes two separately named tensors. The backend compiler
 * fails without an edge on both, so the canvas must always expose the second socket.
 */
export function isDualInputType(typeName: string): boolean {
  return typeName === "CrossAttention" || typeName === "Concat";
}

export function isMultiInputType(typeName: string): boolean {
  return isMergeType(typeName) || isDualInputType(typeName);
}

export function toGraphDef(
  name: string,
  nodes: ThinkNetNode[],
  edges: ThinkNetEdge[],
): GraphDef {
  return {
    name: name.trim() || "untitled_architecture",
    nodes: nodes
      .filter((node) => !MODEL_WORKFLOW_NODE_TYPES.has(node.type ?? "") && node.type !== FRAME_NODE_TYPE)
      .map((node) => ({
        id: node.id,
        type: node.data.typeName,
        config: node.data.config ?? {},
      })),
    edges: edges
      // A collapsed ×N block gets a view-only bridge back to the stack tail so the
      // single drawn copy stays connected; the real per-block wiring is still exported.
      .filter(
        (edge) =>
          edge.data?.["synthetic"] !== true &&
          !MODEL_WORKFLOW_NODE_TYPES.has(
            nodes.find((node) => node.id === edge.source)?.type ?? "",
          ) &&
          !MODEL_WORKFLOW_NODE_TYPES.has(
            nodes.find((node) => node.id === edge.target)?.type ?? "",
          ),
      )
      .map((edge) => ({
        source: edge.source,
        target: edge.target,
        source_port: edge.sourceHandle ?? "output",
        target_port: edge.targetHandle ?? "input",
      })),
  };
}

export function createNodeFromCatalog(
  catalog: CatalogNode,
  position: { x: number; y: number },
  id: string,
  diagram = false,
): ThinkNetNode {
  const workflowType =
    catalog.type === "ModelLoader"
      ? MODEL_LOADER_NODE_TYPE
      : catalog.type === "Quantizer"
        ? QUANTIZER_NODE_TYPE
        : null;
  return {
    id,
    type: workflowType ?? TENSOR_NODE_TYPE,
    position,
    style: workflowType
      ? {
          width: catalog.type === "Quantizer" ? 320 : catalog.width,
          minHeight: catalog.type === "Quantizer" ? 360 : catalog.height,
        }
      : nodeSizeFor(catalog.type, catalog, diagram),
    data: {
      typeName: catalog.type,
      config:
        catalog.type === "Quantizer"
          ? { dtype: "float16" }
          : defaultConfigForType(catalog.type, catalog),
      catalog,
    },
  };
}

function edge(
  source: string,
  target: string,
  targetPort = "input",
  sourcePort = "output",
): GraphDef["edges"][number] {
  return { source, target, source_port: sourcePort, target_port: targetPort };
}

export function exampleMlpGraph(): GraphDef {
  return {
    name: "tiny-mlp",
    nodes: [
      { id: "input", type: "Input", config: { shape: [24] } },
      {
        id: "projection",
        type: "Linear",
        config: { in_features: 24, out_features: 10, bias: true },
      },
      { id: "output", type: "Output", config: {} },
    ],
    edges: [edge("input", "projection"), edge("projection", "output")],
  };
}

export function exampleResidualGraph(): GraphDef {
  return {
    name: "residual-block",
    nodes: [
      { id: "input", type: "Input", config: { shape: [4] } },
      { id: "linear1", type: "Linear", config: { in_features: 4, out_features: 4, bias: true } },
      { id: "activation", type: "GELU", config: {} },
      { id: "linear2", type: "Linear", config: { in_features: 4, out_features: 4, bias: true } },
      { id: "residual", type: "ResidualAdd", config: {} },
      { id: "output", type: "Output", config: {} },
    ],
    edges: [
      edge("input", "linear1"),
      edge("linear1", "activation"),
      edge("activation", "linear2"),
      edge("linear2", "residual", "main"),
      edge("input", "residual", "skip"),
      edge("residual", "output"),
    ],
  };
}

export function architectureGraph(name: string): GraphDef {
  switch (name) {
    case "decoder_transformer_lm":
      return {
        name: "decoder_transformer_lm",
        nodes: [
          { id: "input", type: "Input", config: { shape: [32] } },
          {
            id: "model",
            type: "Architecture",
            config: {
              architecture: "decoder_transformer_lm",
              config: {
                vocab_size: 256,
                d_model: 64,
                num_layers: 2,
                num_heads: 4,
                max_seq_len: 128,
                dropout: 0,
                tie_embeddings: true,
              },
            },
          },
          { id: "output", type: "Output", config: {} },
        ],
        edges: [edge("input", "model"), edge("model", "output")],
      };
    case "vit_classifier":
      return {
        name: "vit_classifier",
        nodes: [
          { id: "input", type: "Input", config: { shape: [3, 32, 32] } },
          {
            id: "model",
            type: "Architecture",
            config: {
              architecture: "vit_classifier",
              config: {
                image_size: 32,
                patch_size: 8,
                in_channels: 3,
                num_classes: 10,
                d_model: 128,
                num_layers: 2,
                num_heads: 4,
                mlp_ratio: 4,
                dropout: 0,
              },
            },
          },
          { id: "output", type: "Output", config: {} },
        ],
        edges: [edge("input", "model"), edge("model", "output")],
      };
    case "cnn_classifier":
      return {
        name: "cnn_classifier",
        nodes: [
          { id: "input", type: "Input", config: { shape: [3, 32, 32] } },
          {
            id: "model",
            type: "Architecture",
            config: {
              architecture: "cnn_classifier",
              config: { in_channels: 3, num_classes: 10, base_channels: 32, dropout: 0 },
            },
          },
          { id: "output", type: "Output", config: {} },
        ],
        edges: [edge("input", "model"), edge("model", "output")],
      };
    case "mlp":
    default:
      return {
        name: "mlp-architecture",
        nodes: [
          { id: "input", type: "Input", config: { shape: [24] } },
          {
            id: "model",
            type: "Architecture",
            config: {
              architecture: "mlp",
              config: { input_dim: 24, output_dim: 10, hidden_dims: [64, 32], dropout: 0, activation: "gelu" },
            },
          },
          { id: "output", type: "Output", config: {} },
        ],
        edges: [edge("input", "model"), edge("model", "output")],
      };
  }
}

/**
 * Pre-norm decoder-only Transformer built from individual components,
 * laid out bottom-to-top like the classic decoder-block diagram:
 * one dashed frame carrying a ×N badge for the repeated blocks, with the
 * residual skips looping back down on the right.
 */
export function decoderComponentGraph(numLayers = 2): GraphLayout {
  const layers = Math.max(1, Math.floor(numLayers));
  const vocab = 256;
  const dModel = 64;
  const heads = 4;
  const seq = 32;
  const maxSeq = 128;
  const hidden = dModel * 4;

  const stack = createComponentStack();
  const edges: GraphDef["edges"] = [];

  stack.add("input", "Input", { shape: [seq] });
  stack.add("token_embedding", "TokenEmbedding", { vocab_size: vocab, d_model: dModel });
  stack.add("position_embedding", "LearnedPositionEmbedding", { d_model: dModel, max_seq_len: maxSeq });
  edges.push(edge("input", "token_embedding"), edge("token_embedding", "position_embedding"));

  let previous = "position_embedding";

  for (let i = 1; i <= layers; i += 1) {
    const p = `block${i}`;
    if (i > 1) stack.aliasGroup(p, "block1");
    const first = stack.add(`${p}_ln1`, "LayerNorm", { normalized_shape: dModel }, FRAME_GAP);
    stack.add(`${p}_attention`, "CausalSelfAttention", { d_model: dModel, num_heads: heads, dropout: 0 });
    stack.add(`${p}_add1`, "ResidualAdd", {});
    stack.add(`${p}_ln2`, "LayerNorm", { normalized_shape: dModel });
    stack.add(`${p}_ffn`, "FeedForward", { d_model: dModel, hidden_features: hidden, dropout: 0 });
    const last = stack.add(`${p}_add2`, "ResidualAdd", {});
    if (i === 1) {
      stack.frame("frame_block1", "Decoder Block", last.top, first.bottom, {
        count: layers,
        group: "block1",
      });
    }

    edges.push(
      edge(previous, `${p}_ln1`),
      edge(`${p}_ln1`, `${p}_attention`),
      edge(`${p}_attention`, `${p}_add1`, "main"),
      edge(previous, `${p}_add1`, "skip", "skip_out"),
      edge(`${p}_add1`, `${p}_ln2`),
      edge(`${p}_ln2`, `${p}_ffn`),
      edge(`${p}_ffn`, `${p}_add2`, "main"),
      edge(`${p}_add1`, `${p}_add2`, "skip", "skip_out"),
    );
    previous = `${p}_add2`;
  }

  stack.add("final_norm", "LayerNorm", { normalized_shape: dModel }, FRAME_GAP);
  stack.add("lm_head", "LMHead", { in_features: dModel, vocab_size: vocab, bias: false });
  stack.add("output", "Output", {});
  edges.push(
    edge(previous, "final_norm"),
    edge("final_norm", "lm_head"),
    edge("lm_head", "output"),
  );

  return {
    graph: { name: `decoder_components_${layers}_block`, nodes: stack.nodes, edges },
    ...stack.finish(),
    vertical: true,
  };
}

/**
 * Bottom-to-top column shared by every component template. Nodes are appended
 * upward in data-flow order, each recorded span becomes a dashed frame, and the
 * finished stack is shifted so its topmost node sits near the canvas origin.
 *
 * Spacing comes from the footprint the canvas actually renders
 * ({@link diagramSize}), so a stack of twenty layers is as tight on screen as
 * the single box it occupies in the graph.
 */
function createComponentStack() {
  const nodes: GraphDef["nodes"] = [];
  const positions: NodePositions = {};
  const spans: Array<{
    id: string;
    label: string;
    top: number;
    bottom: number;
    count?: number;
    group?: string;
  }> = [];
  /** Duplicate id -> the node drawn in its place, e.g. `block3_ln1` -> `block1_ln1`. */
  const duplicates = new Map<string, string>();
  const aliasGroups = new Map<string, string>();
  let cursor: number | null = null;

  /** `block2` before `block1`: the group is drawn once and badged ×N instead. */
  const aliasGroup = (group: string, twin: string) => {
    aliasGroups.set(group, twin);
  };

  const groupOf = (id: string) => {
    const at = id.indexOf("_");
    return at === -1 ? id : id.slice(0, at);
  };

  const add = (
    id: string,
    type: string,
    config: Record<string, unknown> = {},
    gapBefore = VERTICAL_GAP,
  ) => {
    const { width, height } = diagramSize(type);
    const twinGroup = aliasGroups.get(groupOf(id));
    const twin = twinGroup ? `${twinGroup}${id.slice(groupOf(id).length)}` : undefined;
    // A duplicate takes no vertical space at all: its twin is the one on screen.
    const bottom = cursor === null || twin ? (cursor ?? 0) : cursor - gapBefore;
    const top = twin ? bottom : bottom - height;
    nodes.push({ id, type, config });
    positions[id] = { x: VERTICAL_COLUMN_X + (VERTICAL_COLUMN_WIDTH - width) / 2, y: top };
    if (twin) duplicates.set(id, twin);
    cursor = top;
    return { top, bottom };
  };

  /**
   * Draws one dashed frame around `top`..`bottom`. `repeat` folds N identical
   * blocks into this single frame: the frame gets a ×N badge and the other N-1
   * copies stay in the graph but off the canvas.
   */
  const frame = (
    id: string,
    label: string,
    top: number,
    bottom: number,
    repeat?: { count: number; group: string },
  ) => {
    spans.push({
      id,
      label,
      top,
      bottom,
      count: repeat?.count,
      group: repeat?.group,
    });
  };

  const finish = (): { positions: NodePositions; frames: FrameDef[] } => {
    const laid = { ...positions };
    const visibleYs = Object.entries(laid)
      .filter(([id]) => !duplicates.has(id))
      .map(([, position]) => position.y);
    const shift = STACK_TOP - Math.min(...visibleYs);
    for (const [id, position] of Object.entries(laid)) {
      // A duplicate lands exactly on its twin; it is hidden, so nothing overlaps.
      const twin = duplicates.get(id);
      const base = (twin ? laid[twin] : undefined) ?? position;
      positions[id] = { x: base.x, y: base.y + shift };
    }

    return {
      positions,
      frames: spans.map((span) => {
        const count = span.count && span.count > 1 ? span.count : undefined;
        // The span's group names the drawn copy, so match on the twin side.
        const folded = count
          ? [...duplicates.entries()].filter(([, twin]) => groupOf(twin) === span.group)
          : [];
        return {
          id: span.id,
          label: span.label,
          x: VERTICAL_COLUMN_X - FRAME_PAD_LEFT,
          y: span.top + shift - FRAME_PAD_TOP,
          width: VERTICAL_COLUMN_WIDTH + FRAME_PAD_LEFT + FRAME_PAD_RIGHT,
          height: span.bottom - span.top + FRAME_PAD_TOP + FRAME_PAD_BOTTOM,
          ...(count ? { count } : {}),
          ...(folded.length ? { duplicates: Object.fromEntries(folded) } : {}),
        };
      }),
    };
  };

  return { nodes, add, frame, finish, aliasGroup };
}

/** Four conv stages of a plain CNN: channels double on stages 3-4, pooling on 2 and 4. */
const CNN_STAGES = [
  { scale: 1, pooled: false },
  { scale: 1, pooled: true },
  { scale: 2, pooled: false },
  { scale: 2, pooled: true },
];

/**
 * LeNet-style CNN classifier assembled from primitive nodes — Conv2d, BatchNorm2d,
 * GELU, MaxPool2d, pooling and a linear head — with no `Architecture` node anywhere.
 * Mirrors the graph proven by `tests/backend/test_cnn_components.py`.
 */
export function cnnComponentGraph(options?: {
  channels?: number;
  classes?: number;
  image?: number;
  dropout?: number;
}): GraphLayout {
  const inChannels = 3;
  const base = options?.channels ?? 8;
  const classes = options?.classes ?? 10;
  const image = options?.image ?? 32;

  const stack = createComponentStack();
  const edges: GraphDef["edges"] = [];

  stack.add("input", "Input", { shape: [inChannels, image, image] });
  let previous = "input";
  let channels = inChannels;

  CNN_STAGES.forEach((stage, index) => {
    const p = `stage${index + 1}`;
    const out = base * stage.scale;
    const conv = stack.add(
      `${p}_conv`,
      "Conv2d",
      {
        in_channels: channels,
        out_channels: out,
        kernel_size: 3,
        stride: 1,
        padding: 1,
        bias: false,
      },
      FRAME_GAP,
    );
    let last = stack.add(`${p}_norm`, "BatchNorm2d", { num_features: out });
    last = stack.add(`${p}_act`, "GELU", {});
    if (stage.pooled) {
      last =       stack.add(`${p}_pool`, "MaxPool2d", { kernel_size: 2, stride: 2 });
    }
    // Every stage has its own width and pooling, so none of them can be folded.
    stack.frame(`frame_${p}`, `Conv Block ${index + 1}`, last.top, conv.bottom);

    edges.push(
      edge(previous, `${p}_conv`),
      edge(`${p}_conv`, `${p}_norm`),
      edge(`${p}_norm`, `${p}_act`),
    );
    previous = `${p}_act`;
    if (stage.pooled) {
      edges.push(edge(`${p}_act`, `${p}_pool`));
      previous = `${p}_pool`;
    }
    channels = out;
  });

  stack.add("pool", "AdaptiveAvgPool2d", { output_size: 1 }, FRAME_GAP);
  stack.add("flatten", "Flatten", { start_dim: 1, end_dim: -1 });
  stack.add("dropout", "Dropout", { p: options?.dropout ?? 0.1 });
  stack.add("head", "Linear", { in_features: channels, out_features: classes });
  stack.add("output", "Output", {});
  edges.push(
    edge(previous, "pool"),
    edge("pool", "flatten"),
    edge("flatten", "dropout"),
    edge("dropout", "head"),
    edge("head", "output"),
  );

  return {
    graph: { name: "cnn_classifier_components", nodes: stack.nodes, edges },
    ...stack.finish(),
    vertical: true,
  };
}

/**
 * Vision Transformer assembled token-op by token-op: patch embedding, [CLS] token,
 * learned positions, then pre-block post-norm transformer blocks with residual
 * skips, a readout and a linear head. No `Architecture` node. Mirrors
 * `tests/backend/test_vit_components.py`.
 */
export function vitComponentGraph(
  numBlocks = 2,
  options?: { classes?: number; dModel?: number; heads?: number; readout?: "cls" | "mean" },
): GraphLayout {
  const blocks = Math.max(1, Math.floor(numBlocks));
  const image = 16;
  const patch = 4;
  const inChannels = 3;
  const dModel = options?.dModel ?? 16;
  const heads = options?.heads ?? 4;
  const classes = options?.classes ?? 10;
  const readout = options?.readout ?? "cls";
  // Patches plus the prepended [CLS] token size the positional table.
  const tokens = (image / patch) ** 2 + 1;

  const stack = createComponentStack();
  const edges: GraphDef["edges"] = [];

  stack.add("input", "Input", { shape: [inChannels, image, image] });
  stack.add("patch", "PatchEmbedding", {
    in_channels: inChannels,
    d_model: dModel,
    patch_size: patch,
  });
  stack.add("cls", "ClassToken", { d_model: dModel, num_tokens: 1 });
  stack.add("position", "LearnedPositionEmbedding", { d_model: dModel, max_seq_len: tokens });
  edges.push(
    edge("input", "patch"),
    edge("patch", "cls"),
    edge("cls", "position"),
  );

  let previous = "position";
  for (let i = 1; i <= blocks; i += 1) {
    const p = `block${i}`;
    if (i > 1) stack.aliasGroup(p, "block1");
    const first = stack.add(`${p}_ln1`, "LayerNorm", { normalized_shape: dModel }, FRAME_GAP);
    stack.add(`${p}_attention`, "MultiHeadAttention", { d_model: dModel, num_heads: heads });
    stack.add(`${p}_add1`, "ResidualAdd", {});
    stack.add(`${p}_ln2`, "LayerNorm", { normalized_shape: dModel });
    stack.add(`${p}_ffn`, "MLP", { d_model: dModel, hidden_features: dModel * 4 });
    const last = stack.add(`${p}_add2`, "ResidualAdd", {});
    if (i === 1) {
      stack.frame("frame_block1", "Transformer Block", last.top, first.bottom, {
        count: blocks,
        group: "block1",
      });
    }

    edges.push(
      edge(previous, `${p}_ln1`),
      edge(`${p}_ln1`, `${p}_attention`),
      edge(`${p}_attention`, `${p}_add1`, "main"),
      edge(previous, `${p}_add1`, "skip", "skip_out"),
      edge(`${p}_add1`, `${p}_ln2`),
      edge(`${p}_ln2`, `${p}_ffn`),
      edge(`${p}_ffn`, `${p}_add2`, "main"),
      edge(`${p}_add1`, `${p}_add2`, "skip", "skip_out"),
    );
    previous = `${p}_add2`;
  }

  stack.add("final_norm", "LayerNorm", { normalized_shape: dModel }, FRAME_GAP);
  if (readout === "cls") {
    stack.add("readout", "SelectToken", { index: 0, dim: -2 });
  } else {
    stack.add("readout", "MeanPool", { dim: -2 });
  }
  stack.add("head", "Linear", { in_features: dModel, out_features: classes });
  stack.add("output", "Output", {});
  edges.push(
    edge(previous, "final_norm"),
    edge("final_norm", "readout"),
    edge("readout", "head"),
    edge("head", "output"),
  );

  return {
    graph: { name: `vit_classifier_components_${blocks}_block`, nodes: stack.nodes, edges },
    ...stack.finish(),
    vertical: true,
  };
}

/* ------------------------------------------------------------------ *
 * Compact diagram presentation
 *
 * Any graph — a preset, a backend architecture or one assembled from
 * primitives — can render as the flat, small boxes from textbook
 * transformer diagrams instead of the full node cards, so a long stack
 * fits on one screen. The GraphDef payload is untouched: `typeName`
 * stays the catalog type and `label` is only a canvas caption.
 * ------------------------------------------------------------------ */

/** Flat box every diagram node is drawn in — the geometry the stacks are packed with. */
export const DIAGRAM_BOX = { width: 168, height: 38 };

/** Merge nodes collapse to a small "+" disc, like the summation circles in a paper. */
export const DIAGRAM_DISC = { width: 30, height: 30 };

export function diagramSize(typeName: string): { width: number; height: number } {
  return isMergeType(typeName) ? DIAGRAM_DISC : DIAGRAM_BOX;
}

/**
 * Canvas footprint of a node in the given presentation mode. Card mode keeps the
 * catalog width and lets the body drive the height; diagram mode is fully fixed,
 * which is what keeps a deep stack readable.
 */
export function nodeSizeFor(
  typeName: string,
  catalog: CatalogNode | undefined,
  diagram: boolean,
): { width: number; height?: number } {
  if (diagram) return diagramSize(typeName);
  // height: undefined clears a stale diagram height when switching back to cards.
  return { width: catalog?.width ?? 176, height: undefined };
}

/** Captions used on the canvas; unknown types fall back to their type name. */
export const DIAGRAM_LABELS: Record<string, string> = {
  Input: "Input Vectors",
  Output: "Output Tokens",
  TokenEmbedding: "Token Embedding",
  FixedPositionEmbedding: "Positional Embedding",
  LearnedPositionEmbedding: "Positional Embedding",
  RotaryPositionEmbedding: "Rotary Embedding",
  LayerNorm: "Layer Norm",
  RMSNorm: "RMS Norm",
  BatchNorm1d: "Batch Norm",
  BatchNorm2d: "Batch Norm",
  GroupNorm: "Group Norm",
  CausalSelfAttention: "Masked Self Attention",
  MultiHeadAttention: "Multi-Head Attention",
  CrossAttention: "Cross Attention",
  ScaledDotProductAttention: "Attention",
  FlashAttention: "Attention",
  LinearAttention: "Linear Attention",
  AdditiveAttention: "Additive Attention",
  GroupedQueryAttention: "Grouped-Query Attention",
  MultiQueryAttention: "Multi-Query Attention",
  FeedForward: "FNN Layers",
  MLP: "FNN Layers",
  VisionTransformerBlock: "Transformer Block",
  TransformerEncoder: "Transformer Encoder",
  Conv2d: "Convolution",
  MaxPool2d: "Max Pool",
  AvgPool2d: "Average Pool",
  AdaptiveAvgPool2d: "Adaptive Pool",
  GlobalAveragePool: "Global Average Pool",
  PatchEmbedding: "Patch Embedding",
  ClassToken: "[CLS] Token",
  SelectToken: "Select Token",
  MeanPool: "Mean Pool",
  Flatten: "Flatten",
  Dropout: "Dropout",
  LMHead: "Classification Head",
  ResidualAdd: "+",
  Add: "+",
  Accumulate: "+",
  Multiply: "×",
};

/** Pastel fills readable on the dark canvas; same role implies same hue. */
export const DIAGRAM_COLORS: Record<string, { fill: string; text: string }> = {
  Input: { fill: "#F0C79B", text: "#3A2611" },
  Output: { fill: "#BCD6EA", text: "#122836" },
  TokenEmbedding: { fill: "#D6D6D6", text: "#222222" },
  FixedPositionEmbedding: { fill: "#D6D6D6", text: "#222222" },
  LearnedPositionEmbedding: { fill: "#D6D6D6", text: "#222222" },
  RotaryPositionEmbedding: { fill: "#D6D6D6", text: "#222222" },
  PatchEmbedding: { fill: "#D6D6D6", text: "#222222" },
  ClassToken: { fill: "#D6D6D6", text: "#222222" },
  LayerNorm: { fill: "#F4EDA4", text: "#35310E" },
  RMSNorm: { fill: "#F4EDA4", text: "#35310E" },
  BatchNorm1d: { fill: "#F4EDA4", text: "#35310E" },
  BatchNorm2d: { fill: "#F4EDA4", text: "#35310E" },
  GroupNorm: { fill: "#F4EDA4", text: "#35310E" },
  CausalSelfAttention: { fill: "#EFBFB4", text: "#3A1A12" },
  MultiHeadAttention: { fill: "#EFBFB4", text: "#3A1A12" },
  CrossAttention: { fill: "#EFBFB4", text: "#3A1A12" },
  ScaledDotProductAttention: { fill: "#EFBFB4", text: "#3A1A12" },
  FlashAttention: { fill: "#EFBFB4", text: "#3A1A12" },
  LinearAttention: { fill: "#EFBFB4", text: "#3A1A12" },
  AdditiveAttention: { fill: "#EFBFB4", text: "#3A1A12" },
  GroupedQueryAttention: { fill: "#EFBFB4", text: "#3A1A12" },
  MultiQueryAttention: { fill: "#EFBFB4", text: "#3A1A12" },
  FeedForward: { fill: "#DAC9E8", text: "#291A36" },
  MLP: { fill: "#DAC9E8", text: "#291A36" },
  VisionTransformerBlock: { fill: "#DAC9E8", text: "#291A36" },
  TransformerEncoder: { fill: "#DAC9E8", text: "#291A36" },
  LMHead: { fill: "#E7A79F", text: "#381411" },
  Linear: { fill: "#E7A79F", text: "#381411" },
  AutoLinear: { fill: "#E7A79F", text: "#381411" },
  Conv2d: { fill: "#9FD2C0", text: "#102E25" },
  MaxPool2d: { fill: "#E4D6B8", text: "#332A12" },
  AvgPool2d: { fill: "#E4D6B8", text: "#332A12" },
  AdaptiveAvgPool2d: { fill: "#E4D6B8", text: "#332A12" },
  GlobalAveragePool: { fill: "#E4D6B8", text: "#332A12" },
  MeanPool: { fill: "#E4D6B8", text: "#332A12" },
  SelectToken: { fill: "#E4D6B8", text: "#332A12" },
  Flatten: { fill: "#CFD8DC", text: "#18252B" },
  Reshape: { fill: "#CFD8DC", text: "#18252B" },
  GELU: { fill: "#EFC7D2", text: "#33121F" },
  ReLU: { fill: "#EFC7D2", text: "#33121F" },
  SiLU: { fill: "#EFC7D2", text: "#33121F" },
  Sigmoid: { fill: "#EFC7D2", text: "#33121F" },
  Tanh: { fill: "#EFC7D2", text: "#33121F" },
  Softmax: { fill: "#EFC7D2", text: "#33121F" },
  Dropout: { fill: "#EFC7D2", text: "#33121F" },
  ResidualAdd: { fill: "#8FD28F", text: "#12300F" },
  Add: { fill: "#8FD28F", text: "#12300F" },
  Accumulate: { fill: "#8FD28F", text: "#12300F" },
  Concat: { fill: "#8FD28F", text: "#12300F" },
  Multiply: { fill: "#8FD28F", text: "#12300F" },
};

export function diagramLabel(typeName: string): string {
  return DIAGRAM_LABELS[typeName] ?? typeName;
}

export function diagramColor(
  typeName: string,
  fallback?: string,
): { fill: string; text: string } {
  const known = DIAGRAM_COLORS[typeName];
  if (known) return known;
  return { fill: fallback ?? "#8A93A6", text: "#12151B" };
}

// The vertical templates bake the compact footprint straight into their positions,
// so the boxes above are the only geometry a stack needs.
const SKIP_SOURCE_PORT = "skip_out";
const VERTICAL_COLUMN_X = 60;
/** Column the boxes are centred in; "+" discs are centred inside it. */
const VERTICAL_COLUMN_WIDTH = DIAGRAM_BOX.width;
const VERTICAL_GAP = 30;
/** Extra air around a framed block, so a frame never hugs its neighbours. */
const FRAME_GAP = 46;
const FRAME_PAD_LEFT = 24;
/** Right-hand margin doubles as the lane the residual skips route through. */
const FRAME_PAD_RIGHT = 72;
const FRAME_PAD_TOP = 28;
const FRAME_PAD_BOTTOM = 26;
const STACK_TOP = 80;

export const DIAGRAM_EDGE_COLOR = "#C6CDDB";
export const DIAGRAM_SKIP_EDGE_COLOR = "#D6A76C";

/** Thin light line with a closed arrowhead; skip connections bend around the chain. */
export function diagramEdge(edge: ThinkNetEdge): ThinkNetEdge {
  const skip =
    edge.targetHandle === "skip" ||
    edge.targetHandle === "input_b" ||
    edge.sourceHandle === SKIP_SOURCE_PORT;
  const stroke = skip ? DIAGRAM_SKIP_EDGE_COLOR : DIAGRAM_EDGE_COLOR;
  return {
    ...edge,
    type: skip ? "smoothstep" : "straight",
    style: { stroke, strokeWidth: skip ? 1.5 : 1.6 },
    markerEnd: { type: MarkerType.ArrowClosed, width: 11, height: 11, color: stroke },
  };
}

/**
 * Switches edge styling with the presentation mode. Vertical layouts keep the
 * diagram styling even when diagram mode is off, because their nodes stay
 * compact either way.
 */
export function styleEdges(
  edges: ThinkNetEdge[],
  nodes: ThinkNetNode[],
  diagram: boolean,
): ThinkNetEdge[] {
  const verticalIds = new Set(nodes.filter((node) => node.data.vertical).map((node) => node.id));
  return edges.map((edge) =>
    edge.hidden
      ? edge
      : diagram || verticalIds.has(edge.source) || verticalIds.has(edge.target)
        ? diagramEdge(edge)
        : { ...edge, type: "smoothstep", style: undefined, markerEnd: undefined },
  );
}

/** Re-sizes every node for the presentation mode; frames keep their own box. */
export function sizeNodes(nodes: ThinkNetNode[], diagram: boolean): ThinkNetNode[] {
  return nodes.map((node) =>
    node.type === TENSOR_NODE_TYPE
      ? {
          ...node,
          style: nodeSizeFor(node.data.typeName, node.data.catalog, diagram || Boolean(node.data.vertical)),
        }
      : node,
  );
}

export function graphDefToFlow(
  graph: GraphDef,
  catalogByType: Map<string, CatalogNode>,
  options?: LayoutOptions,
  diagram?: boolean,
): { nodes: ThinkNetNode[]; edges: ThinkNetEdge[] } {
  const vertical = options?.vertical ?? false;
  const compact = vertical || Boolean(diagram);

  // Identical blocks are drawn once under a ×N badge. Their nodes and edges stay
  // in the flow graph — and therefore in every save, verify and export — and are
  // simply not painted.
  const twins: Record<string, string> = Object.assign(
    {},
    ...(options?.frames ?? []).map((frame) => frame.duplicates ?? {}),
  );
  const folded = new Set(Object.keys(twins));

  const tensorNodes: ThinkNetNode[] = graph.nodes.map((node, index) => {
    const catalog = catalogByType.get(node.type);
    const { width, height } = diagramSize(node.type);
    const column = index % 3;
    const row = Math.floor(index / 3);
    const workflowType =
      node.type === "ModelLoader"
        ? MODEL_LOADER_NODE_TYPE
        : node.type === "Quantizer"
          ? QUANTIZER_NODE_TYPE
          : null;
    return {
      id: node.id,
      type: workflowType ?? TENSOR_NODE_TYPE,
      position:
        options?.positions?.[node.id] ??
        (vertical
          ? {
              x: VERTICAL_COLUMN_X + (VERTICAL_COLUMN_WIDTH - width) / 2,
              y: STACK_TOP + index * (height + VERTICAL_GAP),
            }
          : { x: 80 + column * 260, y: 80 + row * 140 }),
      style: workflowType
        ? {
            width: node.type === "Quantizer" ? 320 : catalog?.width ?? 320,
            minHeight: node.type === "Quantizer" ? 360 : catalog?.height ?? 270,
          }
        : nodeSizeFor(node.type, catalog, compact),
      ...(folded.has(node.id) ? { hidden: true } : {}),
      data: {
        typeName: node.type,
        config: { ...node.config },
        catalog,
        ...(vertical ? { vertical: true, label: diagramLabel(node.type) } : {}),
      },
    };
  });

  const frameNodes: ThinkNetNode[] = (options?.frames ?? []).map((frame) => ({
    id: frame.id,
    type: FRAME_NODE_TYPE,
    position: { x: frame.x, y: frame.y },
    style: { width: frame.width, height: frame.height },
    selectable: false,
    draggable: false,
    connectable: false,
    focusable: false,
    deletable: false,
    zIndex: -1,
    data: {
      typeName: "BlockFrame",
      config: {},
      frameLabel: frame.label,
      ...(frame.count && frame.count > 1 ? { frameCount: frame.count } : {}),
    },
  }));

  const edges: ThinkNetEdge[] = graph.edges.map((edge, index) => {
    const flow: ThinkNetEdge = {
      id: `e-${edge.source}-${edge.target}-${index}`,
      source: edge.source,
      target: edge.target,
      sourceHandle: edge.source_port,
      targetHandle: edge.target_port,
    };
    return folded.has(edge.source) || folded.has(edge.target)
      ? { ...flow, hidden: true }
      : flow;
  });

  // The stack tail hangs off the last copy, so re-attach it to the drawn one.
  // These bridges are view-only and are stripped again by `toGraphDef`.
  const seen = new Set(
    edges.map((edge) => `${edge.source}:${edge.sourceHandle}->${edge.target}:${edge.targetHandle}`),
  );
  const bridges: ThinkNetEdge[] = [];
  for (const edge of graph.edges) {
    if (!folded.has(edge.source) || folded.has(edge.target)) continue;
    const twin = twins[edge.source];
    const key = `${twin}:${edge.source_port}->${edge.target}:${edge.target_port}`;
    if (seen.has(key)) continue;
    seen.add(key);
    bridges.push({
      id: `e-fold-${twin}-${edge.target}-${edge.target_port}`,
      source: twin,
      target: edge.target,
      sourceHandle: edge.source_port,
      targetHandle: edge.target_port,
      data: { synthetic: true },
    });
  }

  const layout = [...edges, ...bridges];
  return {
    nodes: [...frameNodes, ...tensorNodes],
    edges: compact ? layout.map(diagramEdge) : layout,
  };
}
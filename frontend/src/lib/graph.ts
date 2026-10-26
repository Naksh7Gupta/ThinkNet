import { MarkerType, type Edge, type Node } from "@xyflow/react";
import type { CatalogNode, GraphDef } from "@/types/api";
import { defaultConfigForType } from "@/lib/node-config";

export const TENSOR_NODE_TYPE = "thinknet";
/** Decorative dashed group box (``BlockFrameNode``), never part of the graph payload. */
export const FRAME_NODE_TYPE = "thinknet-frame";
export const MODEL_TRANSFORM_TYPES = new Set(["Quantizer"]);

export type ThinkNetNodeData = {
  typeName: string;
  config: Record<string, unknown>;
  catalog?: CatalogNode;
  /** Bottom-to-top data flow with skip handles on the right, like the decoder diagram. */
  vertical?: boolean;
  /** Diagram caption shown on the node body; the graph payload always keeps `typeName`. */
  label?: string;
  /** Caption rendered by a block frame node. */
  frameLabel?: string;
};

// Node type is intentionally not narrowed to TENSOR_NODE_TYPE: frames share this data type.
export type ThinkNetNode = Node<ThinkNetNodeData>;
export type ThinkNetEdge = Edge;

export type NodePosition = { x: number; y: number };
export type NodePositions = Record<string, NodePosition>;

export type BlockFrame = {
  id: string;
  label: string;
  x: number;
  y: number;
  width: number;
  height: number;
};

export type FlowLayout = {
  graph?: GraphDef;
  positions?: NodePositions;
  frames?: BlockFrame[];
  vertical?: boolean;
};

/** Either a bare id → position map or a full layout object returned by a template builder. */
export type LayoutInput = NodePositions | FlowLayout;

function resolveLayout(layout?: LayoutInput): {
  positions: NodePositions;
  frames: BlockFrame[];
  vertical: boolean;
} {
  const isFullLayout =
    !!layout &&
    ("positions" in layout || "frames" in layout || "vertical" in layout || "graph" in layout);
  if (!isFullLayout) {
    return { positions: (layout as NodePositions | undefined) ?? {}, frames: [], vertical: false };
  }
  const full = layout as FlowLayout;
  return {
    positions: full.positions ?? {},
    frames: full.frames ?? [],
    vertical: Boolean(full.vertical),
  };
}

export function isMergeType(typeName: string): boolean {
  return typeName === "Add" || typeName === "Multiply" || typeName === "ResidualAdd";
}

export function isMultiInputType(typeName: string): boolean {
  return isMergeType(typeName) || typeName === "Concat";
}

export function toGraphDef(
  name: string,
  nodes: ThinkNetNode[],
  edges: ThinkNetEdge[],
): GraphDef {
  const frameIds = new Set(
    nodes.filter((node) => node.type === FRAME_NODE_TYPE).map((node) => node.id),
  );
  return {
    name: name.trim() || "untitled_architecture",
    nodes: nodes
      .filter((node) => !frameIds.has(node.id))
      .map((node) => ({
        id: node.id,
        type: node.data.typeName,
        config: node.data.config ?? {},
      })),
    edges: edges
      .filter((edge) => !frameIds.has(edge.source) && !frameIds.has(edge.target))
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
): ThinkNetNode {
  return {
    id,
    type: TENSOR_NODE_TYPE,
    position,
    style: { width: catalog.width },
    data: {
      typeName: catalog.type,
      config: defaultConfigForType(catalog.type, catalog),
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
 * Converts a backend GraphDef into React Flow state using the live catalog.
 * `layout` accepts either a plain id → position map or a full layout produced by
 * {@link decoderComponentGraph} (positions + decorative block frames + flow direction).
 */
export function graphDefToFlow(
  graph: GraphDef,
  catalogByType: Map<string, CatalogNode>,
  layout?: LayoutInput,
): { nodes: ThinkNetNode[]; edges: ThinkNetEdge[] } {
  const { positions, frames, vertical } = resolveLayout(layout);

  const frameNodes: ThinkNetNode[] = frames.map((frame) => ({
    id: frame.id,
    type: FRAME_NODE_TYPE,
    position: { x: frame.x, y: frame.y },
    style: { width: frame.width, height: frame.height },
    // Decoration only: it must not move, take selection, or accept connections.
    zIndex: -1,
    draggable: false,
    selectable: false,
    focusable: false,
    connectable: false,
    data: { typeName: FRAME_NODE_TYPE, config: {}, frameLabel: frame.label },
  }));

  const nodes: ThinkNetNode[] = graph.nodes.map((node, index) => {
    const catalog = catalogByType.get(node.type);
    const size = nodeSizeFor(node.type, catalog, vertical);
    const column = index % 3;
    const row = Math.floor(index / 3);
    return {
      id: node.id,
      type: TENSOR_NODE_TYPE,
      position:
        positions[node.id] ??
        (vertical
          ? {
              x: VERTICAL_COLUMN_X + (VERTICAL_COLUMN_WIDTH - size.width) / 2,
              y: 60 + index * (diagramSize(node.type).height + VERTICAL_GAP),
            }
          : { x: 80 + column * 260, y: 80 + row * 140 }),
      style: { ...size },
      data: {
        typeName: node.type,
        config: { ...node.config },
        catalog,
        ...(vertical ? { vertical: true, label: diagramLabel(node.type) } : {}),
      },
    };
  });

  const edges: ThinkNetEdge[] = graph.edges.map((edge, index) => {
    const base: ThinkNetEdge = {
      id: `e_${edge.source}_${edge.source_port}_${edge.target}_${edge.target_port}_${index}`,
      source: edge.source,
      target: edge.target,
      sourceHandle: edge.source_port,
      targetHandle: edge.target_port,
    };
    return vertical ? diagramEdge(base) : base;
  });

  return { nodes: [...frameNodes, ...nodes], edges };
}

/* ------------------------------------------------------------------ *
 * Compact diagram presentation
 *
 * Any graph — a preset, a backend architecture or one built from scratch —
 * can render as the flat, small boxes from textbook transformer diagrams
 * instead of the full node cards, so long stacks fit on one screen. The
 * GraphDef payload is untouched: `typeName` stays the catalog type and
 * `label` is only a canvas caption.
 * ------------------------------------------------------------------ */

/** Flat box size for every diagram node. */
export const DIAGRAM_BOX = { width: 168, height: 38 };

/** Merge nodes collapse to a small "+" disc, like the summation circles in the diagram. */
export const DIAGRAM_DISC = { width: 30, height: 30 };

/** Captions used on the canvas; unknown types fall back to their type name. */
export const DIAGRAM_LABELS: Record<string, string> = {
  Input: "Input Vectors",
  Output: "Output Tokens",
  TokenEmbedding: "Token Embedding",
  FixedPositionEmbedding: "Positional Embedding",
  LearnedPositionEmbedding: "Positional Embedding",
  LayerNorm: "Layer Norm",
  CausalSelfAttention: "Masked Self Attention",
  FeedForward: "FNN Layers",
  LMHead: "Classification Head",
  ResidualAdd: "+",
  Add: "+",
  Accumulate: "+",
  Multiply: "×",
};

/** Pastel fills from the reference diagram, readable on the dark canvas. */
export const DIAGRAM_COLORS: Record<string, { fill: string; text: string }> = {
  Input: { fill: "#F0C79B", text: "#3A2611" },
  Output: { fill: "#BCD6EA", text: "#122836" },
  TokenEmbedding: { fill: "#D6D6D6", text: "#222222" },
  FixedPositionEmbedding: { fill: "#D6D6D6", text: "#222222" },
  LearnedPositionEmbedding: { fill: "#D6D6D6", text: "#222222" },
  LayerNorm: { fill: "#F4EDA4", text: "#35310E" },
  CausalSelfAttention: { fill: "#EFBFB4", text: "#3A1A12" },
  FeedForward: { fill: "#DAC9E8", text: "#291A36" },
  LMHead: { fill: "#E7A79F", text: "#381411" },
  ResidualAdd: { fill: "#8FD28F", text: "#12300F" },
  Add: { fill: "#8FD28F", text: "#12300F" },
  Accumulate: { fill: "#8FD28F", text: "#12300F" },
  Multiply: { fill: "#8FD28F", text: "#12300F" },
};

export const DIAGRAM_EDGE_COLOR = "#C6CDDB";
export const DIAGRAM_SKIP_EDGE_COLOR = "#D6A76C";

export function diagramSize(typeName: string): { width: number; height: number } {
  return isMergeType(typeName) ? DIAGRAM_DISC : DIAGRAM_BOX;
}

/**
 * Canvas footprint of a node in the given presentation mode. Card mode keeps the
 * catalog width and lets the body drive the height; diagram mode is fully fixed.
 */
export function nodeSizeFor(
  typeName: string,
  catalog: CatalogNode | undefined,
  diagram: boolean,
): { width: number; height?: number } {
  if (diagram) return diagramSize(typeName);
  // height: undefined clears a diagram height when switching back to cards.
  return { width: catalog?.width ?? 176, height: undefined };
}

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

// Vertical templates bake diagram spacing straight into their positions, so the
// compact footprint above is the only geometry they need.
const SKIP_SOURCE_PORT = "skip_out";
const VERTICAL_COLUMN_X = 60;
/** Column the compact boxes are centred in; "+" discs are centred inside it. */
const VERTICAL_COLUMN_WIDTH = DIAGRAM_BOX.width;
const VERTICAL_GAP = 30;
const FRAME_PAD_LEFT = 24;
const FRAME_PAD_RIGHT = 72;
const FRAME_PAD_TOP = 28;
const FRAME_PAD_BOTTOM = 26;

export type DecoderComponentLayout = {
  graph: GraphDef;
  positions: NodePositions;
  frames: BlockFrame[];
  vertical: boolean;
};

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
    markerEnd: {
      type: MarkerType.ArrowClosed,
      width: 11,
      height: 11,
      color: stroke,
    },
  };
}

/**
 * Switches edge styling with the presentation mode. Vertical layouts keep the diagram
 * styling even when diagram mode is off, because their nodes stay compact regardless.
 */
export function styleEdges(
  edges: ThinkNetEdge[],
  nodes: ThinkNetNode[],
  diagram: boolean,
): ThinkNetEdge[] {
  const verticalIds = new Set(
    nodes.filter((node) => node.data.vertical).map((node) => node.id),
  );
  return edges.map((edge) => {
    if (diagram || verticalIds.has(edge.source) || verticalIds.has(edge.target)) {
      return diagramEdge(edge);
    }
    return { ...edge, type: "smoothstep", style: undefined, markerEnd: undefined };
  });
}

/**
 * Builds a decoder stack out of individual component nodes (no black-box
 * `Architecture` node), laid out bottom-to-top in compact diagram geometry so
 * the whole stack reads like the textbook figure.
 */
export function decoderComponentGraph(numBlocks: number): DecoderComponentLayout {
  const seq = 16;
  const vocab = 64;
  const dModel = 32;
  const numHeads = 4;
  const hidden = 64;

  const blocks = Math.max(1, Number.isFinite(numBlocks) ? Math.trunc(numBlocks) : 1);
  const graph: GraphDef = { name: `decoder-components-${blocks}`, nodes: [], edges: [] };
  const chain: { id: string; width: number; height: number }[] = [];
  const blockGroups: { label: string; ids: string[] }[] = [];

  const add = (id: string, typeName: string, config: Record<string, unknown> = {}) => {
    graph.nodes.push({ id, type: typeName, config });
    chain.push({ id, ...diagramSize(typeName) });
    return id;
  };

  add("input", "Input", { shape: [seq] });
  add("token_embedding", "TokenEmbedding", { vocab_size: vocab, d_model: dModel });
  add("position_embedding", "LearnedPositionEmbedding", {
    d_model: dModel,
    max_seq_len: 64,
  });
  graph.edges.push(
    edge("input", "token_embedding"),
    edge("token_embedding", "position_embedding"),
  );

  let previous = "position_embedding";
  for (let i = 1; i <= blocks; i += 1) {
    const ids: string[] = [];
    const addBlock = (suffix: string, typeName: string, config: Record<string, unknown> = {}) => {
      const id = add(`block${i}_${suffix}`, typeName, config);
      ids.push(id);
      return id;
    };

    const ln1 = addBlock("ln1", "LayerNorm", { normalized_shape: dModel, eps: 1e-5 });
    const attn = addBlock("attn", "CausalSelfAttention", {
      d_model: dModel,
      num_heads: numHeads,
      dropout: 0,
    });
    const add1 = addBlock("add1", "ResidualAdd");
    const ln2 = addBlock("ln2", "LayerNorm", { normalized_shape: dModel, eps: 1e-5 });
    const ffn = addBlock("ffn", "FeedForward", {
      d_model: dModel,
      hidden_features: hidden,
      dropout: 0,
    });
    const add2 = addBlock("add2", "ResidualAdd");

    graph.edges.push(
      edge(previous, ln1),
      edge(ln1, attn),
      edge(attn, add1, "main"),
      edge(previous, add1, "skip", SKIP_SOURCE_PORT),
      edge(add1, ln2),
      edge(ln2, ffn),
      edge(ffn, add2, "main"),
      edge(add1, add2, "skip", SKIP_SOURCE_PORT),
    );
    blockGroups.push({ label: `Decoder block ${i}`, ids });
    previous = add2;
  }

  add("final_norm", "LayerNorm", { normalized_shape: dModel, eps: 1e-5 });
  add("head", "LMHead", { in_features: dModel, vocab_size: vocab, bias: false });
  add("output", "Output");
  graph.edges.push(
    edge(previous, "final_norm"),
    edge("final_norm", "head"),
    edge("head", "output"),
  );

  // The chain is in data-flow order (input first); y grows downwards, so the input ends up at
  // the bottom and the output at the top.
  const totalHeight =
    chain.reduce((sum, item) => sum + item.height, 0) + VERTICAL_GAP * (chain.length - 1);
  const positions: NodePositions = {};
  const bodyById: Record<string, { y: number; height: number }> = {};
  let cursor = 0;
  for (const item of chain) {
    cursor += item.height;
    const y = totalHeight - cursor;
    positions[item.id] = { x: VERTICAL_COLUMN_X + (VERTICAL_COLUMN_WIDTH - item.width) / 2, y };
    bodyById[item.id] = { y, height: item.height };
    cursor += VERTICAL_GAP;
  }

  const frames: BlockFrame[] = blockGroups.map((group) => {
    const tops = group.ids.map((id) => bodyById[id].y);
    const bottoms = group.ids.map((id) => bodyById[id].y + bodyById[id].height);
    const top = Math.min(...tops);
    const bottom = Math.max(...bottoms);
    return {
      id: `frame_${group.ids[0].split("_")[0]}`,
      label: group.label,
      x: VERTICAL_COLUMN_X - FRAME_PAD_LEFT,
      y: top - FRAME_PAD_TOP,
      width: VERTICAL_COLUMN_WIDTH + FRAME_PAD_LEFT + FRAME_PAD_RIGHT,
      height: bottom - top + FRAME_PAD_TOP + FRAME_PAD_BOTTOM,
    };
  });

  return { graph, positions, frames, vertical: true };
}

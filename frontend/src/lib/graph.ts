import type { Edge, Node } from "@xyflow/react";
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
    const width = catalog?.width ?? 176;
    const column = index % 3;
    const row = Math.floor(index / 3);
    return {
      id: node.id,
      type: TENSOR_NODE_TYPE,
      position: positions[node.id] ?? { x: 80 + column * 260, y: 80 + row * 140 },
      style: { width },
      data: {
        typeName: node.type,
        config: { ...node.config },
        catalog,
        ...(vertical ? { vertical: true } : {}),
      },
    };
  });

  const edges: ThinkNetEdge[] = graph.edges.map((edge, index) => ({
    id: `e-${edge.source}-${edge.target}-${index}`,
    source: edge.source,
    target: edge.target,
    sourceHandle: edge.source_port,
    targetHandle: edge.target_port,
  }));

  return { nodes: [...frameNodes, ...nodes], edges };
}

const SKIP_SOURCE_PORT = "skip_out";

// Rendered body heights of ArchitectureNode: 31px title + inline config rows + 25px footer,
// floored by the node's minimum height. Used only to stack the vertical template.
const VERTICAL_NODE_HEIGHTS: Record<string, number> = {
  Input: 91,
  Output: 64,
  ResidualAdd: 64,
  LayerNorm: 122,
  TokenEmbedding: 122,
  LearnedPositionEmbedding: 122,
  CausalSelfAttention: 151,
  FeedForward: 151,
  LMHead: 151,
};

const VERTICAL_COLUMN_X = 60;
const VERTICAL_NODE_WIDTH = 210;
const VERTICAL_GAP = 56;
const FRAME_PAD_LEFT = 26;
const FRAME_PAD_RIGHT = 76;
const FRAME_PAD_TOP = 34;
const FRAME_PAD_BOTTOM = 30;

function verticalNodeHeight(typeName: string): number {
  return VERTICAL_NODE_HEIGHTS[typeName] ?? 92;
}

export type DecoderComponentLayout = {
  graph: GraphDef;
  positions: NodePositions;
  frames: BlockFrame[];
  vertical: boolean;
};

/**
 * Decoder Transformer as individual components (one node per LayerNorm, attention,
 * feed-forward and residual add), stacked bottom-to-top with a dashed frame per block.
 * Mirrors backend/tests/test_decoder_components.py so the canvas output compiles as-is.
 */
export function decoderComponentGraph(numBlocks: number): DecoderComponentLayout {
  const seq = 16;
  const vocab = 64;
  const dModel = 32;
  const numHeads = 4;
  const hidden = 64;

  const blocks = Math.max(1, Number.isFinite(numBlocks) ? Math.trunc(numBlocks) : 1);
  const graph: GraphDef = { name: `decoder-components-${blocks}`, nodes: [], edges: [] };
  const chain: { id: string; height: number }[] = [];
  const blockGroups: { label: string; ids: string[] }[] = [];

  const add = (id: string, typeName: string, config: Record<string, unknown> = {}) => {
    graph.nodes.push({ id, type: typeName, config });
    chain.push({ id, height: verticalNodeHeight(typeName) });
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
  const heightById: Record<string, number> = {};
  let cursor = 0;
  for (const item of chain) {
    heightById[item.id] = item.height;
    cursor += item.height;
    positions[item.id] = { x: VERTICAL_COLUMN_X, y: totalHeight - cursor };
    cursor += VERTICAL_GAP;
  }

  const frames: BlockFrame[] = blockGroups.map((group) => {
    const tops = group.ids.map((id) => positions[id].y);
    const bottoms = group.ids.map((id) => positions[id].y + heightById[id]);
    const top = Math.min(...tops);
    const bottom = Math.max(...bottoms);
    return {
      id: `frame_${group.ids[0].split("_")[0]}`,
      label: group.label,
      x: VERTICAL_COLUMN_X - FRAME_PAD_LEFT,
      y: top - FRAME_PAD_TOP,
      width: VERTICAL_NODE_WIDTH + FRAME_PAD_LEFT + FRAME_PAD_RIGHT,
      height: bottom - top + FRAME_PAD_TOP + FRAME_PAD_BOTTOM,
    };
  });

  return { graph, positions, frames, vertical: true };
}

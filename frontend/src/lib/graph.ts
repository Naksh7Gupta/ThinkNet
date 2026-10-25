import type { Edge, Node } from "@xyflow/react";
import type { CatalogNode, GraphDef } from "@/types/api";
import { defaultConfigForType } from "@/lib/node-config";

export const TENSOR_NODE_TYPE = "thinknet";
export const MODEL_TRANSFORM_TYPES = new Set(["Quantizer"]);

export type ThinkNetNodeData = {
  typeName: string;
  config: Record<string, unknown>;
  catalog?: CatalogNode;
};

export type ThinkNetNode = Node<ThinkNetNodeData, typeof TENSOR_NODE_TYPE>;
export type ThinkNetEdge = Edge;

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
  return {
    name: name.trim() || "untitled_architecture",
    nodes: nodes.map((node) => ({
      id: node.id,
      type: node.data.typeName,
      config: node.data.config ?? {},
    })),
    edges: edges.map((edge) => ({
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

function edge(source: string, target: string, targetPort = "input"): GraphDef["edges"][number] {
  return { source, target, source_port: "output", target_port: targetPort };
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
): { nodes: ThinkNetNode[]; edges: ThinkNetEdge[] } {
  const nodes: ThinkNetNode[] = graph.nodes.map((node, index) => {
    const catalog = catalogByType.get(node.type);
    const width = catalog?.width ?? 176;
    const column = index % 3;
    const row = Math.floor(index / 3);
    return {
      id: node.id,
      type: TENSOR_NODE_TYPE,
      position: { x: 80 + column * 260, y: 80 + row * 140 },
      style: { width },
      data: {
        typeName: node.type,
        config: { ...node.config },
        catalog,
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

  return { nodes, edges };
}

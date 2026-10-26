import { describe, expect, it } from "vitest";
import {
  FRAME_NODE_TYPE,
  architectureGraph,
  cnnComponentGraph,
  decoderComponentGraph,
  DIAGRAM_BOX,
  DIAGRAM_DISC,
  exampleMlpGraph,
  exampleResidualGraph,
  graphDefToFlow,
  sizeNodes,
  styleEdges,
  toGraphDef,
  vitComponentGraph,
} from "@/lib/graph";
import {
  defaultConfigForType,
  fieldsForNode,
  localConfigIssues,
} from "@/lib/node-config";
import type { CatalogNode } from "@/types/api";

const linear: CatalogNode = {
  type: "Linear",
  category: "Core",
  status: "implemented-and-tested",
  size: "small",
  width: 136,
  height: 64,
  color: "#3B82F6",
  input_kind: "tensor",
  output_kind: "tensor",
  execution_domain: "tensor-graph",
};

describe("graph conversion", () => {
  it("round-trips the documented MLP graph without React Flow extras", () => {
    const graph = exampleMlpGraph();
    const catalog = new Map<string, CatalogNode>([["Linear", linear]]);
    const { nodes, edges } = graphDefToFlow(graph, catalog);
    const restored = toGraphDef(graph.name, nodes, edges);
    expect(restored).toEqual(graph);
    expect(restored.nodes[1]?.type).toBe("Linear");
    expect("position" in restored.nodes[1]!).toBe(false);
  });

  it("preserves ResidualAdd port names expected by the backend schema", () => {
    const graph = exampleResidualGraph();
    const { nodes, edges } = graphDefToFlow(graph, new Map());
    expect(toGraphDef(graph.name, nodes, edges).edges).toEqual(graph.edges);
    expect(graph.edges.some((edge) => edge.target_port === "skip")).toBe(true);
  });

  it("builds Architecture graphs using backend builder names", () => {
    const graph = architectureGraph("mlp");
    expect(graph.nodes.some((node) => node.type === "Architecture")).toBe(true);
    expect(graph.nodes.find((node) => node.type === "Architecture")?.config.architecture).toBe("mlp");
  });

  it("uses supplied positions instead of the default grid", () => {
    const graph = exampleMlpGraph();
    const { nodes } = graphDefToFlow(graph, new Map(), { positions: { input: { x: 500, y: 600 } } });
    expect(nodes.find((node) => node.id === "input")?.position).toEqual({ x: 500, y: 600 });
    expect(nodes.find((node) => node.id === "projection")?.position).toBeDefined();
  });
});

describe("decoder component template", () => {
  it("builds one separate node per component for each block", () => {
    const { graph, positions } = decoderComponentGraph(2);
    expect(graph.nodes).toHaveLength(3 + 6 * 2 + 3);
    expect(graph.nodes.filter((n) => n.type === "CausalSelfAttention")).toHaveLength(2);
    expect(graph.nodes.filter((n) => n.type === "ResidualAdd")).toHaveLength(4);
    expect(graph.nodes.some((n) => n.type === "Architecture")).toBe(false);
    for (const node of graph.nodes) expect(positions[node.id]).toBeDefined();
  });

  it("wires each residual add with main and skip ports", () => {
    const { graph } = decoderComponentGraph(1);
    const into = (id: string) => graph.edges.filter((e) => e.target === id);
    expect(into("block1_add1").map((e) => e.target_port).sort()).toEqual(["main", "skip"]);
    expect(into("block1_add2").map((e) => e.target_port).sort()).toEqual(["main", "skip"]);
    const skip = into("block1_add1").find((e) => e.target_port === "skip");
    expect(skip?.source).toBe("position_embedding");
    expect(skip?.source_port).toBe("skip_out");
  });

  it("flows bottom to top: the input sits below the output", () => {
    const { positions } = decoderComponentGraph(2);
    expect(positions["input"]!.y).toBeGreaterThan(positions["block1_ln1"]!.y);
    // Block 2 is folded into block 1's frame, so its copies sit on their twins.
    expect(positions["block2_ln1"]).toEqual(positions["block1_ln1"]);
    expect(positions["block1_add2"]!.y).toBeGreaterThan(positions["lm_head"]!.y);
    expect(positions["lm_head"]!.y).toBeGreaterThan(positions["output"]!.y);
  });

  it("draws repeated blocks once and keeps every copy in the backend graph", () => {
    const layout = decoderComponentGraph(2);
    expect(layout.vertical).toBe(true);
    expect(layout.frames).toHaveLength(1);
    expect(layout.frames![0]).toMatchObject({ id: "frame_block1", label: "Decoder Block", count: 2 });
    expect(layout.frames![0]?.duplicates).toEqual({
      block2_ln1: "block1_ln1",
      block2_attention: "block1_attention",
      block2_add1: "block1_add1",
      block2_ln2: "block1_ln2",
      block2_ffn: "block1_ffn",
      block2_add2: "block1_add2",
    });

    const { nodes, edges } = graphDefToFlow(layout.graph, new Map(), layout);
    const frames = nodes.filter((n) => n.type === FRAME_NODE_TYPE);
    expect(frames).toHaveLength(1);
    expect(frames[0]?.data.frameCount).toBe(2);
    expect(nodes.filter((n) => n.hidden)).toHaveLength(6);
    // The tail of the stack is re-attached to the drawn copy by a view-only bridge.
    expect(edges.filter((e) => e.data?.["synthetic"] === true).map((e) => e.source)).toEqual([
      "block1_add2",
    ]);

    const restored = toGraphDef(layout.graph.name, nodes, edges);
    expect(restored.nodes).toHaveLength(layout.graph.nodes.length);
    expect(restored.nodes.some((n) => n.type === "BlockFrame")).toBe(false);
    expect(restored.edges).toEqual(layout.graph.edges);
  });
});

describe("CNN component template", () => {
  it("assembles a classifier out of primitives with no Architecture node", () => {
    const { graph, positions, frames } = cnnComponentGraph();
    expect(graph.nodes.some((n) => n.type === "Architecture")).toBe(false);
    expect(graph.nodes.filter((n) => n.type === "Conv2d")).toHaveLength(4);
    expect(graph.nodes.filter((n) => n.type === "BatchNorm2d")).toHaveLength(4);
    expect(graph.nodes.filter((n) => n.type === "MaxPool2d")).toHaveLength(2);
    expect(frames).toHaveLength(4);
    for (const node of graph.nodes) expect(positions[node.id]).toBeDefined();
    expect(graph.nodes.find((n) => n.id === "head")?.config).toMatchObject({
      in_features: 16,
      out_features: 10,
    });
  });

  it("carries the requested channel width through the conv stack", () => {
    const { graph } = cnnComponentGraph({ channels: 32 });
    expect(graph.nodes.filter((n) => n.type === "Conv2d").map((n) => n.config.out_channels)).toEqual([
      32, 32, 64, 64,
    ]);
    expect(graph.nodes.find((n) => n.id === "head")?.config).toMatchObject({ in_features: 64 });
  });

  it("flows bottom to top from images to class scores", () => {
    const { positions } = cnnComponentGraph();
    expect(positions["input"]!.y).toBeGreaterThan(positions["stage1_conv"]!.y);
    expect(positions["stage4_pool"]!.y).toBeGreaterThan(positions["head"]!.y);
    expect(positions["head"]!.y).toBeGreaterThan(positions["output"]!.y);
  });
});

describe("ViT component template", () => {
  it("embeds patches and repeats attention blocks as separate nodes", () => {
    const { graph, frames, positions } = vitComponentGraph(2);
    expect(graph.nodes.some((n) => n.type === "Architecture")).toBe(false);
    expect(graph.nodes.filter((n) => n.type === "MultiHeadAttention")).toHaveLength(2);
    expect(graph.nodes.filter((n) => n.type === "MLP")).toHaveLength(2);
    expect(graph.nodes.filter((n) => n.type === "ResidualAdd")).toHaveLength(4);
    expect(graph.nodes.filter((n) => n.type === "LayerNorm")).toHaveLength(5);
    expect(frames).toHaveLength(1);
    for (const node of graph.nodes) expect(positions[node.id]).toBeDefined();
  });

  it("badges one frame ×N instead of drawing every identical block", () => {
    for (const blocks of [1, 2, 4]) {
      const layout = vitComponentGraph(blocks);
      const folded = 6 * (blocks - 1);
      expect(layout.frames).toHaveLength(1);
      expect(layout.frames![0]?.count ?? 1).toBe(blocks);
      expect(Object.keys(layout.frames![0]?.duplicates ?? {})).toHaveLength(folded);

      const { nodes, edges } = graphDefToFlow(layout.graph, new Map(), layout);
      expect(nodes.filter((n) => n.type === FRAME_NODE_TYPE)[0]?.data.frameCount).toBe(
        blocks > 1 ? blocks : undefined,
      );
      expect(nodes.filter((n) => n.hidden)).toHaveLength(folded);
      // Nothing a ×N badge hides may ever disappear from a save, verify or export.
      expect(toGraphDef(layout.graph.name, nodes, edges).nodes).toHaveLength(
        layout.graph.nodes.length,
      );
      expect(toGraphDef(layout.graph.name, nodes, edges).edges).toEqual(layout.graph.edges);
      expect(edges.filter((e) => e.data?.["synthetic"] === true)).toHaveLength(blocks > 1 ? 1 : 0);
    }
  });

  it("sizes the positional table for patches plus the [CLS] token", () => {
    const { graph } = vitComponentGraph(1);
    expect(graph.nodes.find((n) => n.id === "cls")?.config).toMatchObject({ num_tokens: 1 });
    expect(graph.nodes.find((n) => n.id === "position")?.config).toMatchObject({ max_seq_len: 17 });
  });

  it("wires block residuals through main and skip ports", () => {
    const { graph } = vitComponentGraph(1);
    const into = (id: string) => graph.edges.filter((e) => e.target === id);
    expect(into("block1_add1").map((e) => e.target_port).sort()).toEqual(["main", "skip"]);
    const skip = into("block1_add1").find((e) => e.target_port === "skip");
    expect(skip?.source).toBe("position");
    expect(skip?.source_port).toBe("skip_out");
  });

  it("switches the readout between the [CLS] token and mean pooling", () => {
    const readout = (layout: ReturnType<typeof vitComponentGraph>) =>
      layout.graph.nodes.find((n) => n.id === "readout")?.type;
    expect(readout(vitComponentGraph(1))).toBe("SelectToken");
    expect(readout(vitComponentGraph(1, { readout: "mean" }))).toBe("MeanPool");
  });
});

describe("presentation modes", () => {
  it("keeps the exported graph identical whether nodes are boxes or cards", () => {
    const graph = exampleResidualGraph();
    const cards = graphDefToFlow(graph, new Map(), undefined, false);
    const boxes = graphDefToFlow(graph, new Map(), undefined, true);
    expect(toGraphDef(graph.name, boxes.nodes, boxes.edges)).toEqual(
      toGraphDef(graph.name, cards.nodes, cards.edges),
    );
    // Compact mode draws the thin paper-style arrows a card view does not need,
    // and gives every node a fixed footprint — a disc for the summation node.
    const box = (id: string) => boxes.nodes.find((n) => n.id === id)?.style;
    expect(box("linear1")).toEqual({ width: DIAGRAM_BOX.width, height: DIAGRAM_BOX.height });
    expect(box("residual")).toEqual({ width: DIAGRAM_DISC.width, height: DIAGRAM_DISC.height });
    expect(cards.nodes.find((n) => n.id === "linear1")?.style?.height).toBeUndefined();
    expect(boxes.edges.every((e) => e.markerEnd)).toBe(true);
    expect(cards.edges.every((e) => !e.markerEnd)).toBe(true);
  });

  it("leaves a vertical template compact when the diagram toggle is flipped off", () => {
    const layout = decoderComponentGraph(2);
    const { nodes, edges } = graphDefToFlow(layout.graph, new Map(), layout);
    expect(sizeNodes(nodes, false)).toEqual(nodes);
    expect(styleEdges(edges, nodes, false)).toEqual(edges);
  });
});

describe("local config checks", () => {
  it("rejects more than one variable Input dimension", () => {
    expect(localConfigIssues("Input", { shape: [-1, -1] }).length).toBeGreaterThan(0);
    expect(localConfigIssues("Input", { shape: [24] })).toEqual([]);
  });

  it("accepts every primitive placed by the component templates", () => {
    for (const layout of [cnnComponentGraph(), vitComponentGraph(2), decoderComponentGraph(2)]) {
      for (const node of layout.graph.nodes) {
        expect(
          localConfigIssues(node.type, node.config),
          `${layout.graph.name} / ${node.id}`,
        ).toEqual([]);
      }
    }
  });

  it("treats an omitted key as the backend default instead of an error", () => {
    expect(localConfigIssues("BatchNorm2d", {})).toEqual([]);
    expect(localConfigIssues("GroupNorm", {})).toEqual([]);
    expect(localConfigIssues("PatchEmbedding", {})).toEqual([]);
    expect(localConfigIssues("ClassToken", { embed_dim: 32 })).toEqual([]);
    expect(localConfigIssues("SelectToken", { index: 0 })).toEqual([]);
    expect(localConfigIssues("MultiHeadAttention", {})).toEqual([]);
    expect(localConfigIssues("Conv2d", { in_channels: 3, out_channels: 16 })).toEqual([]);
  });

  it("mirrors the backend rules for the vision primitives", () => {
    expect(localConfigIssues("BatchNorm2d", { num_features: 0 }).length).toBeGreaterThan(0);
    expect(localConfigIssues("BatchNorm2d", { num_channels: 24 })).toEqual([]);
    expect(localConfigIssues("GroupNorm", { num_groups: 5, num_channels: 16 }).length).toBeGreaterThan(0);
    expect(localConfigIssues("AdaptiveAvgPool2d", { output_size: 0 }).length).toBeGreaterThan(0);
    expect(localConfigIssues("MaxPool2d", { kernel_size: 2, stride: 0 }).length).toBeGreaterThan(0);
    expect(localConfigIssues("AvgPool2d", { kernel_size: 0 }).length).toBeGreaterThan(0);
    expect(localConfigIssues("Conv2d", { kernel_size: 0 }).length).toBeGreaterThan(0);
    expect(
      localConfigIssues("PatchEmbedding", { in_channels: 3, d_model: 16, patch_size: 0 }).length,
    ).toBeGreaterThan(0);
    expect(localConfigIssues("ClassToken", { d_model: 16, num_tokens: 0 }).length).toBeGreaterThan(0);
    expect(localConfigIssues("MeanPool", { dim: -2.5 }).length).toBeGreaterThan(0);
    expect(localConfigIssues("Dropout", { p: 1 }).length).toBeGreaterThan(0);
    expect(localConfigIssues("Dropout", { p: 0.25 })).toEqual([]);
  });

  it("checks head geometry across every attention family", () => {
    expect(localConfigIssues("CrossAttention", { d_model: 64, num_heads: 4 })).toEqual([]);
    expect(localConfigIssues("VisionTransformerBlock", { d_model: 100, num_heads: 8 }).length).toBeGreaterThan(0);
    expect(
      localConfigIssues("GroupedQueryAttention", { d_model: 64, num_heads: 8, num_kv_heads: 3 }).length,
    ).toBeGreaterThan(0);
    expect(localConfigIssues("LinearAttention", { d_model: 64, num_heads: 8, num_kv_heads: 4 })).toEqual([]);
    expect(localConfigIssues("FlashAttention", { d_model: 64, num_heads: 8, num_kv_heads: 3 }).length).toBeGreaterThan(0);
    // RoPE additionally needs an even head width: 24/8 = 3 is unusable.
    expect(localConfigIssues("RotaryPositionEmbedding", { d_model: 64, num_heads: 8 })).toEqual([]);
    expect(localConfigIssues("RotaryPositionEmbedding", { d_model: 24, num_heads: 8 }).length).toBeGreaterThan(0);
    expect(localConfigIssues("TransformerEncoder", { num_layers: 0 }).length).toBeGreaterThan(0);
    expect(localConfigIssues("TransformerEncoder", { mlp_ratio: 0 }).length).toBeGreaterThan(0);
  });

  it("ships defaults that satisfy the mirrored rules", () => {
    const types = [
      "BatchNorm2d",
      "GroupNorm",
      "AvgPool2d",
      "AdaptiveAvgPool2d",
      "PatchEmbedding",
      "ClassToken",
      "SelectToken",
      "MeanPool",
      "CrossAttention",
      "RotaryPositionEmbedding",
      "VisionTransformerBlock",
      "TransformerEncoder",
      "ScaledDotProductAttention",
      "FlashAttention",
      "LinearAttention",
      "AdditiveAttention",
      "GroupedQueryAttention",
      "MultiQueryAttention",
    ];
    for (const type of types) {
      expect(localConfigIssues(type, defaultConfigForType(type)), type).toEqual([]);
      expect(fieldsForNode(type, defaultConfigForType(type)).length, type).toBeGreaterThan(0);
    }
  });
});
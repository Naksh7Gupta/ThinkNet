import { describe, expect, it } from "vitest";
import {
  architectureGraph,
  decoderComponentGraph,
  exampleMlpGraph,
  exampleResidualGraph,
  graphDefToFlow,
  toGraphDef,
} from "@/lib/graph";
import { localConfigIssues } from "@/lib/node-config";
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
    const { nodes } = graphDefToFlow(graph, new Map(), { input: { x: 500, y: 600 } });
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
    expect(into("block1_add1").find((e) => e.target_port === "skip")?.source).toBe("position_embedding");
  });
});

describe("local config checks", () => {
  it("rejects more than one variable Input dimension", () => {
    expect(localConfigIssues("Input", { shape: [-1, -1] }).length).toBeGreaterThan(0);
    expect(localConfigIssues("Input", { shape: [24] })).toEqual([]);
  });
});
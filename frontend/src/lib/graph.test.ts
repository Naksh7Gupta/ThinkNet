import { describe, expect, it } from "vitest";
import {
  architectureGraph,
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
});

describe("local config checks", () => {
  it("rejects more than one variable Input dimension", () => {
    expect(localConfigIssues("Input", { shape: [-1, -1] }).length).toBeGreaterThan(0);
    expect(localConfigIssues("Input", { shape: [24] })).toEqual([]);
  });
});

import { describe, expect, it } from "vitest";
import { estimateGraphParameters } from "../../src/lib/graph-parameters";
import type { GraphDef } from "../../src/types/api";

describe("canvas graph parameter estimates", () => {
  it("counts Linear, normalization, and embedding parameters", () => {
    const graph: GraphDef = {
      name: "test",
      nodes: [
        { id: "linear", type: "Linear", config: { in_features: 4, out_features: 3, bias: true } },
        { id: "norm", type: "LayerNorm", config: { normalized_shape: 3 } },
        { id: "embedding", type: "Embedding", config: { num_embeddings: 5, embedding_dim: 2 } },
      ],
      edges: [],
    };

    expect(estimateGraphParameters(graph)).toEqual({
      parameterCount: 15 + 6 + 10,
      unsupportedNodes: [],
    });
  });

  it("counts an explicitly configured MLP architecture", () => {
    const graph: GraphDef = {
      name: "mlp",
      nodes: [{
        id: "model",
        type: "Architecture",
        config: {
          architecture: "mlp",
          config: { input_dim: 4, hidden_dims: [3], output_dim: 2 },
        },
      }],
      edges: [],
    };

    expect(estimateGraphParameters(graph)).toEqual({
      parameterCount: (4 * 3 + 3) + (3 * 2 + 2),
      unsupportedNodes: [],
    });
  });

  it("marks uninitialized lazy parameters as unsupported instead of reporting a complete total", () => {
    const graph: GraphDef = {
      name: "lazy",
      nodes: [
        { id: "lazy", type: "AutoLinear", config: { out_features: 4 } },
        { id: "known", type: "Linear", config: { in_features: 2, out_features: 3 } },
      ],
      edges: [],
    };

    expect(estimateGraphParameters(graph)).toEqual({
      parameterCount: 9,
      unsupportedNodes: ["lazy (AutoLinear)"],
    });
  });
});

import { afterEach, describe, expect, it } from "vitest";
import {
  createNodeFromCatalog,
  MODEL_LOADER_CATALOG,
} from "../../src/lib/graph";
import { useDesignerStore } from "../../src/store/designer-store";
import type { CatalogNode } from "../../src/types/api";

const quantizerCatalog: CatalogNode = {
  ...MODEL_LOADER_CATALOG,
  type: "Quantizer",
  category: "Model Transform",
  color: "#EA580C",
  input_kind: "model",
  output_kind: "quantized-model",
};

const initialState = useDesignerStore.getState();

afterEach(() => {
  useDesignerStore.setState({
    nodes: initialState.nodes,
    edges: initialState.edges,
    selectedNodeId: initialState.selectedNodeId,
    libraryNotice: initialState.libraryNotice,
  });
});

describe("model workflow canvas connections", () => {
  it("allows one ModelLoader-to-Quantizer edge and rejects unrelated model edges", () => {
    const loader = createNodeFromCatalog(MODEL_LOADER_CATALOG, { x: 0, y: 0 }, "loader");
    const quantizer = createNodeFromCatalog(quantizerCatalog, { x: 400, y: 0 }, "quantizer");
    const output = createNodeFromCatalog(
      { ...quantizerCatalog, type: "Output", category: "I/O", execution_domain: "tensor-graph" },
      { x: 800, y: 0 },
      "output",
    );
    useDesignerStore.setState({ nodes: [loader, quantizer, output], edges: [] });

    useDesignerStore.getState().onConnect({
      source: "loader",
      target: "quantizer",
      sourceHandle: "output",
      targetHandle: "input",
    });
    expect(useDesignerStore.getState().edges).toHaveLength(1);

    useDesignerStore.getState().onConnect({
      source: "quantizer",
      target: "output",
      sourceHandle: "output",
      targetHandle: "input",
    });
    expect(useDesignerStore.getState().edges).toHaveLength(1);
  });
});

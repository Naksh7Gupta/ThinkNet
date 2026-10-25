import { applyEdgeChanges, applyNodeChanges, type Connection, type EdgeChange, type NodeChange } from "@xyflow/react";
import { create } from "zustand";
import {
  createNodeFromCatalog,
  graphDefToFlow,
  isMergeType,
  MODEL_TRANSFORM_TYPES,
  toGraphDef,
  type ThinkNetEdge,
  type ThinkNetNode,
} from "@/lib/graph";
import type { CatalogNode, GraphDef, ModelHandle, ShapePreviewResponse, ValidationResponse } from "@/types/api";

type DesignerState = {
  graphName: string;
  nodes: ThinkNetNode[];
  edges: ThinkNetEdge[];
  selectedNodeId: string | null;
  libraryNotice: string | null;
  lastValidation: ValidationResponse | null;
  lastShapePreview: ShapePreviewResponse | null;
  lastNote: string | null;
  lastError: string | null;
  models: ModelHandle[];
  inspectedModel: ModelHandle["model_id"] | null;
  canvasRevision: number;
  setGraphName: (name: string) => void;
  setSelectedNodeId: (id: string | null) => void;
  onNodesChange: (changes: NodeChange<ThinkNetNode>[]) => void;
  onEdgesChange: (changes: EdgeChange<ThinkNetEdge>[]) => void;
  onConnect: (connection: Connection) => void;
  addCatalogNode: (catalog: CatalogNode, position?: { x: number; y: number }) => void;
  updateNodeConfig: (id: string, config: Record<string, unknown>) => void;
  loadGraph: (graph: GraphDef, catalogByType: Map<string, CatalogNode>) => void;
  getGraph: () => GraphDef;
  setValidation: (value: ValidationResponse | null) => void;
  setShapePreview: (value: ShapePreviewResponse | null) => void;
  setLastNote: (value: string | null) => void;
  setLastError: (value: string | null) => void;
  addModel: (model: ModelHandle) => void;
  removeModel: (modelId: string) => void;
  setInspectedModel: (modelId: string | null) => void;
  clearLibraryNotice: () => void;
};

function nextId(typeName: string, nodes: ThinkNetNode[]): string {
  const base = typeName.replace(/[^A-Za-z0-9]+/g, "_").toLowerCase();
  let i = 1;
  const used = new Set(nodes.map((node) => node.id));
  while (used.has(`${base}_${i}`)) i += 1;
  return `${base}_${i}`;
}

export const useDesignerStore = create<DesignerState>((set, get) => ({
  graphName: "untitled_architecture",
  nodes: [],
  edges: [],
  selectedNodeId: null,
  libraryNotice: null,
  lastValidation: null,
  lastShapePreview: null,
  lastNote: null,
  lastError: null,
  models: [],
  inspectedModel: null,
  canvasRevision: 0,
  setGraphName: (graphName) => set({ graphName }),
  setSelectedNodeId: (selectedNodeId) => set({ selectedNodeId }),
  onNodesChange: (changes) => {
    const nodes = applyNodeChanges(changes, get().nodes) as ThinkNetNode[];
    const selected = nodes.find((node) => node.selected);
    set({ nodes, selectedNodeId: selected?.id ?? null });
  },
  onEdgesChange: (changes) =>
    set({ edges: applyEdgeChanges(changes, get().edges) as ThinkNetEdge[] }),
  onConnect: (connection) => {
    if (!connection.source || !connection.target) return;
    if (connection.source === connection.target) return;
    const target = get().nodes.find((node) => node.id === connection.target);
    const typeName = target?.data.typeName ?? "";
    const incoming = get().edges.filter((edge) => edge.target === connection.target);
    if (isMergeType(typeName) && incoming.length >= 2) return;

    let targetHandle = connection.targetHandle ?? "input";
    if (isMergeType(typeName) && !connection.targetHandle) {
      const used = new Set(incoming.map((edge) => edge.targetHandle ?? "main"));
      targetHandle = used.has("main") ? "skip" : "main";
    }
    if (typeName === "Concat" && !connection.targetHandle) {
      targetHandle = incoming.some((edge) => (edge.targetHandle ?? "input") === "input")
        ? "input_b"
        : "input";
    }

    const duplicate = get().edges.some(
      (edge) =>
        edge.source === connection.source &&
        edge.target === connection.target &&
        (edge.sourceHandle ?? "output") === (connection.sourceHandle ?? "output") &&
        (edge.targetHandle ?? "input") === targetHandle,
    );
    if (duplicate) return;

    const id = `e-${connection.source}-${connection.target}-${targetHandle}-${Date.now()}`;
    const edge: ThinkNetEdge = {
      id,
      source: connection.source,
      target: connection.target,
      sourceHandle: connection.sourceHandle ?? "output",
      targetHandle,
    };
    set({ edges: [...get().edges, edge] });
  },
  addCatalogNode: (catalog, position) => {
    if (MODEL_TRANSFORM_TYPES.has(catalog.type) || catalog.execution_domain === "model-transform") {
      set({
        libraryNotice:
          `${catalog.type} is a model-transform operation, not a tensor-graph node. Compile a graph first, then use Model operations.`,
      });
      return;
    }
    const node = createNodeFromCatalog(
      catalog,
      position ?? { x: 120 + get().nodes.length * 24, y: 80 + get().nodes.length * 18 },
      nextId(catalog.type, get().nodes),
    );
    set({
      nodes: [...get().nodes, node],
      selectedNodeId: node.id,
      libraryNotice: null,
    });
  },
  updateNodeConfig: (id, config) =>
    set({
      nodes: get().nodes.map((node) =>
        node.id === id ? { ...node, data: { ...node.data, config } } : node,
      ),
    }),
  loadGraph: (graph, catalogByType) => {
    const flow = graphDefToFlow(graph, catalogByType);
    set({
      graphName: graph.name,
      nodes: flow.nodes,
      edges: flow.edges,
      selectedNodeId: null,
      lastValidation: null,
      lastShapePreview: null,
      lastNote: null,
      lastError: null,
      canvasRevision: get().canvasRevision + 1,
    });
  },
  getGraph: () => toGraphDef(get().graphName, get().nodes, get().edges),
  setValidation: (lastValidation) => set({ lastValidation }),
  setShapePreview: (lastShapePreview) => set({ lastShapePreview }),
  setLastNote: (lastNote) => set({ lastNote }),
  setLastError: (lastError) => set({ lastError }),
  addModel: (model) => set({ models: [model, ...get().models], inspectedModel: model.model_id }),
  removeModel: (modelId) =>
    set({
      models: get().models.filter((model) => model.model_id !== modelId),
      inspectedModel: get().inspectedModel === modelId ? null : get().inspectedModel,
    }),
  setInspectedModel: (inspectedModel) => set({ inspectedModel }),
  clearLibraryNotice: () => set({ libraryNotice: null }),
}));

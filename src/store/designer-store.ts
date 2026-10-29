import { applyEdgeChanges, applyNodeChanges, type Connection, type EdgeChange, type NodeChange } from "@xyflow/react";
import { create } from "zustand";
import {
  createNodeFromCatalog,
  graphDefToFlow,
  isDualInputType,
  isMergeType,
  MODEL_TRANSFORM_TYPES,
  MODEL_WORKFLOW_TYPES,
  sizeNodes,
  styleEdges,
  toGraphDef,
  type LayoutOptions,
  type ThinkNetEdge,
  type ThinkNetNode,
} from "@/lib/graph";
import type { CatalogNode, GraphDef, LocalModelAsset, ModelHandle, ShapePreviewResponse, ValidationResponse } from "@/types/api";

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
  localAssets: LocalModelAsset[];
  inspectedModel: ModelHandle["model_id"] | null;
  canvasRevision: number;
  setGraphName: (name: string) => void;
  setSelectedNodeId: (id: string | null) => void;
  onNodesChange: (changes: NodeChange<ThinkNetNode>[]) => void;
  onEdgesChange: (changes: EdgeChange<ThinkNetEdge>[]) => void;
  onConnect: (connection: Connection) => void;
  addCatalogNode: (catalog: CatalogNode, position?: { x: number; y: number }) => void;
  updateNodeConfig: (id: string, config: Record<string, unknown>) => void;
  loadGraph: (
    graph: GraphDef,
    catalogByType: Map<string, CatalogNode>,
    layout?: LayoutOptions,
  ) => void;
  getGraph: () => GraphDef;
  setValidation: (value: ValidationResponse | null) => void;
  setShapePreview: (value: ShapePreviewResponse | null) => void;
  /** Renders every node as a compact flat box instead of a full config card. */
  diagramView: boolean;
  setDiagramView: (value: boolean) => void;
  setLastNote: (value: string | null) => void;
  setLastError: (value: string | null) => void;
  addModel: (model: ModelHandle) => void;
  removeModel: (modelId: string) => void;
  setInspectedModel: (modelId: string | null) => void;
  addLocalAsset: (asset: LocalModelAsset) => void;
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
  localAssets: [],
  inspectedModel: null,
  diagramView: false,
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
    const source = get().nodes.find((node) => node.id === connection.source);
    const target = get().nodes.find((node) => node.id === connection.target);
    const sourceType = source?.data.typeName ?? "";
    const typeName = target?.data.typeName ?? "";
    if (
      MODEL_WORKFLOW_TYPES.has(sourceType) ||
      MODEL_WORKFLOW_TYPES.has(typeName)
    ) {
      if (sourceType !== "ModelLoader" || typeName !== "Quantizer") return;
      if (get().edges.some((edge) => edge.target === connection.target)) return;
      if (
        get().edges.some(
          (edge) =>
            edge.source === connection.source &&
            edge.target === connection.target,
        )
      ) return;
    }
    const incoming = get().edges.filter((edge) => edge.target === connection.target);
    if (isMergeType(typeName) && incoming.length >= 2) return;
    // CrossAttention consumes exactly one query and one context tensor; a third edge
    // would silently overwrite a port when the backend builds its port map.
    if (typeName === "CrossAttention" && incoming.length >= 2) return;

    let targetHandle = connection.targetHandle ?? "input";
    if (isMergeType(typeName) && !connection.targetHandle) {
      const used = new Set(incoming.map((edge) => edge.targetHandle ?? "main"));
      targetHandle = used.has("main") ? "skip" : "main";
    }
    if (isDualInputType(typeName) && !connection.targetHandle) {
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
    if (
      (MODEL_TRANSFORM_TYPES.has(catalog.type) ||
        catalog.execution_domain === "model-transform") &&
      !MODEL_WORKFLOW_TYPES.has(catalog.type)
    ) {
      set({
        libraryNotice:
          `${catalog.type} is not available as a canvas node.`,
      });
      return;
    }
    const node = createNodeFromCatalog(
      catalog,
      position ??
        (catalog.type === "Quantizer"
          ? { x: 540, y: 160 }
          : catalog.type === "ModelLoader"
            ? { x: 140, y: 160 }
            : { x: 120 + get().nodes.length * 24, y: 80 + get().nodes.length * 18 }),
      nextId(catalog.type, get().nodes),
      get().diagramView,
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
  loadGraph: (graph, catalogByType, layout) => {
    const flow = graphDefToFlow(graph, catalogByType, layout, get().diagramView);
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
  // Presentation only: the graph payload is identical either way, so switching
  // modes re-sizes and re-routes the existing nodes instead of rebuilding them.
  setDiagramView: (diagramView) => {
    const nodes = get().nodes;
    set({
      diagramView,
      nodes: sizeNodes(nodes, diagramView),
      edges: styleEdges(get().edges, nodes, diagramView),
      canvasRevision: get().canvasRevision + 1,
    });
  },
  setLastNote: (lastNote) => set({ lastNote }),
  setLastError: (lastError) => set({ lastError }),
  addModel: (model) => set({ models: [model, ...get().models], inspectedModel: model.model_id }),
  removeModel: (modelId) =>
    set({
      models: get().models.filter((model) => model.model_id !== modelId),
      inspectedModel: get().inspectedModel === modelId ? null : get().inspectedModel,
    }),
  setInspectedModel: (inspectedModel) => set({ inspectedModel }),
  addLocalAsset: (asset) =>
    set({
      localAssets: [
        asset,
        ...get().localAssets.filter((existing) => existing.path !== asset.path),
      ],
    }),
  clearLibraryNotice: () => set({ libraryNotice: null }),
}));
export type NodeStatus =
  | "implemented-and-tested"
  | "partial"
  | "metadata-only";

export type CatalogConfigOption = {
  label: string;
  value: string;
};

export type CatalogConfigField = {
  name: string;
  label: string;
  type: string;
  required?: boolean;
  default?: unknown;
  options?: CatalogConfigOption[];
};

export type CatalogNode = {
  type: string;
  category: string;
  status: NodeStatus | string;
  size: "small" | "medium" | "large" | string;
  width: number;
  height: number;
  color: string;
  input_kind: string;
  output_kind: string;
  execution_domain: string;
  config_fields?: CatalogConfigField[];
};

export type NodeCatalogResponse = {
  count: number;
  nodes: CatalogNode[];
};

export type ArchitectureInfo = {
  name: string;
  status: string;
  task: string;
  entrypoint: string;
};

export type ArchitectureCatalogResponse = {
  count: number;
  architectures: ArchitectureInfo[];
};

export type GraphNode = {
  id: string;
  type: string;
  config: Record<string, unknown>;
};

export type GraphEdge = {
  source: string;
  target: string;
  source_port: string;
  target_port: string;
};

export type GraphDef = {
  name: string;
  nodes: GraphNode[];
  edges: GraphEdge[];
};

export type ValidationResponse = {
  valid: boolean;
  errors: string[];
  node_count: number;
  edge_count: number;
};

export type ShapePreviewResponse = {
  shapes: Record<string, Array<number | null> | null>;
  outputs: Record<string, Array<number | null> | null>;
  note: string;
};

export type CompileResponse = {
  compiled: boolean;
  model_id: string;
  parameter_count: number;
  shape_preview: ShapePreviewResponse;
  note: string;
};

export type QuantizeResponse = {
  quantized: boolean;
  model_id: string;
  source_model_id: string;
  dtype: string;
  parameter_count: number;
  report: {
    dtype: string;
    dynamic_int8_linear_modules: number;
    floating_parameter_count: number;
  };
  note: string;
};

export type ModelMetadata = {
  model_id: string;
  parameter_count: number;
  training: boolean;
  module_count: number;
};

export type DeleteModelResponse = {
  deleted: boolean;
  model_id: string;
};

export type ExportResponse = {
  exported: boolean;
  filename: string;
  language: string;
  python_source: string;
  node_count: number;
  edge_count: number;
  runtime_dependency: string;
  note: string;
};

export type HealthResponse = {
  status: string;
  service: string;
  torch_version: string;
};

export type ModelHandle = {
  model_id: string;
  parameter_count: number;
  note: string;
  origin: "compile" | "quantize";
  dtype?: string;
  source_model_id?: string;
  report?: QuantizeResponse["report"];
  graphName: string;
};

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

export type LocalModelInspection = {
  model_name: string;
  format: string;
  architecture: string;
  model_type: string;
  parameter_count: number;
  tensor_count: number;
  size_bytes: number;
  weight_bytes: number;
  dtype_counts: Record<string, number>;
};

export type LocalQuantizationJobStatus = "queued" | "running" | "completed" | "failed";

export type LocalQuantizationResult = {
  output_path: string;
  format: string;
  dtype: "float16" | "bfloat16";
  parameter_count: number;
  source_size_bytes: number;
  output_size_bytes: number;
  size_reduction_bytes: number;
  size_reduction_percent: number;
  validation_status: "passed";
  validation_message: string;
};

export type LocalQuantizationJob = {
  job_id: string;
  status: LocalQuantizationJobStatus;
  phase: string;
  progress: number;
  message: string;
  error: string | null;
  result: LocalQuantizationResult | null;
  created_at: string;
  updated_at: string;
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

export type LocalModelAsset = {
  path: string;
  model_name: string;
  format: string;
  dtype: "float16" | "bfloat16";
  parameter_count: number;
  size_bytes: number;
  source_path: string;
  validation_status: "passed";
};

export type TrainingSettings = {
  learning_rate: number;
  batch_size: number;
  sequence_length: number;
  max_steps: number;
  log_every_steps: number;
  save_every_steps: number;
  weight_decay: number;
  gradient_clip_norm: number;
  seed: number;
  tokenizer_name: string;
  dataset_path: string;
  output_dir: string;
};

export type TrainingJobStatus = "queued" | "running" | "cancelling" | "cancelled" | "completed" | "failed";

export type TrainingJob = {
  job_id: string;
  status: TrainingJobStatus;
  phase: string;
  step: number;
  total_steps: number;
  progress: number;
  loss: number | null;
  message: string;
  error: string | null;
  device?: string;
  parameter_count?: number;
  token_count?: number;
  vocabulary_size?: number;
  graph_adjustments?: string[];
  elapsed_seconds: number;
  artifact_available: boolean;
  created_at: string;
  updated_at: string;
  started_at?: string;
  completed_at?: string;
};

export type TrainingJobStartResponse = {
  started: boolean;
  task: "causal_language_modeling";
  job: TrainingJob;
};

export type TrainingJobsResponse = { jobs: TrainingJob[] };
export type CancelTrainingJobResponse = { cancelled: boolean; job: TrainingJob };

export type TrainingPreflight = {
  ready: boolean;
  errors: string[];
  warnings: string[];
  graph_adjustments: string[];
  model_vocab_size: number | null;
  vocabulary_size: number | null;
  parameter_count: number | null;
  token_count: number | null;
  tokenizer_name: string;
  dataset_path: string;
  sequence_length?: number;
  batch_size?: number;
  max_steps?: number;
  message: string;
};


export type PipelineNode = {
  id: string;
  type: string;
  config: Record<string, unknown>;
};

export type PipelineEdge = {
  source: string;
  target: string;
  source_port: string;
  target_port: string;
};

export type PipelineGraph = {
  name: string;
  nodes: PipelineNode[];
  edges: PipelineEdge[];
};

export type PipelineComponent = {
  type: string;
  inputs: Record<string, string>;
  outputs: Record<string, string>;
};

export type PipelineComponentCatalog = {
  components: PipelineComponent[];
};

export type PipelineValidation = {
  valid: boolean;
  node_count?: number;
  edge_count?: number;
  execution_order?: string[];
  errors?: string[];
};

export type PipelineRun = {
  run_id: string;
  name: string;
  status: "completed" | "failed";
  nodes: Array<{
    node_id: string;
    type: string;
    status: "completed" | "failed";
    started_at: string;
    finished_at: string;
    error?: string;
  }>;
  outputs?: Record<string, Record<string, unknown>>;
  error?: string;
  run_record?: string;
};


export type PipelineProjectSummary = {
  project_id: string;
  name: string;
  description: string;
  updated_at: string;
};

export type PipelineProject = PipelineProjectSummary & {
  graph: PipelineGraph;
  created_at: string;
};

export type PipelineProjectList = { projects: PipelineProjectSummary[] };

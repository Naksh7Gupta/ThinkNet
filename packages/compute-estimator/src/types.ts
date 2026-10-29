/**
 * Shared vocabulary for the compute estimator: the normalized computational
 * graph (input schema) and the result schema every estimator returns.
 *
 * Two rules govern every number produced by this package:
 *  - a value is never reported as 0 when it is unknown; `state` says why it is
 *    missing and `missingInputs` names what would make it computable;
 *  - every number carries an explicit unit, a method, and the assumptions it
 *    depends on, so two ThinkNet sections can consume the same result without
 *    re-deriving anything.
 */

/** How a number was obtained. Never collapse these: they mean different things. */
export type ValueState = "estimated" | "measured" | "unavailable" | "unsupported";

export type ConfidenceTier = "high" | "medium" | "low";

/** Numeric element formats with a well-defined storage size. */
export type Precision =
  | "float64"
  | "float32"
  | "tf32"
  | "float16"
  | "bfloat16"
  | "float8_e4m3"
  | "int8"
  | "uint8"
  | "int4";

/** Explicit units. Conversions happen only through these names. */
export type Unit =
  | "count"
  | "dimension"
  | "bytes"
  | "bytes_per_sample"
  | "macs_per_sample"
  | "flops_per_sample"
  | "flops_per_batch"
  | "scalar_ops_per_sample"
  | "macs"
  | "flops"
  | "operations_per_second"
  | "bytes_per_second"
  | "seconds"
  | "seconds_per_sample"
  | "samples_per_second"
  | "percent"
  | "ratio";

export interface Confidence {
  tier: ConfidenceTier;
  /** 0..1, deterministic: 1 = closed-form from complete metadata. */
  score: number;
  reasons: string[];
}

export interface EstimateRange {
  min: number;
  max: number;
}

/** The result envelope required by every metric. */
export interface Estimate {
  metric: string;
  state: ValueState;
  unit: Unit;
  /** null whenever the metric cannot be computed. Never a fake zero. */
  value: number | null;
  /** Batch-independent value for metrics that scale with batch size. */
  perSample?: number | null;
  /** Reported instead of a single number when scheduling is unknown. */
  range?: EstimateRange | null;
  /** Name of the formula family used, e.g. "conv2d: K^2*Cin/g*Cout*M*N". */
  method: string;
  confidence: Confidence;
  assumptions: string[];
  warnings: string[];
  /** Option/argument names that were required but absent. */
  missingInputs: string[];
  /** Operation names that carry no estimation rule. */
  unsupported: string[];
  explanation: string;
  /** Set when a measurement was supplied by the caller. */
  measuredOn?: string;
}

export type Severity = "error" | "warning" | "info";

export interface Diagnostic {
  code: string;
  severity: Severity;
  message: string;
  nodeId?: string;
  edgeId?: string;
  /** Structured detail for programmatic consumers (AI agent, Hardware Explorer). */
  data?: Record<string, unknown>;
}

/* ------------------------------------------------------------------ *
 * Normalized computational graph (input schema)
 * ------------------------------------------------------------------ */

/** A dimension: null means "declared but not statically known" (batch, -1). */
export type Dim = number | null;

export interface TensorSpec {
  /** Rank-ordered dimensions, leading dimension is the batch dimension. */
  shape?: Dim[];
  dtype?: Precision;
  /** Integer tensors (token ids) are not activation-quantised in fp16. */
  kind?: "float" | "integer";
}

/** Metadata a caller may attach to a user-defined operation. */
export interface CustomOperationEstimate {
  /** Trainable parameters allocated by one node of this operation. */
  parameters?: number | ((ctx: EstimateContext) => number | null);
  /** Buffers/registers that are stored but not trained. */
  nonTrainableParameters?: number | ((ctx: EstimateContext) => number | null);
  /** Multiply-accumulate operations, per sample, batch dimension excluded. */
  macs?: number | ((ctx: EstimateContext) => number | null);
  /** Non-contraction elementwise operations, per sample. */
  scalarOps?: number | ((ctx: EstimateContext) => number | null);
  /** Extra transient tensors, in elements per sample (workspace peak). */
  workspaceElements?: number | ((ctx: EstimateContext) => number | null);
  /** Output shape rule. */
  outputShape?: Dim[] | ((ctx: EstimateContext) => Dim[] | null);
  /** Notes appended to the estimate explanation. */
  note?: string;
}

/** What a custom rule is given. Shapes have the batch dimension removed. */
export interface EstimateContext {
  nodeId: string;
  op: string;
  config: Record<string, unknown>;
  /** Resolved input shapes, batch dimension removed, empty when unknown. */
  inputs: Dim[][];
  /** Declared batch size, null when the caller did not supply one. */
  batch: number | null;
  /** Read a numeric option with an explicit "absent" result. */
  number(key: string, fallback?: number): number | null;
  boolean(key: string, fallback?: boolean): boolean | null;
}

export interface ParameterGroupRef {
  /** Shares this group instead of allocating it (weight tying): counts once. */
  reuses?: string;
  /** Allocates this group for the first time in the graph. */
  declares?: string;
}

export interface NormalizedNodeInput {
  id: string;
  /** Registry operation name. Falls back to `type` when omitted. */
  op?: string;
  /** Original architecture-builder type, kept for diagnostics. */
  type?: string;
  label?: string;
  config?: Record<string, unknown>;
  /** Declared output tensor; overrides inferred shape when fully known. */
  output?: TensorSpec;
  /** Explicit input tensors, used when upstream shapes are not derivable. */
  inputs?: TensorSpec[];
  /** False for frozen/eval-only nodes. */
  trainable?: boolean;
  parameterGroup?: ParameterGroupRef;
  /** Estimation metadata for user-defined operations. */
  estimate?: CustomOperationEstimate;
  /** Free-form runtime/execution metadata (device, stream, kernel, ...). */
  metadata?: Record<string, unknown>;
  /** Repeat count for a node standing in for N identical nodes. */
  instances?: number;
}

export interface NormalizedEdgeInput {
  id?: string;
  from: string;
  to: string;
  fromPort?: string;
  toPort?: string;
  /** Marks a skip/feedback/residual dependency for reporting purposes. */
  kind?: "data" | "residual" | "context" | "control";
}

/** The architecture-agnostic graph the engine analyses. */
export interface ComputationGraph {
  name?: string;
  nodes: NormalizedNodeInput[];
  edges: NormalizedEdgeInput[];
  /** Element format used for weights and activations unless overridden. */
  precision?: Precision;
  /** Batch size used to turn per-sample figures into totals. */
  batchSize?: number | null;
  /** Absolute shape overrides keyed by node id (batch dimension included). */
  shapes?: Record<string, Dim[]>;
  /** Extra operations for this graph only. */
  operations?: OperationRegistration[];
}

/** Anything with nodes and edges: normalized graph or raw canvas export. */
export type GraphLike =
  | ComputationGraph
  | (Record<string, unknown> & { nodes?: unknown[]; edges?: unknown[] });

export interface OperationRegistration {
  op: string;
  /** Human-readable family, used in reports. */
  category?: string;
  status?: "supported" | "partial" | "metadata-only";
  /** Elementwise/norm/conv/attention/... used to explain cost. */
  costModel?: "contraction" | "elementwise" | "normalization" | "reduction" | "structural" | "memory-bound" | "none";
  trainable?: boolean;
  estimate?: CustomOperationEstimate;
  /** Composite operation: expand into other registered operations. */
  expand?: (ctx: EstimateContext) => ExpansionItem[] | null;
  /** Text describing the formula, surfaced in `method`. */
  formula?: string;
}

/** One member of a composite operation's expansion. */
export interface ExpansionItem {
  op: string;
  config?: Record<string, unknown>;
  /** Input shape this member sees (batch dimension included). */
  inShape: Dim[];
  /** Output shape this member produces (batch dimension included). */
  outShape: Dim[];
  label?: string;
  /** Allocates / reuses a parameter group inside the composite. */
  declares?: string;
  reuses?: string;
  trainable?: boolean;
}

/* ------------------------------------------------------------------ *
 * Analysis reports
 * ------------------------------------------------------------------ */

export interface ShapeReport {
  state: ValueState;
  shape: Dim[] | null;
  /** Dimension indices that could not be resolved. */
  unknownDimensions: number[];
  reason?: string;
}

export interface PrimitiveBreakdown {
  path: string;
  op: string;
  label?: string;
  trainableParameters: number | null;
  nonTrainableParameters: number | null;
  macsPerSample: number | null;
  scalarOpsPerSample: number | null;
  outputShape: Dim[] | null;
}

export interface NodeAnalysis {
  id: string;
  op: string;
  sourceType: string;
  label?: string;
  /** Topological depth (0 = fed only by inputs). */
  depth: number;
  inputs: { nodeId: string; edgeId: string; toPort?: string; shape: ShapeReport }[];
  output: ShapeReport;
  parameters: Estimate[];
  compute: Estimate[];
  memory: Estimate[];
  /** Composite members actually used, so the UI can show where a number came from. */
  breakdown: PrimitiveBreakdown[];
  diagnostics: Diagnostic[];
}

export interface ArchitectureReport {
  graphName: string;
  /** True when structural errors prevent full analysis. */
  valid: boolean;
  nodeCount: number;
  edgeCount: number;
  operationCounts: Record<string, number>;
  supportedOperations: string[];
  unsupportedOperations: string[];
  order: string[] | null;
  cycles: string[][];
  inputNodes: string[];
  outputNodes: string[];
  /** Nodes with more than one consumer. */
  branchNodes: string[];
  parameters: Estimate[];
  compute: Estimate[];
  memory: Estimate[];
  /** Nodes ranked by the requested compute metric (null values last). */
  computeBottlenecks: { nodeId: string; op: string; share: number | null; value: number | null }[];
  memoryBottlenecks: { nodeId: string; op: string; share: number | null; value: number | null }[];
  complexity: { depth: number; fanOutMax: number; recurrent: boolean; sharedParameterGroups: string[] };
  diagnostics: Diagnostic[];
  assumptions: string[];
  nodes: NodeAnalysis[];
  /** Graph signature used for cache lookups. */
  signature: string;
}

export interface MemoryBreakdown {
  weights: Estimate;
  gradients: Estimate;
  optimizerStates: Estimate;
  activations: Estimate;
  workspace: Estimate;
  total: Estimate;
}

export interface HardwareSpec {
  /** Identifier used in reports, e.g. "custom-a10" or "rtx-4090". */
  id: string;
  name?: string;
  kind: "gpu" | "cpu" | "accelerator" | "cluster";
  /** Hard constraints: memory the model must fit into. */
  memoryBytes?: number | null;
  /** Optional hard constraint: host RAM for CPU/offloaded execution. */
  systemMemoryBytes?: number | null;
  deviceCount?: number;
  /** Only precisions the device can execute; drives feasibility of the config. */
  supportedPrecisions?: Precision[];
  /** Peak throughput. Absent => runtime estimates stay unavailable. */
  peakFlopsPerSecond?: number | null;
  peakFlopsPerSecondByPrecision?: Partial<Record<Precision, number>>;
  /** Achieved/realistic throughput, e.g. from a benchmark. */
  realisticFlopsPerSecond?: number | null;
  /** Assumed fraction of peak used by this workload (0..1). */
  utilization?: number | null;
  memoryBandwidthBytesPerSecond?: number | null;
  interconnectBytesPerSecond?: number | null;
  /** Free memory headroom the caller allows (0..1 fraction of memoryBytes). */
  reservedMemoryFraction?: number;
  /** Where the numbers came from. */
  source?: "user" | "registry" | "benchmark";
  notes?: string[];
}

export interface OptimizerSpec {
  kind: "none" | "sgd" | "sgd_momentum" | "adam" | "adamw" | "custom";
  /** Extra bytes per trainable parameter beyond momentum/variance buffers. */
  extraBytesPerParameter?: number;
  name?: string;
}

export interface WorkloadConfig {
  mode: "inference" | "training" | "evaluation";
  batchSize?: number | null;
  sequenceLength?: number | null;
  /** Spatial override for vision graphs [height, width]. */
  spatialSize?: number[] | null;
  precision?: Precision;
  /** Weights/activations kept in fp32 while math runs in `precision`. */
  mixedPrecision?: boolean;
  optimizer?: OptimizerSpec;
  gradientAccumulationSteps?: number;
  gradientCheckpointing?: boolean | "all" | string[];
  /** Tokens/samples processed per step for training. */
  samplesPerStep?: number | null;
  totalSamples?: number | null;
  steps?: number | null;
  /** Devices used for data/pipeline parallel execution. */
  deviceCount?: number;
  /** Rows through a KV cache at inference (decoding context length). */
  kvCache?: boolean;
}

export interface FeasibilityVerdict {
  metric: string;
  verdict: "fits" | "tight" | "does-not-fit" | "unknown";
  hardConstraint: boolean;
  requiredBytes: number | null;
  availableBytes: number | null;
  headroomBytes: number | null;
  utilization: number | null;
  explanation: string;
  warnings: string[];
}

export interface FeasibilityReport {
  hardware: string;
  workload: string;
  feasible: boolean | null;
  confidence: Confidence;
  checks: FeasibilityVerdict[];
  runtime: Estimate[];
  diagnostics: Diagnostic[];
  assumptions: string[];
  missingInputs: string[];
}

export interface OptimizationRecommendation {
  id: string;
  title: string;
  category:
    | "precision"
    | "batching"
    | "activation-memory"
    | "sequence-or-resolution"
    | "parameter-efficient"
    | "attention"
    | "execution-strategy"
    | "distribution";
  appliesTo: string[];
  /** Estimated deltas against the current configuration, when computable. */
  impact: Estimate[];
  benefits: string[];
  tradeoffs: string[];
  limitations: string[];
  proposal: Record<string, unknown>;
  confidence: Confidence;
  explanation: string;
}

export interface EstimationError {
  code: string;
  message: string;
  nodeId?: string;
  edgeId?: string;
}

/** Options accepted by every public entry point. */
export interface AnalysisOptions {
  /** Runtime overrides: batch, sequence, precision, spatial size. */
  runtime?: Partial<WorkloadConfig>;
  /** Treat the graph as a training workload (enables grads/optimizer states). */
  mode?: WorkloadConfig["mode"];
  /** Extra or overriding operation definitions. */
  operations?: OperationRegistration[];
  /** Absolute shape hints keyed by node id (batch dimension included). */
  shapes?: Record<string, Dim[]>;
  batchSize?: number | null;
  precision?: Precision;
  optimizer?: OptimizerSpec;
  mixedPrecision?: boolean;
  gradientCheckpointing?: WorkloadConfig["gradientCheckpointing"];
  gradientAccumulationSteps?: number;
  deviceCount?: number;
  /** Bump to short-circuit cache lookups when the canvas changed. */
  revision?: number | string;
  /** Skip cached results entirely. */
  disableCache?: boolean;
}

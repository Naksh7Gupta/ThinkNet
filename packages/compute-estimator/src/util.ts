/** Numeric helpers, config readers, deterministic hashing and result builders. */
import type {
  Confidence,
  ConfidenceTier,
  Dim,
  Estimate,
  EstimateContext,
  Precision,
  Unit,
  ValueState,
} from "./types";

/** Storage size per element. int4 is half a byte; sub-byte packing is the norm. */
export const PRECISION_BYTES: Record<Precision, number> = {
  float64: 8,
  float32: 4,
  tf32: 4,
  float16: 2,
  bfloat16: 2,
  float8_e4m3: 1,
  int8: 1,
  uint8: 1,
  int4: 0.5,
};

export const DEFAULT_PRECISION: Precision = "float32";

/** Above this, a float cannot represent every integer exactly. */
export const EXACT_INTEGER_LIMIT = Number.MAX_SAFE_INTEGER;

export function precisionBytes(precision: Precision | undefined | null): number | null {
  if (!precision) return null;
  const bytes = PRECISION_BYTES[precision];
  return typeof bytes === "number" && bytes > 0 ? bytes : null;
}

export function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

/** Positive integer read that treats booleans as absent (PyTorch would accept them, ThinkNet does not). */
export function positiveInt(value: unknown): number | null {
  if (typeof value !== "number" || !Number.isFinite(value) || value < 1 || !Number.isInteger(value)) return null;
  return value;
}

export function anyInt(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value) && Number.isInteger(value)) return value;
  return null;
}

export function numberValue(value: unknown): number | null {
  if (isFiniteNumber(value)) return value;
  return null;
}

/** First key present as a usable positive integer. Mirrors backend `cfg.get(a, cfg.get(b, d))`. */
export function firstPositive(config: Record<string, unknown>, keys: string[], fallback?: number): number | null {
  for (const key of keys) {
    const parsed = positiveInt(config[key]);
    if (parsed !== null) return parsed;
  }
  return fallback ?? null;
}

export function firstNumber(config: Record<string, unknown>, keys: string[], fallback?: number): number | null {
  for (const key of keys) {
    const parsed = numberValue(config[key]);
    if (parsed !== null) return parsed;
  }
  return fallback ?? null;
}

export function firstBoolean(config: Record<string, unknown>, keys: string[], fallback?: boolean): boolean {
  for (const key of keys) {
    if (typeof config[key] === "boolean") return config[key] as boolean;
  }
  return fallback ?? false;
}

/** Scalar list used by conv/pool configs (kernel_size may be 3 or [3, 3]). */
export function scalarField(config: Record<string, unknown>, key: string, fallback: number): number | null {
  const raw = config[key];
  if (Array.isArray(raw)) return positiveInt(raw[0]) ?? (raw.length === 0 ? fallback : null);
  if (raw === undefined) return fallback;
  return positiveInt(raw) ?? (raw === 0 ? 0 : null);
}

/** Product of dimensions; null when any dimension is unknown. */
export function product(dims: Dim[] | undefined | null): number | null {
  if (!dims || dims.length === 0) return null;
  let total = 1;
  for (const dim of dims) {
    if (dim === null || dim === undefined) return null;
    if (!Number.isFinite(dim) || dim < 0) return null;
    total *= dim;
    if (total > EXACT_INTEGER_LIMIT) return EXACT_INTEGER_LIMIT;
  }
  return total;
}

/** Elements per sample: every dimension except the leading batch dimension. */
export function elementsPerSample(shape: Dim[] | null | undefined): number | null {
  if (!shape || shape.length === 0) return null;
  return product(shape.slice(1));
}

export function shapeLabel(shape: Dim[] | null | undefined): string {
  if (!shape || shape.length === 0) return "unknown";
  return `[${shape.map((dim) => (dim === null ? "?" : dim)).join(", ")}]`;
}

export function sameShape(a: Dim[] | null, b: Dim[] | null): boolean {
  if (!a || !b) return a === b;
  if (a.length !== b.length) return false;
  return a.every((dim, index) => dim === b[index]);
}

export function resolveAxis(axis: number, rank: number): number | null {
  const resolved = axis < 0 ? rank + axis : axis;
  return resolved >= 0 && resolved < rank ? resolved : null;
}

/** Overflow-safe arithmetic: saturates at the exact-integer limit and reports it. */
export function safeMul(a: number, b: number): { value: number; overflow: boolean } {
  if (!Number.isFinite(a) || !Number.isFinite(b)) return { value: EXACT_INTEGER_LIMIT, overflow: true };
  const value = a * b;
  if (!Number.isFinite(value) || value > EXACT_INTEGER_LIMIT) return { value: EXACT_INTEGER_LIMIT, overflow: true };
  return { value, overflow: false };
}

export function safeAdd(a: number, b: number): { value: number; overflow: boolean } {
  const value = a + b;
  if (!Number.isFinite(value) || value > EXACT_INTEGER_LIMIT) return { value: EXACT_INTEGER_LIMIT, overflow: true };
  return { value, overflow: false };
}

export function formatBytes(bytes: number): string {
  const units = ["B", "KiB", "MiB", "GiB", "TiB", "PiB"];
  let value = bytes;
  let index = 0;
  while (value >= 1024 && index < units.length - 1) {
    value /= 1024;
    index += 1;
  }
  return `${value >= 100 || index === 0 ? Math.round(value) : value.toFixed(1)} ${units[index]}`;
}

export function formatCount(count: number): string {
  const groups: [number, string][] = [
    [1e12, "T"],
    [1e9, "B"],
    [1e6, "M"],
    [1e3, "k"],
  ];
  for (const [size, suffix] of groups) {
    if (count >= size) return `${(count / size).toFixed(count / size >= 100 ? 0 : 1)}${suffix}`;
  }
  return `${Math.round(count)}`;
}

export function confidence(score: number, reasons: string[]): Confidence {
  const clamped = Math.max(0, Math.min(1, score));
  const tier: ConfidenceTier = clamped >= 0.85 ? "high" : clamped >= 0.5 ? "medium" : "low";
  return { tier, score: Number(clamped.toFixed(3)), reasons };
}

interface EstimateSeed {
  metric: string;
  unit: Unit;
  method: string;
  explanation: string;
  value?: number | null;
  perSample?: number | null;
  range?: Estimate["range"];
  assumptions?: string[];
  warnings?: string[];
  missingInputs?: string[];
  unsupported?: string[];
  confidence?: Confidence;
  state?: ValueState;
  measuredOn?: string;
}

/** Single construction site so no estimator forgets part of the schema. */
export function buildEstimate(state: ValueState, seed: EstimateSeed): Estimate {
  const known = state === "estimated" || state === "measured";
  return {
    metric: seed.metric,
    state,
    unit: seed.unit,
    value: known ? (seed.value ?? null) : null,
    perSample: known ? (seed.perSample ?? null) : null,
    range: known ? (seed.range ?? null) : null,
    method: seed.method,
    confidence: seed.confidence ?? (known ? confidence(0.9, ["closed-form rule"]) : confidence(0, ["value could not be computed"])),
    assumptions: seed.assumptions ?? [],
    warnings: seed.warnings ?? [],
    missingInputs: seed.missingInputs ?? [],
    unsupported: seed.unsupported ?? [],
    explanation: seed.explanation,
    measuredOn: seed.measuredOn,
  };
}

export function mergeMeta(estimate: Estimate, patch: Partial<Estimate>): Estimate {
  return {
    ...estimate,
    assumptions: unique([...estimate.assumptions, ...(patch.assumptions ?? [])]),
    warnings: unique([...estimate.warnings, ...(patch.warnings ?? [])]),
    missingInputs: unique([...estimate.missingInputs, ...(patch.missingInputs ?? [])]),
    unsupported: unique([...estimate.unsupported, ...(patch.unsupported ?? [])]),
  };
}

export function unique<T>(items: T[]): T[] {
  return [...new Set(items)];
}

export function worstState(states: ValueState[]): ValueState {
  if (states.includes("unsupported")) return "unsupported";
  if (states.includes("unavailable")) return "unavailable";
  if (states.includes("estimated")) return "estimated";
  return states.includes("measured") ? "measured" : "unavailable";
}

export function lowestConfidence(parts: Confidence[]): Confidence {
  if (parts.length === 0) return confidence(0, ["no contributing estimates"]);
  const score = parts.reduce((min, part) => Math.min(min, part.score), 1);
  const reasons = unique(parts.filter((part) => part.score <= score).flatMap((part) => part.reasons));
  return confidence(score, reasons.length > 0 ? reasons : ["degraded by the weakest contributing rule"]);
}

/** Deterministic JSON: key order never depends on insertion order. */
export function stableStringify(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value) ?? "null";
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(",")}]`;
  const entries = Object.entries(value as Record<string, unknown>)
    .filter(([, item]) => item !== undefined && typeof item !== "function")
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
  return `{${entries.map(([key, item]) => `${JSON.stringify(key)}:${stableStringify(item)}`).join(",")}}`;
}

/** FNV-1a: cheap, stable across runs and platforms. */
export function hashString(input: string): string {
  let hash = 0x811c9dc5;
  for (let index = 0; index < input.length; index += 1) {
    hash ^= input.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash.toString(16).padStart(8, "0");
}

export function signatureOf(parts: unknown[]): string {
  return hashString(stableStringify(parts));
}

/** Config access with explicit absence, handed to custom operation rules. */
export function makeEstimateContext(
  nodeId: string,
  op: string,
  config: Record<string, unknown>,
  inputs: Dim[][],
  batch: number | null,
): EstimateContext {
  return {
    nodeId,
    op,
    config,
    inputs,
    batch,
    number: (key: string, fallback?: number) => {
      const value = config[key];
      if (typeof value === "number" && Number.isFinite(value)) return value;
      return fallback ?? null;
    },
    boolean: (key: string, fallback?: boolean) => {
      const value = config[key];
      return typeof value === "boolean" ? value : fallback ?? null;
    },
  };
}

export function resolveRule<T>(
  rule: number | ((ctx: EstimateContext) => T | null) | undefined | null,
  ctx: EstimateContext,
): number | null {
  if (rule === undefined || rule === null) return null;
  if (typeof rule === "number") return Number.isFinite(rule) ? rule : null;
  const value = rule(ctx);
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

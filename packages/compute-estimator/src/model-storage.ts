import { buildEstimate, precisionBytes } from "./util";
import type { Estimate, Precision } from "./types";

/** Estimate weight-file storage only; model metadata and tokenizer files are excluded. */
export function estimateModelWeightStorage(
  parameterCount: number | null,
  precision: Precision,
): Estimate {
  const bytesPerParameter = precisionBytes(precision);
  if (
    parameterCount === null ||
    !Number.isSafeInteger(parameterCount) ||
    parameterCount < 0 ||
    bytesPerParameter === null
  ) {
    return buildEstimate("unavailable", {
      metric: "model weight storage",
      unit: "bytes",
      method: "parameter count × bytes per parameter",
      explanation: "A non-negative parameter count and a supported precision are required.",
      missingInputs: parameterCount === null ? ["parameterCount"] : [],
      warnings: bytesPerParameter === null ? [`Unsupported precision: ${precision}.`] : [],
    });
  }

  const value = parameterCount * bytesPerParameter;
  if (!Number.isSafeInteger(value)) {
    return buildEstimate("unavailable", {
      metric: "model weight storage",
      unit: "bytes",
      method: "parameter count × bytes per parameter",
      explanation: "The projected storage exceeds JavaScript's exact integer range.",
      warnings: ["Storage estimate overflowed the exact integer range."],
    });
  }

  return buildEstimate("estimated", {
    metric: "model weight storage",
    unit: "bytes",
    value,
    method: "parameter count × bytes per parameter",
    explanation: `Estimated weight storage for ${precision} parameters.`,
    confidence: { tier: "high", score: 1, reasons: ["closed-form from checkpoint tensor metadata"] },
    assumptions: ["Each parameter is stored at the selected precision."],
    warnings: ["Excludes configuration, tokenizer, and other non-weight files."],
  });
}

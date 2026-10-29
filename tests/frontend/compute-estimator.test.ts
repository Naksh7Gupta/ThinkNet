import { describe, expect, it } from "vitest";
import { estimateModelWeightStorage } from "../../packages/compute-estimator/src/model-storage";

describe("model weight storage estimator", () => {
  it("uses the selected target precision for a reusable parameter estimate", () => {
    const fp16 = estimateModelWeightStorage(1_000_000, "float16");
    const bf16 = estimateModelWeightStorage(1_000_000, "bfloat16");

    expect(fp16.state).toBe("estimated");
    expect(fp16.value).toBe(2_000_000);
    expect(bf16.value).toBe(fp16.value);
    expect(fp16.warnings).toContain("Excludes configuration, tokenizer, and other non-weight files.");
  });

  it("does not invent a storage value when parameter metadata is unavailable", () => {
    const result = estimateModelWeightStorage(null, "float16");

    expect(result.state).toBe("unavailable");
    expect(result.value).toBeNull();
    expect(result.missingInputs).toContain("parameterCount");
  });
});

import path from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["../../tests/frontend/**/*.test.ts"],
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "../../src"),
      "@thinknet/compute-estimator": path.resolve(__dirname, "../../packages/compute-estimator/src"),
    },
  },
});

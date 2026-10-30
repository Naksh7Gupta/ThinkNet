import { Calculator, HardDrive } from "lucide-react";
import { useMemo, useState } from "react";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  estimateModelWeightStorage,
  formatBytes,
  formatCount,
  type Precision,
} from "@thinknet/compute-estimator";
import { estimateGraphParameters } from "@/lib/graph-parameters";
import { toGraphDef } from "@/lib/graph";
import { useDesignerStore } from "@/store/designer-store";
import type { LocalModelInspection } from "@/types/api";

const PRECISIONS: { value: Precision; label: string }[] = [
  { value: "float32", label: "FP32" },
  { value: "float16", label: "FP16" },
  { value: "bfloat16", label: "BF16" },
  { value: "int8", label: "INT8" },
  { value: "int4", label: "INT4" },
];

function isInspection(value: unknown): value is LocalModelInspection {
  return (
    typeof value === "object" &&
    value !== null &&
    "model_name" in value &&
    typeof value.model_name === "string" &&
    "parameter_count" in value &&
    typeof value.parameter_count === "number"
  );
}

export function ComputeEstimatorPanel() {
  const nodes = useDesignerStore((state) => state.nodes);
  const edges = useDesignerStore((state) => state.edges);
  const graphName = useDesignerStore((state) => state.graphName);
  const assets = useDesignerStore((state) => state.localAssets);
  const [precision, setPrecision] = useState<Precision>("float16");

  const sources = useMemo(() => {
    const graph = toGraphDef(graphName, nodes, edges);
    const graphParameters = estimateGraphParameters(graph);
    const canvasModel = graph.nodes.length > 0
      ? [{
          id: "canvas",
          name: "Designed canvas model",
          detail: `${formatCount(graphParameters.parameterCount)} known parameters`,
          parameterCount: graphParameters.parameterCount,
          unsupportedNodes: graphParameters.unsupportedNodes,
        }]
      : [];
    const loadedModels = nodes.flatMap((node) => {
      if (node.data.typeName !== "ModelLoader" || !isInspection(node.data.config.model_info)) {
        return [];
      }
      const info = node.data.config.model_info;
      return [{
        id: `node:${node.id}`,
        name: info.model_name,
        detail: `${info.architecture} · ${formatCount(info.parameter_count)} parameters`,
        parameterCount: info.parameter_count,
        unsupportedNodes: [],
      }];
    });
    const outputAssets = assets.map((asset) => ({
      id: `asset:${asset.path}`,
      name: asset.model_name,
      detail: `${asset.dtype.toUpperCase()} asset · ${formatCount(asset.parameter_count)} parameters`,
      parameterCount: asset.parameter_count,
      unsupportedNodes: [],
    }));
    return [...canvasModel, ...loadedModels, ...outputAssets];
  }, [assets, edges, graphName, nodes]);

  const [selectedSourceId, setSelectedSourceId] = useState("");
  const selectedSource =
    sources.find((source) => source.id === selectedSourceId) ?? sources[0] ?? null;
  const estimate = estimateModelWeightStorage(selectedSource?.parameterCount ?? null, precision);
  const precisionLabel = PRECISIONS.find((item) => item.value === precision)?.label ?? precision;

  return (
    <div className="flex h-full flex-col">
      <div className="border-b border-border px-3 pb-3 pt-3">
        <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
          <Calculator className="h-4 w-4" />
          Compute Estimator
        </div>
        <p className="mt-1 text-[11px] leading-4 text-muted-foreground">
          Estimate weight storage for a designed canvas graph or loaded model.
        </p>
      </div>
      <ScrollArea className="flex-1">
        <div className="space-y-4 p-3">
          {sources.length === 0 ? (
            <p className="rounded-md border border-dashed border-border px-3 py-4 text-center text-xs leading-5 text-muted-foreground">
              Add model nodes to the canvas, inspect a local model, or create a model in the Quantizer workflow.
            </p>
          ) : (
            <>
              <label className="block text-[11px] text-muted-foreground">
                Model
                <select
                  aria-label="Model to estimate"
                  className="mt-1 h-9 w-full rounded-md border border-border bg-background px-2 text-xs text-foreground"
                  value={selectedSource?.id ?? ""}
                  onChange={(event) => setSelectedSourceId(event.target.value)}
                >
                  {sources.map((source) => (
                    <option key={source.id} value={source.id}>{source.name}</option>
                  ))}
                </select>
                {selectedSource && (
                  <span className="mt-1 block truncate text-[10px]" title={selectedSource.detail}>
                    {selectedSource.detail}
                  </span>
                )}
              </label>
              <label className="block text-[11px] text-muted-foreground">
                Target precision
                <select
                  aria-label="Target precision"
                  className="mt-1 h-9 w-full rounded-md border border-border bg-background px-2 text-xs text-foreground"
                  value={precision}
                  onChange={(event) => setPrecision(event.target.value as Precision)}
                >
                  {PRECISIONS.map((item) => (
                    <option key={item.value} value={item.value}>{item.label}</option>
                  ))}
                </select>
              </label>
              <section className="rounded-lg border border-border bg-background p-3">
                <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
                  <HardDrive className="h-4 w-4" />
                  Estimated weight storage
                </div>
                {estimate.value !== null ? (
                  <>
                    <p className="mt-2 text-2xl font-semibold text-foreground">
                      {formatBytes(estimate.value)}
                    </p>
                    <p className="mt-1 text-[10px] text-muted-foreground">
                      {formatCount(selectedSource?.parameterCount ?? 0)}
                      {selectedSource?.unsupportedNodes.length ? " known parameters" : " parameters"}
                      {" "}at {precisionLabel}
                    </p>
                  </>
                ) : (
                  <p className="mt-2 text-xs text-muted-foreground">{estimate.explanation}</p>
                )}
              </section>
              <p className="text-[10px] leading-4 text-muted-foreground">
                This is a storage estimate for weights only. It excludes activations, runtime memory,
                configuration, tokenizer files, and precision-specific conversion compatibility.
              </p>
              {selectedSource && selectedSource.unsupportedNodes.length > 0 && (
                <p className="text-[10px] leading-4 text-warning" role="status">
                  Partial canvas estimate: counts are unavailable for{" "}
                  {selectedSource.unsupportedNodes.join(", ")}. The displayed value is only the known-parameter subtotal.
                </p>
              )}
              {estimate.warnings.map((warning) => (
                <p key={warning} className="text-[10px] leading-4 text-muted-foreground">{warning}</p>
              ))}
            </>
          )}
        </div>
      </ScrollArea>
    </div>
  );
}

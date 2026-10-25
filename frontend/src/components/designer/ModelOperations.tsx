import { useMutation } from "@tanstack/react-query";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { ApiError, api } from "@/lib/api";
import { formatCount } from "@/lib/utils";
import { useDesignerStore } from "@/store/designer-store";
import type { CatalogNode, ExportResponse, ModelMetadata } from "@/types/api";

export function ModelOperations({ catalog }: { catalog: CatalogNode[] }) {
  const models = useDesignerStore((s) => s.models);
  const inspectedModel = useDesignerStore((s) => s.inspectedModel);
  const setInspectedModel = useDesignerStore((s) => s.setInspectedModel);
  const addModel = useDesignerStore((s) => s.addModel);
  const removeModel = useDesignerStore((s) => s.removeModel);
  const getGraph = useDesignerStore((s) => s.getGraph);
  const setLastError = useDesignerStore((s) => s.setLastError);
  const setLastNote = useDesignerStore((s) => s.setLastNote);
  const [metadata, setMetadata] = useState<ModelMetadata | null>(null);
  const [exportResult, setExportResult] = useState<ExportResponse | null>(null);

  const quantizer = catalog.find((item) => item.type === "Quantizer");
  const dtypes =
    quantizer?.config_fields?.find((field) => field.name === "dtype")?.options ?? [
      { label: "INT8 (dynamic Linear quantization)", value: "int8" },
      { label: "Float16", value: "float16" },
      { label: "BFloat16", value: "bfloat16" },
    ];
  const [dtype, setDtype] = useState(String(quantizer?.config_fields?.[0]?.default ?? "int8"));

  function handleError(error: unknown) {
    setLastError(error instanceof Error ? error.message : "An unexpected error occurred while processing the request.");
  }

  const inspect = useMutation({
    mutationFn: (modelId: string) => api.getModel(modelId),
    onSuccess: (data) => {
      setLastError(null);
      setMetadata(data);
      setInspectedModel(data.model_id);
    },
    onError: handleError,
  });

  const quantize = useMutation({
    mutationFn: () => {
      if (!inspectedModel) throw new ApiError("Compile a model first, then select it to quantize.", 0);
      return api.quantizeModel(inspectedModel, dtype);
    },
    onSuccess: (data) => {
      setLastError(null);
      setLastNote(data.note);
      addModel({
        model_id: data.model_id,
        parameter_count: data.parameter_count,
        note: data.note,
        origin: "quantize",
        dtype: data.dtype,
        source_model_id: data.source_model_id,
        report: data.report,
        graphName: models.find((model) => model.model_id === data.source_model_id)?.graphName ?? getGraph().name,
      });
      setMetadata(null);
    },
    onError: handleError,
  });

  const remove = useMutation({
    mutationFn: (modelId: string) => api.deleteModel(modelId),
    onSuccess: (data) => {
      setLastError(null);
      removeModel(data.model_id);
      if (metadata?.model_id === data.model_id) setMetadata(null);
      setLastNote(`Released in-memory handle ${data.model_id}.`);
    },
    onError: handleError,
  });

  const exportSource = useMutation({
    mutationFn: () => api.exportSource(getGraph()),
    onSuccess: (data) => {
      setLastError(null);
      setLastNote(`${data.note} Runtime: ${data.runtime_dependency}`);
      setExportResult(data);
    },
    onError: handleError,
  });

  const selected = models.find((model) => model.model_id === inspectedModel);

  return (
    <div className="border-t border-border">
      <div className="px-4 py-3">
        <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
          Model operations
        </div>
        <p className="mt-1 text-[11px] leading-4 text-muted-foreground">
          Compile creates an in-memory handle. Quantizer is a model transform, not a tensor-graph
          node. INT8 applies only to Linear modules.
        </p>
      </div>
      <ScrollArea className="h-40">
        <div className="space-y-1 px-3 pb-2">
          {models.length === 0 && (
            <p className="px-1 text-[12px] text-muted-foreground">No compiled models in this session.</p>
          )}
          {models.map((model) => (
            <button
              key={model.model_id}
              type="button"
              onClick={() => {
                setInspectedModel(model.model_id);
                inspect.mutate(model.model_id);
              }}
              className={`w-full rounded-md border px-2 py-1.5 text-left ${
                inspectedModel === model.model_id ? "border-primary/40 bg-accent" : "border-transparent hover:bg-muted"
              }`}
            >
              <div className="truncate font-mono text-[11px]">{model.model_id}</div>
              <div className="text-[11px] text-muted-foreground">
                {model.origin}
                {model.dtype ? ` · ${model.dtype}` : ""} · {formatCount(model.parameter_count)} params
              </div>
            </button>
          ))}
        </div>
      </ScrollArea>
      <Separator />
      <div className="space-y-2 px-4 py-3">
        <label className="block text-xs text-muted-foreground">
          Quantization dtype
          <select
            className="mt-1 h-8 w-full rounded-md border border-border bg-card px-2 text-sm"
            value={dtype}
            onChange={(event) => setDtype(event.target.value)}
          >
            {dtypes.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
        <div className="flex flex-wrap gap-1.5">
          <Button
            size="sm"
            variant="secondary"
            disabled={!inspectedModel || quantize.isPending}
            onClick={() => quantize.mutate()}
          >
            Quantize
          </Button>
          <Button
            size="sm"
            variant="secondary"
            disabled={!inspectedModel || remove.isPending}
            onClick={() => inspectedModel && remove.mutate(inspectedModel)}
          >
            Release
          </Button>
          <Button size="sm" variant="secondary" onClick={() => exportSource.mutate()} disabled={exportSource.isPending}>
            Preview export
          </Button>
        </div>
        {selected?.report && (
          <p className="text-[11px] leading-4 text-muted-foreground">
            {selected.dtype === "int8"
              ? `Dynamic INT8 Linear modules: ${selected.report.dynamic_int8_linear_modules}. Other layers keep their original dtype.`
              : `Floating parameters converted: ${formatCount(selected.report.floating_parameter_count)}.`}
          </p>
        )}
        {metadata && metadata.model_id === inspectedModel && (
          <p className="font-mono text-[11px] text-muted-foreground">
            modules {metadata.module_count} · training {String(metadata.training)} · params{" "}
            {formatCount(metadata.parameter_count)}
          </p>
        )}
      </div>
      <Dialog open={exportResult !== null} onOpenChange={(open) => !open && setExportResult(null)}>
        <DialogContent>
          <DialogTitle>Exported Python source</DialogTitle>
          {exportResult && (
            <>
              <p className="text-[12px] leading-5 text-muted-foreground">{exportResult.note}</p>
              <p className="text-[11px] text-muted-foreground">Depends on: {exportResult.runtime_dependency}</p>
              <pre className="max-h-[48vh] overflow-auto rounded-md border border-border bg-muted p-3 text-[11px] leading-5">
                {exportResult.python_source}
              </pre>
              <Button
                variant="secondary"
                onClick={() => {
                  const blob = new Blob([exportResult.python_source], { type: "text/x-python" });
                  const url = URL.createObjectURL(blob);
                  const link = document.createElement("a");
                  link.href = url;
                  link.download = exportResult.filename;
                  document.body.appendChild(link);
                  link.click();
                  link.remove();
                  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
                }}
              >
                Download {exportResult.filename}
              </Button>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

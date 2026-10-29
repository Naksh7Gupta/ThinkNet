import { useMutation } from "@tanstack/react-query";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { ApiError, api } from "@/lib/api";
import { formatCount } from "@/lib/utils";
import { useDesignerStore } from "@/store/designer-store";
import type { ExportResponse, ModelMetadata } from "@/types/api";

export function ModelOperations() {
  const models = useDesignerStore((s) => s.models);
  const inspectedModel = useDesignerStore((s) => s.inspectedModel);
  const setInspectedModel = useDesignerStore((s) => s.setInspectedModel);
  const getGraph = useDesignerStore((s) => s.getGraph);
  const setLastError = useDesignerStore((s) => s.setLastError);
  const setLastNote = useDesignerStore((s) => s.setLastNote);
  const [metadata, setMetadata] = useState<ModelMetadata | null>(null);
  const [exportResult, setExportResult] = useState<ExportResponse | null>(null);

  function handleError(error: unknown) {
    setLastError(error instanceof ApiError ? error.message : "Request failed.");
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
          Compiled models
        </div>
        <p className="mt-1 text-[11px] leading-4 text-muted-foreground">
          Compile creates an in-memory handle. Quantized local checkpoints are available in Assets.
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
      <div className="space-y-2 px-4 py-3">
        <Button size="sm" variant="secondary" onClick={() => exportSource.mutate()} disabled={exportSource.isPending}>
          Preview export
        </Button>
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
                  link.click();
                  URL.revokeObjectURL(url);
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

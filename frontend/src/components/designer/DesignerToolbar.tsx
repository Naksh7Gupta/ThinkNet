import { useMutation } from "@tanstack/react-query";
import { useReactFlow, useViewport } from "@xyflow/react";
import { Boxes, CheckCircle2, Download, Minus, Play, Plus, ScanSearch } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { api } from "@/lib/api";
import {
  architectureGraph,
  exampleMlpGraph,
  exampleResidualGraph,
} from "@/lib/graph";
import { parseIntList } from "@/lib/node-config";
import { cn } from "@/lib/utils";
import { useDesignerStore } from "@/store/designer-store";
import type { ArchitectureInfo, CatalogNode } from "@/types/api";

export function DesignerToolbar({
  catalog,
  architectures,
  onToggleLibrary,
}: {
  catalog: CatalogNode[];
  architectures: ArchitectureInfo[];
  onToggleLibrary: () => void;
}) {
  const graphName = useDesignerStore((s) => s.graphName);
  const setGraphName = useDesignerStore((s) => s.setGraphName);
  const getGraph = useDesignerStore((s) => s.getGraph);
  const loadGraph = useDesignerStore((s) => s.loadGraph);
  const validation = useDesignerStore((s) => s.lastValidation);
  const setValidation = useDesignerStore((s) => s.setValidation);
  const setShapePreview = useDesignerStore((s) => s.setShapePreview);
  const setLastError = useDesignerStore((s) => s.setLastError);
  const setLastNote = useDesignerStore((s) => s.setLastNote);
  const addModel = useDesignerStore((s) => s.addModel);
  const [runtimeShape, setRuntimeShape] = useState("");
  const { zoomIn, zoomOut } = useReactFlow();
  const { zoom } = useViewport();

  const catalogByType = new Map(catalog.map((item) => [item.type, item]));

  function handleError(error: unknown) {
    const message = error instanceof Error ? error.message : "An unexpected error occurred while processing the request.";
    setLastError(message);
  }

  const validate = useMutation({
    mutationFn: () => api.validateGraph(getGraph()),
    onSuccess: (data) => {
      setLastError(null);
      setValidation(data);
      setLastNote(
        data.valid
          ? `Validated ${data.node_count} nodes and ${data.edge_count} edges.`
          : null,
      );
    },
    onError: handleError,
  });

  const preview = useMutation({
    mutationFn: () => api.inferShapes(getGraph(), parseIntList(runtimeShape) ?? undefined),
    onSuccess: (data) => {
      setLastError(null);
      setShapePreview(data);
      setLastNote(data.note);
    },
    onError: handleError,
  });

  const compile = useMutation({
    mutationFn: () => api.compileModel(getGraph()),
    onSuccess: (data) => {
      setLastError(null);
      setShapePreview(data.shape_preview);
      setLastNote(data.note);
      setValidation({
        valid: true,
        errors: [],
        node_count: getGraph().nodes.length,
        edge_count: getGraph().edges.length,
      });
      addModel({
        model_id: data.model_id,
        parameter_count: data.parameter_count,
        note: data.note,
        origin: "compile",
        graphName: getGraph().name,
      });
    },
    onError: handleError,
  });

  const pill = "flex h-9 items-center rounded-lg border border-border bg-card text-sm";

  return (
    <div className="flex min-h-14 flex-wrap items-center gap-2 border-b border-border bg-background px-4 py-2">
      <div className={cn(pill, "gap-2 px-3")}>
        <span className="text-muted-foreground">Models</span>
        <span className="text-muted-foreground">/</span>
        <input
          value={graphName}
          onChange={(event) => setGraphName(event.target.value)}
          className="w-40 bg-transparent font-medium text-accent-foreground outline-none"
          aria-label="Graph name"
        />
        <span
          title={validation ? (validation.valid ? "Graph valid" : "Graph has errors") : "Not validated yet"}
          className={cn(
            "h-2 w-2 rounded-full",
            validation ? (validation.valid ? "bg-success" : "bg-destructive") : "bg-muted-foreground/50",
          )}
        />
      </div>

      <div className={cn(pill, "gap-2 pl-3")}>
        <Boxes className="h-4 w-4 text-accent-foreground" />
        <select
          className="h-full max-w-44 rounded-lg border-0 bg-transparent pr-2 text-sm outline-none"
          defaultValue=""
          onChange={(event) => {
            const value = event.target.value;
            event.target.value = "";
            if (value === "mlp-layers") loadGraph(exampleMlpGraph(), catalogByType);
            if (value === "residual") loadGraph(exampleResidualGraph(), catalogByType);
            if (architectures.some((item) => item.name === value)) {
              loadGraph(architectureGraph(value), catalogByType);
            }
          }}
          aria-label="Load example"
        >
          <option value="">Template: load example…</option>
          <option value="mlp-layers">Layer graph: Linear MLP</option>
          <option value="residual">Layer graph: ResidualAdd</option>
          {architectures.map((item) => (
            <option key={item.name} value={item.name}>
              Architecture: {item.name}
            </option>
          ))}
        </select>
      </div>

      <Input
        value={runtimeShape}
        onChange={(event) => setRuntimeShape(event.target.value)}
        placeholder="Preview batch shape, e.g. 2, 24"
        className="h-9 w-48"
        aria-label="Optional runtime input shape"
      />

      <div className="ml-auto flex flex-wrap items-center gap-2">
        <div className={cn(pill, "overflow-hidden")}>
          <button
            type="button"
            aria-label="Zoom out"
            className="flex h-full w-9 items-center justify-center text-muted-foreground hover:bg-muted hover:text-foreground"
            onClick={() => void zoomOut({ duration: 120 })}
          >
            <Minus className="h-4 w-4" />
          </button>
          <span className="w-12 text-center tabular-nums">{Math.round(zoom * 100)}%</span>
          <button
            type="button"
            aria-label="Zoom in"
            className="flex h-full w-9 items-center justify-center text-muted-foreground hover:bg-muted hover:text-foreground"
            onClick={() => void zoomIn({ duration: 120 })}
          >
            <Plus className="h-4 w-4" />
          </button>
        </div>
        <Button variant="secondary" onClick={() => validate.mutate()} disabled={validate.isPending}>
          <CheckCircle2 className="h-3.5 w-3.5" />
          Validate
        </Button>
        <Button variant="secondary" onClick={() => preview.mutate()} disabled={preview.isPending}>
          <ScanSearch className="h-3.5 w-3.5" />
          Shapes
        </Button>
        <Button variant="secondary" onClick={() => compile.mutate()} disabled={compile.isPending}>
          <Play className="h-3.5 w-3.5" />
          Compile
        </Button>
        <ExportButton onError={handleError} />
        <Button onClick={onToggleLibrary} className="h-9 px-4">
          <Plus className="h-4 w-4" />
          Add Node
          <kbd className="ml-1 rounded bg-white/15 px-1.5 py-0.5 text-[10px] font-normal">Shift+A</kbd>
        </Button>
      </div>
    </div>
  );
}

function ExportButton({ onError }: { onError: (error: unknown) => void }) {
  const getGraph = useDesignerStore((s) => s.getGraph);
  const setLastError = useDesignerStore((s) => s.setLastError);
  const setLastNote = useDesignerStore((s) => s.setLastNote);

  const exportSource = useMutation({
    mutationFn: () => api.exportSource(getGraph()),
    onSuccess: (data) => {
      setLastError(null);
      setLastNote(`${data.note} Runtime: ${data.runtime_dependency}`);
      const blob = new Blob([data.python_source], { type: "text/x-python" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = data.filename || "exported_model.py";
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    },
    onError,
  });

  return (
    <Button variant="secondary" onClick={() => exportSource.mutate()} disabled={exportSource.isPending}>
      <Download className="h-3.5 w-3.5" />
      Export Python
    </Button>
  );
}
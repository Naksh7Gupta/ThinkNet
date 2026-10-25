import { useMutation } from "@tanstack/react-query";
import { CheckCircle2, Download, Play, ScanSearch } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ApiError, api } from "@/lib/api";
import {
  architectureGraph,
  exampleMlpGraph,
  exampleResidualGraph,
} from "@/lib/graph";
import { parseIntList } from "@/lib/node-config";
import { useDesignerStore } from "@/store/designer-store";
import type { ArchitectureInfo, CatalogNode } from "@/types/api";

export function DesignerToolbar({
  catalog,
  architectures,
}: {
  catalog: CatalogNode[];
  architectures: ArchitectureInfo[];
}) {
  const graphName = useDesignerStore((s) => s.graphName);
  const setGraphName = useDesignerStore((s) => s.setGraphName);
  const getGraph = useDesignerStore((s) => s.getGraph);
  const loadGraph = useDesignerStore((s) => s.loadGraph);
  const setValidation = useDesignerStore((s) => s.setValidation);
  const setShapePreview = useDesignerStore((s) => s.setShapePreview);
  const setLastError = useDesignerStore((s) => s.setLastError);
  const setLastNote = useDesignerStore((s) => s.setLastNote);
  const addModel = useDesignerStore((s) => s.addModel);
  const [runtimeShape, setRuntimeShape] = useState("");

  const catalogByType = new Map(catalog.map((item) => [item.type, item]));

  function handleError(error: unknown) {
    const message = error instanceof ApiError ? error.message : "Request failed.";
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

  return (
    <div className="flex flex-wrap items-center gap-2 border-b border-border bg-card px-3 py-2">
      <Input
        value={graphName}
        onChange={(event) => setGraphName(event.target.value)}
        className="h-8 w-52 font-medium"
        aria-label="Graph name"
      />
      <select
        className="h-8 rounded-md border border-border bg-card px-2 text-sm"
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
        <option value="">Load example…</option>
        <option value="mlp-layers">Layer graph: Linear MLP</option>
        <option value="residual">Layer graph: ResidualAdd</option>
        {architectures.map((item) => (
          <option key={item.name} value={item.name}>
            Architecture: {item.name}
          </option>
        ))}
      </select>
      <Input
        value={runtimeShape}
        onChange={(event) => setRuntimeShape(event.target.value)}
        placeholder="Preview batch shape, e.g. 2, 24"
        className="h-8 w-52"
        aria-label="Optional runtime input shape"
      />
      <div className="ml-auto flex flex-wrap items-center gap-1.5">
        <Button variant="secondary" onClick={() => validate.mutate()} disabled={validate.isPending}>
          <CheckCircle2 className="h-3.5 w-3.5" />
          Validate
        </Button>
        <Button variant="secondary" onClick={() => preview.mutate()} disabled={preview.isPending}>
          <ScanSearch className="h-3.5 w-3.5" />
          Shapes
        </Button>
        <Button onClick={() => compile.mutate()} disabled={compile.isPending}>
          <Play className="h-3.5 w-3.5" />
          Compile
        </Button>
        <ExportButton onError={handleError} />
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
      link.click();
      URL.revokeObjectURL(url);
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

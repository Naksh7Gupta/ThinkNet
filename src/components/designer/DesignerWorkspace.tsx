import { useQuery } from "@tanstack/react-query";
import { ReactFlowProvider } from "@xyflow/react";
import { X } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { AssetsPanel } from "@/components/designer/AssetsPanel";
import { ComputeEstimatorPanel } from "@/components/designer/ComputeEstimatorPanel";
import { DesignerCanvas } from "@/components/designer/DesignerCanvas";
import { DesignerToolbar } from "@/components/designer/DesignerToolbar";
import { IssuesPanel } from "@/components/designer/IssuesPanel";
import { ModelOperations } from "@/components/designer/ModelOperations";
import { NodeInspector } from "@/components/designer/NodeInspector";
import { NodeLibrary } from "@/components/designer/NodeLibrary";
import { api } from "@/lib/api";
import { MODEL_LOADER_CATALOG } from "@/lib/graph";
import { ProjectPanel } from "@/components/designer/ProjectPanel";
import { ToolRail } from "@/components/designer/ToolRail";
import { PipelineWorkspace } from "@/components/pipeline/PipelineWorkspace";

export function DesignerWorkspace() {
  const searchRef = useRef<HTMLInputElement>(null);
  const [libraryOpen, setLibraryOpen] = useState(true);
  const [assetsOpen, setAssetsOpen] = useState(false);
  const [estimatorOpen, setEstimatorOpen] = useState(false);
  const [panelOpen, setPanelOpen] = useState(true);
  const [canvasMode, setCanvasMode] = useState<"architecture" | "pipeline">("architecture");
  const catalog = useQuery({ queryKey: ["nodes"], queryFn: api.listNodes });
  const architectures = useQuery({ queryKey: ["architectures"], queryFn: api.listArchitectures });
  const nodes = useMemo(() => catalog.data?.nodes ?? [], [catalog.data?.nodes]);
  const libraryNodes = useMemo(
    () => [MODEL_LOADER_CATALOG, ...nodes],
    [nodes],
  );
  const architectureList = architectures.data?.architectures ?? [];

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setLibraryOpen(false);
        setAssetsOpen(false);
        setEstimatorOpen(false);
        return;
      }
      if (!event.shiftKey || event.key.toLowerCase() !== "a") return;
      const tag = (event.target as HTMLElement | null)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
      event.preventDefault();
      setLibraryOpen(true);
      setAssetsOpen(false);
      setEstimatorOpen(false);
      requestAnimationFrame(() => searchRef.current?.focus());
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  return (
    <ReactFlowProvider>
      <div className="flex h-full min-h-0 flex-1 flex-col">
        <div className="flex h-10 shrink-0 items-center gap-1 border-b border-border bg-card px-3">
          <button type="button" onClick={() => setCanvasMode("architecture")} aria-pressed={canvasMode === "architecture"} className={"rounded-md px-3 py-1 text-xs font-medium " + (canvasMode === "architecture" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted")}>Architecture Designer</button>
          <button type="button" onClick={() => setCanvasMode("pipeline")} aria-pressed={canvasMode === "pipeline"} className={"rounded-md px-3 py-1 text-xs font-medium " + (canvasMode === "pipeline" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted")}>Pipeline Builder</button>
        </div>
        {canvasMode === "pipeline" ? <PipelineWorkspace /> : <div className="flex min-h-0 flex-1">
        <ToolRail
          libraryOpen={libraryOpen}
          onToggleLibrary={() => {
            setLibraryOpen((v) => !v);
            setAssetsOpen(false);
          }}
          assetsOpen={assetsOpen}
          onToggleAssets={() => {
            setAssetsOpen((value) => !value);
            setLibraryOpen(false);
            setEstimatorOpen(false);
          }}
          estimatorOpen={estimatorOpen}
          onToggleEstimator={() => {
            setEstimatorOpen((value) => !value);
            setLibraryOpen(false);
            setAssetsOpen(false);
          }}
          panelOpen={panelOpen}
          onTogglePanel={() => setPanelOpen((v) => !v)}
        />
        <section className="flex min-w-0 flex-1 flex-col">
          <DesignerToolbar
            catalog={nodes}
            architectures={architectureList}
            onToggleLibrary={() => {
              setLibraryOpen((v) => !v);
              setAssetsOpen(false);
            }}
          />
          <div className="relative flex min-h-0 flex-1 flex-col">
            <DesignerCanvas catalog={libraryNodes} />
            {libraryOpen && (
              <aside className="absolute bottom-3 left-3 top-3 z-20 w-[268px] overflow-hidden rounded-xl border border-border bg-card shadow-2xl">
                <button
                  type="button"
                  aria-label="Close node library"
                  onClick={() => setLibraryOpen(false)}
                  className="absolute right-2 top-2 z-10 rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
                >
                  <X className="h-4 w-4" />
                </button>
                {catalog.isError ? (
                  <div className="p-4 text-sm text-destructive">
                    Node catalog could not be loaded. {catalog.error.message}
                  </div>
                ) : (
                  <NodeLibrary nodes={libraryNodes} searchRef={searchRef} />
                )}
              </aside>
            )}
            {assetsOpen && (
              <aside className="absolute bottom-3 left-3 top-3 z-20 w-[268px] overflow-hidden rounded-xl border border-border bg-card shadow-2xl">
                <button
                  type="button"
                  aria-label="Close Assets panel"
                  onClick={() => setAssetsOpen(false)}
                  className="absolute right-2 top-2 z-10 rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
                >
                  <X className="h-4 w-4" />
                </button>
                <AssetsPanel />
              </aside>
            )}
            {estimatorOpen && (
              <aside className="absolute bottom-3 left-3 top-3 z-20 w-[300px] overflow-hidden rounded-xl border border-border bg-card shadow-2xl">
                <button
                  type="button"
                  aria-label="Close Compute Estimator"
                  onClick={() => setEstimatorOpen(false)}
                  className="absolute right-2 top-2 z-10 rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
                >
                  <X className="h-4 w-4" />
                </button>
                <ComputeEstimatorPanel />
              </aside>
            )}
          </div>
          <IssuesPanel />
        </section>
        {panelOpen && (
          <aside className="flex w-[320px] shrink-0 flex-col overflow-y-auto border-l border-border bg-card">
            <ProjectPanel />
            <NodeInspector architectures={architectureList} />
            <ModelOperations />
          </aside>
        )}
        </div>}
      </div>
    </ReactFlowProvider>
  );
}
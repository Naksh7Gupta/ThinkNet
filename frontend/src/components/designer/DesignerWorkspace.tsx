import { useQuery } from "@tanstack/react-query";
import { ReactFlowProvider } from "@xyflow/react";
import { NodeInspector } from "@/components/designer/NodeInspector";
import { NodeLibrary } from "@/components/designer/NodeLibrary";
import { DesignerCanvas } from "@/components/designer/DesignerCanvas";
import { DesignerToolbar } from "@/components/designer/DesignerToolbar";
import { IssuesPanel } from "@/components/designer/IssuesPanel";
import { ModelOperations } from "@/components/designer/ModelOperations";
import { api } from "@/lib/api";

export function DesignerWorkspace({
  searchRef,
}: {
  searchRef: React.RefObject<HTMLInputElement | null>;
}) {
  const catalog = useQuery({ queryKey: ["nodes"], queryFn: api.listNodes });
  const architectures = useQuery({ queryKey: ["architectures"], queryFn: api.listArchitectures });
  const nodes = catalog.data?.nodes ?? [];
  const architectureList = architectures.data?.architectures ?? [];

  return (
    <div className="flex min-h-0 flex-1">
      <aside className="w-[268px] shrink-0 border-r border-border bg-card">
        {catalog.isError ? (
          <div className="p-4 text-sm text-destructive">
            Node catalog could not be loaded. {catalog.error.message}
          </div>
        ) : (
          <NodeLibrary nodes={nodes} searchRef={searchRef} />
        )}
      </aside>
      <section className="flex min-w-0 flex-1 flex-col">
        <DesignerToolbar catalog={nodes} architectures={architectureList} />
        <ReactFlowProvider>
          <DesignerCanvas catalog={nodes} />
        </ReactFlowProvider>
        <IssuesPanel />
      </section>
      <aside className="flex w-[320px] shrink-0 flex-col border-l border-border bg-card">
        <div className="min-h-0 flex-1">
          <NodeInspector architectures={architectureList} />
        </div>
        <ModelOperations catalog={nodes} />
      </aside>
    </div>
  );
}

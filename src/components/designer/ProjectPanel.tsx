import { useReactFlow } from "@xyflow/react";
import { ChevronDown, ChevronRight, Network, Search } from "lucide-react";
import { useMemo, useState } from "react";
import { Input } from "@/components/ui/input";
import { FRAME_NODE_TYPE } from "@/lib/graph";
import { cn } from "@/lib/utils";
import { useDesignerStore } from "@/store/designer-store";

export function ProjectPanel() {
  const allNodes = useDesignerStore((s) => s.nodes);
  const graphName = useDesignerStore((s) => s.graphName);
  const selectedNodeId = useDesignerStore((s) => s.selectedNodeId);
  const { fitView } = useReactFlow();
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(true);

  // Frames are visual only; they are not part of the model.
  const nodes = useMemo(
    () => allNodes.filter((node) => node.type !== FRAME_NODE_TYPE),
    [allNodes],
  );
  // A ×N frame hides N-1 identical copies. They remain in the model, so the
  // header counts them even though the list mirrors the canvas.
  const drawn = useMemo(() => nodes.filter((node) => !node.hidden), [nodes]);
  const folded = nodes.length - drawn.length;

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return drawn;
    return drawn.filter(
      (node) => node.id.toLowerCase().includes(q) || node.data.typeName.toLowerCase().includes(q),
    );
  }, [drawn, query]);

  function select(id: string) {
    useDesignerStore.setState((state) => ({
      selectedNodeId: id,
      nodes: state.nodes.map((node) => ({ ...node, selected: node.id === id })),
    }));
    void fitView({ nodes: [{ id }], duration: 200, maxZoom: 1, padding: 0.6 });
  }

  return (
    <div className="border-b border-border p-4">
      <div className="mb-3 flex items-center gap-2 text-[15px] font-semibold">
        <Network className="h-4 w-4 text-accent-foreground" />
        Project
      </div>
      <div className="relative">
        <Search className="pointer-events-none absolute left-2 top-2 h-4 w-4 text-muted-foreground" />
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Filter hierarchy..."
          className="pl-8"
        />
      </div>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="mt-3 flex w-full items-center gap-1.5 text-left text-[13px] font-medium"
      >
        {open ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
        <span className="truncate">{graphName || "untitled_architecture"}</span>
        <span
          className="ml-auto text-[12px] font-normal text-muted-foreground"
          title={folded > 0 ? `${drawn.length} shown, ${folded} identical copies folded into ×N blocks` : undefined}
        >
          {nodes.length}
        </span>
      </button>
      {open && (
        <div className="mt-1 max-h-44 space-y-0.5 overflow-y-auto pl-3">
          {filtered.length === 0 && (
            <p className="px-2 py-1 text-[12px] text-muted-foreground">
              {drawn.length === 0 ? "No nodes yet." : "No nodes match this filter."}
            </p>
          )}
          {filtered.map((node) => (
            <button
              key={node.id}
              type="button"
              onClick={() => select(node.id)}
              className={cn(
                "flex w-full items-center gap-2 rounded-md px-2 py-1 text-left text-[13px]",
                selectedNodeId === node.id
                  ? "bg-accent text-accent-foreground"
                  : "text-foreground hover:bg-muted",
              )}
            >
              <span
                className="h-2 w-2 shrink-0 rounded-full"
                style={{ background: node.data.catalog?.color ?? "#64748B" }}
              />
              <span className="truncate">{node.data.typeName}</span>
              <span className="ml-auto truncate font-mono text-[10px] text-muted-foreground">{node.id}</span>
            </button>
          ))}
          {folded > 0 && (
            <p className="px-2 py-1 text-[11px] text-muted-foreground">
              +{folded} identical copies inside the ×N blocks — in the model, drawn once.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
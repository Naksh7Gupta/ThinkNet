import { useMemo, useState } from "react";
import { Search } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { MODEL_TRANSFORM_TYPES, MODEL_WORKFLOW_TYPES } from "@/lib/graph";
import { cn } from "@/lib/utils";
import { useDesignerStore } from "@/store/designer-store";
import type { CatalogNode } from "@/types/api";

function statusVariant(status: string) {
  if (status === "implemented-and-tested") return "success" as const;
  if (status === "partial") return "warning" as const;
  return "muted" as const;
}

export function NodeLibrary({
  nodes,
  searchRef,
}: {
  nodes: CatalogNode[];
  searchRef: React.RefObject<HTMLInputElement | null>;
}) {
  const [query, setQuery] = useState("");
  const addCatalogNode = useDesignerStore((s) => s.addCatalogNode);
  const notice = useDesignerStore((s) => s.libraryNotice);

  const grouped = useMemo(() => {
    const filtered = nodes.filter((node) => {
      const q = query.trim().toLowerCase();
      if (!q) return true;
      return (
        node.type.toLowerCase().includes(q) ||
        node.category.toLowerCase().includes(q) ||
        node.status.toLowerCase().includes(q)
      );
    });
    const map = new Map<string, CatalogNode[]>();
    for (const node of filtered) {
      const list = map.get(node.category) ?? [];
      list.push(node);
      map.set(node.category, list);
    }
    return [...map.entries()];
  }, [nodes, query]);

  return (
    <div className="flex h-full flex-col">
      <div className="px-3 pb-2 pt-3">
        <div className="mb-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
          Node library
        </div>
        <div className="relative">
          <Search className="pointer-events-none absolute left-2 top-2 h-4 w-4 text-muted-foreground" />
          <Input
            ref={searchRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search nodes"
            className="pl-8"
          />
        </div>
        <p className="mt-2 text-[11px] leading-4 text-muted-foreground">
          Shift+A focuses search. Connect Model Loader → Quantizer; completed models appear in Assets.
        </p>
        {notice && <p className="mt-2 text-[11px] leading-4 text-warning">{notice}</p>}
      </div>
      <ScrollArea className="flex-1">
        <div className="space-y-4 px-3 pb-4">
          {grouped.length === 0 && (
            <p className="text-sm text-muted-foreground">No catalog entries match this search.</p>
          )}
          {grouped.map(([category, items]) => (
            <div key={category}>
              <div className="mb-1.5 text-[11px] font-semibold text-muted-foreground">{category}</div>
              <div className="space-y-1">
                {items.map((item) => {
                  const transform = MODEL_TRANSFORM_TYPES.has(item.type);
                  const workflowNode = MODEL_WORKFLOW_TYPES.has(item.type);
                  return (
                    <button
                      key={item.type}
                      type="button"
                      draggable={!transform || workflowNode}
                      onDragStart={(event) => {
                        if (transform && !workflowNode) {
                          event.preventDefault();
                          return;
                        }
                        event.dataTransfer.setData("application/thinknet-node", item.type);
                        event.dataTransfer.effectAllowed = "copy";
                      }}
                      onClick={() => addCatalogNode(item)}
                      className={cn(
                        "flex w-full items-start gap-2 rounded-md border border-transparent px-2 py-1.5 text-left hover:border-border hover:bg-muted",
                      )}
                    >
                      <span
                        className="mt-1 h-2.5 w-2.5 shrink-0 rounded-sm"
                        style={{ background: item.color }}
                      />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[13px] font-medium">{item.type}</span>
                        <span className="mt-1 flex flex-wrap gap-1">
                          <Badge variant={statusVariant(item.status)}>
                            {item.status.replaceAll("-", " ")}
                          </Badge>
                          {workflowNode && <Badge>model workflow</Badge>}
                        </span>
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </ScrollArea>
    </div>
  );
}

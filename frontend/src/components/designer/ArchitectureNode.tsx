import { Handle, Position, type NodeProps } from "@xyflow/react";
import { isMergeType, isMultiInputType, type ThinkNetNode } from "@/lib/graph";
import { cn } from "@/lib/utils";

function statusLabel(status: string | undefined): string {
  if (status === "implemented-and-tested") return "tested";
  if (status === "partial") return "partial";
  if (status === "metadata-only") return "catalog only";
  return status ?? "";
}

export function ArchitectureNode({ data, selected }: NodeProps<ThinkNetNode>) {
  const catalog = data.catalog;
  const color = catalog?.color ?? "#64748B";
  const typeName = data.typeName;
  const merge = isMergeType(typeName);
  const multi = isMultiInputType(typeName);
  const isInput = typeName === "Input";
  const isOutput = typeName === "Output";

  return (
    <div
      className={cn(
        "rounded-lg border bg-card shadow-[0_1px_2px_rgb(16_24_40_/_8%)]",
        selected ? "ring-2 ring-primary/30 border-primary/40" : "border-border",
      )}
      style={{ minHeight: catalog?.height ?? 64 }}
    >
      {!isInput && !merge && !multi && (
        <Handle id="input" type="target" position={Position.Left} style={{ background: color }} />
      )}
      {merge && (
        <>
          <Handle id="main" type="target" position={Position.Left} style={{ top: "32%", background: color }} />
          <Handle id="skip" type="target" position={Position.Left} style={{ top: "68%", background: color }} />
        </>
      )}
      {typeName === "Concat" && (
        <>
          <Handle id="input" type="target" position={Position.Left} style={{ top: "32%", background: color }} />
          <Handle id="input_b" type="target" position={Position.Left} style={{ top: "68%", background: color }} />
        </>
      )}
      <div
        className="flex items-center justify-between gap-2 rounded-t-[7px] px-2.5 py-1.5 text-white"
        style={{ background: color }}
      >
        <span className="text-[12px] font-semibold tracking-wide">{typeName}</span>
        {catalog?.size && <span className="text-[10px] opacity-80">{catalog.size}</span>}
      </div>
      <div className="px-2.5 py-1.5">
        <div className="text-[10px] uppercase tracking-wide text-muted-foreground">
          {catalog?.category ?? "Node"}
        </div>
        <div className="mt-0.5 text-[11px] text-muted-foreground">{statusLabel(catalog?.status)}</div>
        {merge && (
          <div className="mt-1 flex justify-between text-[10px] text-muted-foreground">
            <span>main / skip</span>
            <span>out</span>
          </div>
        )}
      </div>
      {!isOutput && (
        <Handle id="output" type="source" position={Position.Right} style={{ background: color }} />
      )}
    </div>
  );
}

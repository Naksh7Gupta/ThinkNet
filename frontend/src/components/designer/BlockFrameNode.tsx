import type { NodeProps } from "@xyflow/react";
import type { ThinkNetNode } from "@/lib/graph";

/** Purely visual dashed frame, like the "Decoder Block" box in the diagram. */
export function BlockFrameNode({ data }: NodeProps<ThinkNetNode>) {
  return (
    <div className="pointer-events-none relative h-full w-full rounded-xl border-2 border-dashed border-[#6b7280]/70">
      <span className="absolute -bottom-6 right-1 text-[11px] font-medium text-muted-foreground">
        {data.frameLabel}
      </span>
    </div>
  );
}
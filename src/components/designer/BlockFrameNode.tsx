import type { NodeProps } from "@xyflow/react";
import type { ThinkNetNode } from "@/lib/graph";

/**
 * Purely visual dashed frame, like the "Decoder Block" box in the diagram.
 *
 * A frame with `frameCount` stands for that many identical blocks: only one copy
 * is drawn and the badge on its left edge carries the repeat count. The other
 * copies stay in the graph and in every export; they are only hidden on canvas.
 */
export function BlockFrameNode({ data }: NodeProps<ThinkNetNode>) {
  const count = data.frameCount ?? 0;
  return (
    <div className="pointer-events-none relative h-full w-full rounded-xl border-2 border-dashed border-[#6b7280]/70">
      {count > 1 && (
        <span
          title={`${count} identical blocks — drawn once`}
          className="absolute left-0 top-1/2 flex h-[22px] min-w-[40px] -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border border-[#F0A944]/60 bg-[#1A1F2B] px-2 text-[11.5px] font-semibold leading-none tracking-wide text-[#F0A944]"
        >
          ×{count}
        </span>
      )}
      <span className="absolute -bottom-6 right-1 text-[11px] font-medium text-muted-foreground">
        {data.frameLabel}
      </span>
    </div>
  );
}

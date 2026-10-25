import { Handle, Position, type NodeProps } from "@xyflow/react";
import {
  ArrowRightLeft,
  Box,
  Boxes,
  Cpu,
  Eye,
  GitMerge,
  Hash,
  Image as ImageIcon,
  Layers,
  Maximize2,
  MapPin,
  MessageSquare,
  Network,
  Shuffle,
  SlidersHorizontal,
  Wrench,
  Zap,
  type LucideIcon,
} from "lucide-react";
import { isMergeType, isMultiInputType, type ThinkNetNode } from "@/lib/graph";
import {
  fieldsForNode,
  readConfigValue,
  setConfigValue,
  type ConfigField,
} from "@/lib/node-config";
import { cn } from "@/lib/utils";
import { useDesignerStore } from "@/store/designer-store";

const CATEGORY_ICONS: Record<string, LucideIcon> = {
  "I/O": ArrowRightLeft,
  Utility: Wrench,
  Core: Layers,
  Embedding: Hash,
  Position: MapPin,
  Normalization: SlidersHorizontal,
  Regularization: Shuffle,
  Activation: Zap,
  FFN: Network,
  Attention: Eye,
  Merge: GitMerge,
  Transformer: Boxes,
  Vision: ImageIcon,
  Shape: Maximize2,
  Architecture: Box,
  "Model Transform": Cpu,
  "Language Model": MessageSquare,
};

function statusLabel(status: string | undefined): string {
  if (status === "implemented-and-tested") return "tested";
  if (status === "partial") return "partial";
  if (status === "metadata-only") return "catalog only";
  return status ?? "";
}

function statusDot(status: string | undefined): string {
  if (status === "implemented-and-tested") return "bg-success";
  if (status === "partial") return "bg-warning";
  return "bg-muted-foreground";
}

const INLINE_KINDS = new Set(["int", "float", "bool", "select"]);

function InlineField({
  nodeId,
  field,
  config,
}: {
  nodeId: string;
  field: ConfigField;
  config: Record<string, unknown>;
}) {
  const update = useDesignerStore((s) => s.updateNodeConfig);
  const value = readConfigValue(config, field);
  const box =
    "nodrag nowheel h-6 w-[92px] rounded-md border border-border bg-background px-2 font-mono text-[11px] text-foreground outline-none focus-visible:ring-1 focus-visible:ring-ring";

  function commit(event: React.FocusEvent<HTMLInputElement>) {
    const raw = event.target.value;
    if (raw === "") {
      update(nodeId, setConfigValue(config, field, undefined));
      return;
    }
    const parsed = field.kind === "int" ? Number.parseInt(raw, 10) : Number(raw);
    if (Number.isNaN(parsed)) {
      event.target.value = value === undefined || value === null ? "" : String(value);
      return;
    }
    if (parsed !== value) update(nodeId, setConfigValue(config, field, parsed));
  }

  let control: React.ReactNode;
  if (field.kind === "bool") {
    control = (
      <input
        type="checkbox"
        className="nodrag h-3.5 w-3.5 accent-[#6d5df6]"
        checked={Boolean(value)}
        onChange={(e) => update(nodeId, setConfigValue(config, field, e.target.checked))}
      />
    );
  } else if (field.kind === "select") {
    control = (
      <select
        className={cn(box, "text-left")}
        value={typeof value === "string" ? value : ""}
        onChange={(e) => update(nodeId, setConfigValue(config, field, e.target.value))}
      >
        {(field.options ?? []).map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    );
  } else {
    control = (
      <input
        key={String(value)}
        type="number"
        className={cn(box, "text-right")}
        step={field.step}
        min={field.min}
        max={field.max}
        defaultValue={value === undefined || value === null ? "" : String(value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === "Enter") e.currentTarget.blur();
        }}
      />
    );
  }

  return (
    <div className="flex items-center justify-between gap-2 py-1">
      <span className="truncate text-[12px] text-muted-foreground">{field.label}</span>
      {control}
    </div>
  );
}

export function ArchitectureNode({ id, data, selected }: NodeProps<ThinkNetNode>) {
  const shape = useDesignerStore((s) => s.lastShapePreview?.shapes?.[id]);
  const catalog = data.catalog;
  const color = catalog?.color ?? "#64748B";
  const typeName = data.typeName;
  const merge = isMergeType(typeName);
  const multi = isMultiInputType(typeName);
  const isInput = typeName === "Input";
  const isOutput = typeName === "Output";
  const Icon = CATEGORY_ICONS[catalog?.category ?? ""] ?? Box;

  const fields = fieldsForNode(typeName, data.config, catalog);
  const editable = fields
    .filter(
      (f) =>
        INLINE_KINDS.has(f.kind) &&
        !f.label.includes("(alias)") &&
        f.key !== "architecture" &&
        (f.kind !== "select" || (f.options?.length ?? 0) > 0),
    )
    .slice(0, 4);
  const readOnly = fields.filter((f) => f.kind === "int-list").slice(0, 1);

  return (
    <div
      className={cn(
        "rounded-xl border bg-[#151a28]",
        selected
          ? "border-primary shadow-[0_0_0_1px_#6d5df6,0_0_28px_rgba(109,93,246,0.35)]"
          : "border-border shadow-[0_8px_24px_rgba(0,0,0,0.35)]",
      )}
      style={{ minHeight: catalog?.height ?? 64 }}
    >
      {!isInput && !merge && !multi && <Handle id="input" type="target" position={Position.Left} />}
      {merge && (
        <>
          <Handle id="main" type="target" position={Position.Left} style={{ top: "32%" }} />
          <Handle id="skip" type="target" position={Position.Left} style={{ top: "68%" }} />
        </>
      )}
      {typeName === "Concat" && (
        <>
          <Handle id="input" type="target" position={Position.Left} style={{ top: "32%" }} />
          <Handle id="input_b" type="target" position={Position.Left} style={{ top: "68%" }} />
        </>
      )}

      <div
        className="flex items-center gap-2 rounded-t-[11px] border-b border-border/60 px-3 py-2"
        style={{ background: `${color}1f` }}
      >
        <Icon className="h-4 w-4 shrink-0" style={{ color }} />
        <span className="truncate text-[13px] font-semibold text-foreground">{typeName}</span>
        <span className="ml-auto inline-flex items-center gap-1 text-[10px] text-muted-foreground">
          <span className={cn("h-1.5 w-1.5 rounded-full", statusDot(catalog?.status))} />
          {statusLabel(catalog?.status)}
        </span>
      </div>

      {(editable.length > 0 || readOnly.length > 0) && (
        <div className="divide-y divide-border/50 px-3 py-1">
          {editable.map((field) => (
            <InlineField
              key={`${field.nestedPath ?? "root"}:${field.key}`}
              nodeId={id}
              field={field}
              config={data.config}
            />
          ))}
          {readOnly.map((field) => (
            <div key={field.key} className="flex items-center justify-between gap-2 py-1">
              <span className="text-[12px] text-muted-foreground">{field.label}</span>
              <span className="font-mono text-[11px]">
                [{Array.isArray(readConfigValue(data.config, field)) ? (readConfigValue(data.config, field) as unknown[]).join(", ") : ""}]
              </span>
            </div>
          ))}
        </div>
      )}

      <div className="flex items-center justify-between gap-2 border-t border-border/50 px-3 py-1.5 text-[10px]">
        <span className="uppercase tracking-wide text-muted-foreground">{catalog?.category ?? "Node"}</span>
        {merge && <span className="text-muted-foreground">main / skip</span>}
        {shape !== undefined && (
          <span className="font-mono text-success">
            {shape === null ? "→ unknown" : `→ [${shape.map((d) => (d === null ? "?" : d)).join(", ")}]`}
          </span>
        )}
      </div>

      {!isOutput && <Handle id="output" type="source" position={Position.Right} />}
    </div>
  );
}
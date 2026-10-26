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

const CATEGORY_COLORS: Record<string, string> = {
  "I/O": "#80B7D8",
  Utility: "#A7A7A7",
  Core: "#8B8B8B",
  Embedding: "#D98BCA",
  Position: "#D6A76C",
  Normalization: "#D6A76C",
  Regularization: "#D6A76C",
  Activation: "#E5C76B",
  FFN: "#79B6A2",
  Attention: "#729BE2",
  Merge: "#A58AD8",
  Transformer: "#729BE2",
  Vision: "#B59AD8",
  Shape: "#8DBD87",
  Architecture: "#8BADD5",
  "Model Transform": "#D49B79",
  "Language Model": "#79B6A2",
};

const SKIP_COLOR = "#D6A76C";

function statusLabel(status: string | undefined): string {
  if (status === "implemented-and-tested") return "TESTED";
  if (status === "partial") return "PARTIAL";
  if (status === "metadata-only") return "CATALOG";
  return (status ?? "UNKNOWN").toUpperCase();
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

  const controlClass =
    "nodrag nowheel h-[23px] min-w-0 w-[94px] rounded-[4px] border border-[#454545] bg-[#292929] px-1.5 font-mono text-[11px] text-[#e6e6e6] outline-none focus:border-[#e7b85c]";

  function commit(event: React.FocusEvent<HTMLInputElement>) {
    const raw = event.target.value;

    if (raw === "") {
      update(nodeId, setConfigValue(config, field, undefined));
      return;
    }

    const parsed =
      field.kind === "int" ? Number.parseInt(raw, 10) : Number(raw);

    if (Number.isNaN(parsed)) {
      event.target.value =
        value === undefined || value === null ? "" : String(value);
      return;
    }

    if (parsed !== value) {
      update(nodeId, setConfigValue(config, field, parsed));
    }
  }

  let control: React.ReactNode;

  if (field.kind === "bool") {
    control = (
      <input
        type="checkbox"
        className="nodrag h-3.5 w-3.5 accent-[#e7b85c]"
        checked={Boolean(value)}
        onChange={(e) =>
          update(nodeId, setConfigValue(config, field, e.target.checked))
        }
      />
    );
  } else if (field.kind === "select") {
    control = (
      <select
        className={cn(controlClass, "text-left")}
        value={typeof value === "string" ? value : ""}
        onChange={(e) =>
          update(nodeId, setConfigValue(config, field, e.target.value))
        }
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
        className={cn(controlClass, "text-right")}
        step={field.step}
        min={field.min}
        max={field.max}
        defaultValue={
          value === undefined || value === null ? "" : String(value)
        }
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === "Enter") e.currentTarget.blur();
        }}
      />
    );
  }

  return (
    <div className="flex min-h-[29px] items-center justify-between gap-3 border-b border-[#383838] last:border-b-0">
      <span className="min-w-0 truncate text-[11px] text-[#bcbcbc]">
        {field.label}
      </span>
      <div className="flex shrink-0 items-center justify-end">{control}</div>
    </div>
  );
}

export function ArchitectureNode({
  id,
  data,
  selected,
}: NodeProps<ThinkNetNode>) {
  const shape = useDesignerStore((s) => s.lastShapePreview?.shapes?.[id]);

  const catalog = data.catalog;
  const category = catalog?.category ?? "Node";
  const typeName = data.typeName;
  const color = catalog?.color ?? CATEGORY_COLORS[category] ?? "#999999";

  const vertical = Boolean(data.vertical);
  const merge = isMergeType(typeName);
  const multi = isMultiInputType(typeName);
  const isInput = typeName === "Input";
  const isOutput = typeName === "Output";
  const isConcat = typeName === "Concat";

  const Icon = CATEGORY_ICONS[category] ?? Box;

  const fields = fieldsForNode(typeName, data.config, catalog);

  const editable = fields
    .filter(
      (field) =>
        INLINE_KINDS.has(field.kind) &&
        !field.label.includes("(alias)") &&
        field.key !== "architecture" &&
        (field.kind !== "select" || (field.options?.length ?? 0) > 0),
    )
    .slice(0, 4);

  const readOnly = fields
    .filter((field) => field.kind === "int-list")
    .slice(0, 1);

  const socketStyle = {
    width: 10,
    height: 10,
    background: color,
    border: "2px solid #202020",
  };

  // Horizontal layout: data flows left to right.
  // Vertical layout: data flows bottom to top (like the decoder diagram),
  // and skip connections enter/leave on the right side.
  const inPosition = vertical ? Position.Bottom : Position.Left;
  const outPosition = vertical ? Position.Top : Position.Right;
  const along = (pct: string): React.CSSProperties =>
    vertical ? { left: pct } : { top: pct };
  const centered: React.CSSProperties = vertical ? {} : { top: "50%" };

  return (
    <div
      className={cn(
        "relative min-w-[210px] overflow-visible rounded-[7px] border bg-[#303030] text-[#e6e6e6]",
        "transition-[border-color,box-shadow] duration-100",
        selected
          ? "border-[#f0a944] shadow-[0_0_0_1px_#f0a944]"
          : "border-[#1c1c1c] shadow-[0_3px_8px_rgba(0,0,0,0.28)]",
      )}
      style={{
        minHeight: catalog?.height ?? 64,
        borderTopWidth: 3,
        borderTopColor: color,
      }}
    >
      {!isInput && !merge && !multi && (
        <Handle
          id="input"
          type="target"
          position={inPosition}
          style={{ ...socketStyle, ...centered }}
        />
      )}

      {merge && (
        <>
          <Handle
            id="main"
            type="target"
            position={inPosition}
            style={{ ...socketStyle, ...(vertical ? {} : { top: "36%" }) }}
          />
          <Handle
            id="skip"
            type="target"
            position={vertical ? Position.Right : Position.Left}
            style={{
              ...socketStyle,
              top: vertical ? "70%" : "72%",
              background: SKIP_COLOR,
            }}
          />
        </>
      )}

      {isConcat && (
        <>
          <Handle
            id="input"
            type="target"
            position={inPosition}
            style={{ ...socketStyle, ...along("35%") }}
          />
          <Handle
            id="input_b"
            type="target"
            position={inPosition}
            style={{
              ...socketStyle,
              ...along(vertical ? "65%" : "72%"),
              background: SKIP_COLOR,
            }}
          />
        </>
      )}

      {/* Blender-style title bar */}
      <div className="flex h-[31px] items-center gap-2 rounded-t-[4px] border-b border-[#202020] bg-[#3b3b3b] px-2.5">
        <Icon
          className="h-[14px] w-[14px] shrink-0"
          style={{ color }}
        />

        <span className="min-w-0 flex-1 truncate text-[12px] font-semibold tracking-[0.1px]">
          {typeName}
        </span>

        <span
          className="h-[6px] w-[6px] shrink-0 rounded-full"
          title={statusLabel(catalog?.status)}
          style={{
            background:
              catalog?.status === "implemented-and-tested"
                ? "#79B87B"
                : catalog?.status === "partial"
                  ? "#E2B35D"
                  : "#777777",
          }}
        />
      </div>

      {/* Compact node properties */}
      {(editable.length > 0 || readOnly.length > 0) && (
        <div className="px-2.5 py-1">
          {editable.map((field) => (
            <InlineField
              key={`${field.nestedPath ?? "root"}:${field.key}`}
              nodeId={id}
              field={field}
              config={data.config}
            />
          ))}

          {readOnly.map((field) => {
            const value = readConfigValue(data.config, field);

            return (
              <div
                key={field.key}
                className="flex min-h-[27px] items-center justify-between gap-2"
              >
                <span className="text-[11px] text-[#bcbcbc]">
                  {field.label}
                </span>
                <span className="font-mono text-[10px] text-[#d6d6d6]">
                  [
                  {Array.isArray(value)
                    ? value.join(", ")
                    : ""}
                  ]
                </span>
              </div>
            );
          })}
        </div>
      )}

      {/* Node footer */}
      <div className="flex min-h-[25px] items-center justify-between gap-2 border-t border-[#242424] bg-[#292929] px-2.5 py-1">
        <span className="truncate text-[9px] font-medium uppercase tracking-[0.7px] text-[#a6a6a6]">
          {category}
        </span>

        {merge && (
          <span className="text-[9px] text-[#bdbdbd]">
            main / skip
          </span>
        )}

        {shape !== undefined && (
          <span
            className={cn(
              "truncate font-mono text-[10px]",
              shape === null ? "text-[#e2b35d]" : "text-[#9ecb9e]",
            )}
          >
            {shape === null
              ? "→ unknown"
              : `→ [${shape
                  .map((dimension) =>
                    dimension === null ? "?" : dimension,
                  )
                  .join(", ")}]`}
          </span>
        )}
      </div>

      {!isOutput && (
        <Handle
          id="output"
          type="source"
          position={outPosition}
          style={{ ...socketStyle, ...centered }}
        />
      )}

      {/* Vertical layout only: side output used to draw skip connections. */}
      {vertical && !isOutput && (
        <Handle
          id="skip_out"
          type="source"
          position={Position.Right}
          style={{
            ...socketStyle,
            top: merge ? "30%" : "50%",
            background: SKIP_COLOR,
          }}
        />
      )}
    </div>
  );
}
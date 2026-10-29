import { ChevronRight, Lightbulb, SlidersHorizontal } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  architectureDefaults,
  fieldsForNode,
  formatIntList,
  localConfigIssues,
  parseIntList,
  readConfigValue,
  setConfigValue,
  type ConfigField,
} from "@/lib/node-config";
import { explanationFor } from "@/lib/node-explanations";
import { useDesignerStore } from "@/store/designer-store";
import type { ArchitectureInfo } from "@/types/api";

function FieldControl({
  field,
  config,
  onChange,
}: {
  field: ConfigField;
  config: Record<string, unknown>;
  onChange: (next: Record<string, unknown>) => void;
}) {
  const value = readConfigValue(config, field);

  if (field.kind === "bool") {
    return (
      <label className="flex items-center justify-between gap-2 text-sm">
        <span>{field.label}</span>
        <input
          type="checkbox"
          className="accent-[#6d5df6]"
          checked={Boolean(value)}
          onChange={(e) => onChange(setConfigValue(config, field, e.target.checked))}
        />
      </label>
    );
  }

  if (field.kind === "select") {
    return (
      <div className="space-y-1">
        <Label>{field.label}</Label>
        <select
          className="h-8 w-full rounded-md border border-border px-2 text-sm"
          value={typeof value === "string" ? value : ""}
          onChange={(e) => {
            const nextValue = e.target.value;
            if (field.key === "architecture") {
              onChange({ architecture: nextValue, config: architectureDefaults(nextValue) });
              return;
            }
            onChange(setConfigValue(config, field, nextValue));
          }}
        >
          {(field.options ?? []).map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </div>
    );
  }

  if (field.kind === "int-list") {
    return (
      <div className="space-y-1">
        <Label>{field.label}</Label>
        <Input
          defaultValue={formatIntList(value)}
          onBlur={(e) => {
            const parsed = parseIntList(e.target.value);
            if (parsed) onChange(setConfigValue(config, field, parsed));
          }}
        />
        {field.help && <p className="text-[11px] text-muted-foreground">{field.help}</p>}
      </div>
    );
  }

  return (
    <div className="space-y-1">
      <Label>{field.label}</Label>
      <Input
        type={field.kind === "string" ? "text" : "number"}
        step={field.step}
        min={field.min}
        max={field.max}
        value={value === undefined || value === null ? "" : String(value)}
        onChange={(e) => {
          if (field.kind === "string") {
            onChange(setConfigValue(config, field, e.target.value));
            return;
          }
          if (e.target.value === "") {
            onChange(setConfigValue(config, field, undefined));
            return;
          }
          const numeric = field.kind === "int" ? Number.parseInt(e.target.value, 10) : Number(e.target.value);
          if (!Number.isNaN(numeric)) onChange(setConfigValue(config, field, numeric));
        }}
      />
    </div>
  );
}

function Section({
  title,
  hint,
  defaultOpen,
  children,
}: {
  title: string;
  hint: string;
  defaultOpen?: boolean;
  children: React.ReactNode;
}) {
  return (
    <details open={defaultOpen} className="group">
      <summary className="flex cursor-pointer list-none items-center justify-between py-1 text-[13px] font-medium [&::-webkit-details-marker]:hidden">
        <span className="flex items-center gap-1.5">
          <ChevronRight className="h-3.5 w-3.5 text-muted-foreground transition-transform group-open:rotate-90" />
          {title}
        </span>
        <span className="text-[11px] font-normal text-muted-foreground">{hint}</span>
      </summary>
      <div className="mt-2 space-y-3 pl-5">{children}</div>
    </details>
  );
}

export function NodeInspector({ architectures }: { architectures: ArchitectureInfo[] }) {
  const nodes = useDesignerStore((s) => s.nodes);
  const selectedNodeId = useDesignerStore((s) => s.selectedNodeId);
  const updateNodeConfig = useDesignerStore((s) => s.updateNodeConfig);
  const shapes = useDesignerStore((s) => s.lastShapePreview?.shapes);
  const index = nodes.findIndex((node) => node.id === selectedNodeId);
  const selected = index >= 0 ? nodes[index] : undefined;

  const heading = (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-2 text-[15px] font-semibold">
        <SlidersHorizontal className="h-4 w-4 text-accent-foreground" />
        Properties
      </div>
      {selected && <span className="text-[12px] text-muted-foreground">Node #{index + 1}</span>}
    </div>
  );

  if (!selected) {
    return (
      <div className="space-y-2 p-4">
        {heading}
        <p className="text-sm text-muted-foreground">
          Select a node to inspect configuration fields accepted by the current backend.
        </p>
      </div>
    );
  }

  const modelWorkflowNode =
    selected.data.typeName === "ModelLoader" || selected.data.typeName === "Quantizer";
  const fields = modelWorkflowNode
    ? []
    : fieldsForNode(
        selected.data.typeName,
        selected.data.config,
        selected.data.catalog,
        architectures.map((item) => item.name),
      );
  const basic = fields.filter((field) => !field.label.includes("(alias)"));
  const advanced = fields.filter((field) => field.label.includes("(alias)"));
  const issues = localConfigIssues(selected.data.typeName, selected.data.config);
  const preview = shapes?.[selected.id];
  const status = selected.data.catalog?.status;

  const renderField = (field: ConfigField) => (
    <FieldControl
      key={`${selected.id}:${field.nestedPath ?? "root"}:${field.key}`}
      field={field}
      config={selected.data.config}
      onChange={(config) => updateNodeConfig(selected.id, config)}
    />
  );

  return (
    <div className="space-y-4 p-4">
      {heading}
      <div className="space-y-1">
        <Label>Node ID</Label>
        <Input value={selected.id} readOnly className="font-mono text-[12px]" />
      </div>
      <div className="flex flex-wrap items-center gap-1">
        <Badge variant="default">{selected.data.typeName}</Badge>
        {selected.data.catalog && (
          <Badge variant={status === "implemented-and-tested" ? "success" : status === "partial" ? "warning" : "muted"}>
            {status}
          </Badge>
        )}
        {selected.data.catalog && <Badge>{selected.data.catalog.category}</Badge>}
      </div>
      {status === "metadata-only" && (
        <p className="text-[12px] leading-5 text-warning">
          This catalog entry is metadata-only. The compiler will reject it until an executable path exists.
        </p>
      )}
      {status === "partial" && (
        <p className="text-[12px] leading-5 text-muted-foreground">
          An execution path exists, but broader acceptance coverage is still limited.
        </p>
      )}

      {fields.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          {modelWorkflowNode
            ? "Configure this workflow directly on the canvas node."
            : "This node has no additional configuration fields in the current backend."}
        </p>
      ) : (
        <div className="space-y-2">
          {basic.length > 0 && (
            <Section title="Basics" hint="Primary controls" defaultOpen>
              {basic.map(renderField)}
            </Section>
          )}
          {advanced.length > 0 && (
            <Section title="Advanced settings" hint="Aliases">
              {advanced.map(renderField)}
            </Section>
          )}
        </div>
      )}

      {issues.length > 0 && (
        <div className="rounded-md border border-amber-400/30 bg-amber-400/10 px-3 py-2 text-[12px] text-warning">
          {issues.map((issue) => (
            <div key={issue}>{issue}</div>
          ))}
        </div>
      )}

      {preview !== undefined && (
        <div>
          <Label>Advisory shape</Label>
          <p className="mt-1 font-mono text-xs">{preview === null ? "unknown" : JSON.stringify(preview)}</p>
        </div>
      )}

      <div className="rounded-lg border border-primary/25 bg-primary/5 p-3">
        <div className="flex items-center gap-1.5 text-[13px] font-medium text-accent-foreground">
          <Lightbulb className="h-3.5 w-3.5" />
          Plain Explanation
        </div>
        <p className="mt-1.5 text-[12px] leading-5 text-muted-foreground">
          {explanationFor(selected.data.typeName)}
        </p>
      </div>
    </div>
  );
}
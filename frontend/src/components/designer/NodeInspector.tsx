import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
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
          className="h-8 w-full rounded-md border border-border bg-card px-2 text-sm"
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

export function NodeInspector({ architectures }: { architectures: ArchitectureInfo[] }) {
  const nodes = useDesignerStore((s) => s.nodes);
  const selectedNodeId = useDesignerStore((s) => s.selectedNodeId);
  const updateNodeConfig = useDesignerStore((s) => s.updateNodeConfig);
  const shapes = useDesignerStore((s) => s.lastShapePreview?.shapes);
  const selected = nodes.find((node) => node.id === selectedNodeId);

  if (!selected) {
    return (
      <div className="p-4 text-sm text-muted-foreground">
        Select a node to inspect configuration fields accepted by the current backend.
      </div>
    );
  }

  const fields = fieldsForNode(
    selected.data.typeName,
    selected.data.config,
    selected.data.catalog,
    architectures.map((item) => item.name),
  );
  const issues = localConfigIssues(selected.data.typeName, selected.data.config);
  const preview = shapes?.[selected.id];

  return (
    <ScrollArea className="h-full">
      <div className="space-y-3 p-4">
        <div>
          <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
            Inspector
          </div>
          <div className="mt-1 text-base font-semibold">{selected.data.typeName}</div>
          <div className="mt-1 font-mono text-[11px] text-muted-foreground">{selected.id}</div>
        </div>
        <div className="flex flex-wrap gap-1">
          {selected.data.catalog && (
            <Badge
              variant={
                selected.data.catalog.status === "implemented-and-tested"
                  ? "success"
                  : selected.data.catalog.status === "partial"
                    ? "warning"
                    : "muted"
              }
            >
              {selected.data.catalog.status}
            </Badge>
          )}
          {selected.data.catalog && <Badge>{selected.data.catalog.category}</Badge>}
        </div>
        {selected.data.catalog?.status === "metadata-only" && (
          <p className="text-[12px] leading-5 text-warning">
            This catalog entry is metadata-only. The compiler will reject it until an executable path exists.
          </p>
        )}
        {selected.data.catalog?.status === "partial" && (
          <p className="text-[12px] leading-5 text-muted-foreground">
            An execution path exists, but broader acceptance coverage is still limited.
          </p>
        )}
        <Separator />
        {fields.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            This node has no additional configuration fields in the current backend.
          </p>
        ) : (
          <div className="space-y-3">
            {fields.map((field) => (
              <FieldControl
                key={`${selected.id}:${field.nestedPath ?? "root"}:${field.key}`}
                field={field}
                config={selected.data.config}
                onChange={(config) => updateNodeConfig(selected.id, config)}
              />
            ))}
          </div>
        )}
        {issues.length > 0 && (
          <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-[12px] text-warning">
            {issues.map((issue) => (
              <div key={issue}>{issue}</div>
            ))}
          </div>
        )}
        {preview !== undefined && (
          <div>
            <Label>Advisory shape</Label>
            <p className="mt-1 font-mono text-xs">
              {preview === null ? "unknown" : JSON.stringify(preview)}
            </p>
          </div>
        )}
      </div>
    </ScrollArea>
  );
}

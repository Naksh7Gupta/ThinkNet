import { CheckCircle2, PackageOpen } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { formatBytes, formatCount } from "@thinknet/compute-estimator";
import { useDesignerStore } from "@/store/designer-store";

export function AssetsPanel() {
  const assets = useDesignerStore((state) => state.localAssets);

  return (
    <div className="flex h-full flex-col">
      <div className="border-b border-border px-3 pb-3 pt-3">
        <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
          <PackageOpen className="h-4 w-4" />
          Assets
        </div>
        <p className="mt-1 text-[11px] leading-4 text-muted-foreground">
          Validated models produced by connected Quantizer nodes.
        </p>
      </div>
      <ScrollArea className="flex-1">
        <div className="space-y-2 p-3">
          {assets.length === 0 && (
            <p className="rounded-md border border-dashed border-border px-3 py-4 text-center text-xs leading-5 text-muted-foreground">
              No model assets yet. Connect a Model Loader to a Quantizer node and run a conversion.
            </p>
          )}
          {assets.map((asset) => (
            <article key={asset.path} className="rounded-md border border-border bg-background p-2.5">
              <div className="flex min-w-0 items-center gap-2">
                <PackageOpen className="h-4 w-4 shrink-0 text-primary" />
                <h3 className="truncate text-xs font-medium" title={asset.model_name}>{asset.model_name}</h3>
                <CheckCircle2 className="ml-auto h-3.5 w-3.5 shrink-0 text-success" aria-label="Validated" />
              </div>
              <p className="mt-1 break-all font-mono text-[9px] leading-4 text-muted-foreground">{asset.path}</p>
              <p className="mt-2 text-[10px] text-muted-foreground">
                {asset.format} · {asset.dtype.toUpperCase()} · {formatBytes(asset.size_bytes)}
              </p>
              <p className="text-[10px] text-muted-foreground">
                {formatCount(asset.parameter_count)} parameters · validation {asset.validation_status}
              </p>
            </article>
          ))}
        </div>
      </ScrollArea>
    </div>
  );
}

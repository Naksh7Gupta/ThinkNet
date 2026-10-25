import { useQuery } from "@tanstack/react-query";
import { Box } from "lucide-react";
import { DesignerWorkspace } from "@/components/designer/DesignerWorkspace";
import { api, getApiBaseUrl } from "@/lib/api";
import { cn } from "@/lib/utils";
import { useDesignerStore } from "@/store/designer-store";

const TABS = [
  { label: "Build", active: true },
  { label: "Data", active: false },
  { label: "Train", active: false },
  { label: "Evaluate", active: false },
  { label: "Deploy", active: false },
  { label: "Agents", active: false },
];

export function AppShell() {
  const graphName = useDesignerStore((s) => s.graphName);
  const health = useQuery({
    queryKey: ["health"],
    queryFn: api.health,
    refetchInterval: 8000,
  });

  const connected = health.isSuccess;

  return (
    <div className="flex h-full flex-col bg-background text-foreground">
      <header className="flex h-14 shrink-0 items-center gap-6 border-b border-border bg-card px-4">
        <div className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-[#7c6cf8] to-[#5a4ae0] text-[12px] font-bold text-white">
            TN
          </div>
          <div className="text-[15px] font-semibold leading-none">ThinkNet</div>
        </div>
        <nav className="flex h-full items-stretch gap-1" aria-label="Workspaces">
          {TABS.map((tab) => (
            <button
              key={tab.label}
              type="button"
              disabled={!tab.active}
              aria-current={tab.active ? "page" : undefined}
              title={tab.active ? undefined : `${tab.label} is not available yet`}
              className={cn(
                "relative px-3 text-sm font-medium outline-none focus-visible:ring-2 focus-visible:ring-ring",
                tab.active
                  ? "text-accent-foreground after:absolute after:inset-x-3 after:bottom-0 after:h-0.5 after:rounded-full after:bg-primary"
                  : "cursor-not-allowed text-muted-foreground/60",
              )}
            >
              {tab.label}
            </button>
          ))}
        </nav>
        <div className="ml-auto flex items-center gap-3 text-[12px]">
          <span className="hidden font-mono text-muted-foreground lg:inline">{getApiBaseUrl()}</span>
          <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-background px-3 py-1">
            <span className={cn("h-2 w-2 rounded-full", connected ? "bg-success" : "bg-destructive")} />
            {connected
              ? `Backend ${health.data.torch_version}`
              : health.isError
                ? "Backend unreachable"
                : "Checking backend"}
          </span>
          <span className="inline-flex max-w-56 items-center gap-2 rounded-lg border border-border bg-background px-3 py-1.5 text-sm">
            <Box className="h-4 w-4 shrink-0 text-accent-foreground" />
            <span className="truncate font-medium">{graphName || "untitled_architecture"}</span>
          </span>
        </div>
      </header>
      <DesignerWorkspace />
    </div>
  );
}
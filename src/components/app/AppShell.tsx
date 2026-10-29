import { useQuery } from "@tanstack/react-query";
import { Box, Minus, Square, X } from "lucide-react";
import { useState } from "react";
import { DesignerWorkspace } from "@/components/designer/DesignerWorkspace";
import { TrainingStudio } from "@/components/training/TrainingStudio";
import { api, getApiBaseUrl } from "@/lib/api";
import { desktopBridge, useDesktopBackend } from "@/lib/desktop";
import { cn } from "@/lib/utils";
import { useDesignerStore } from "@/store/designer-store";

const TABS = [
  { label: "Build", enabled: true },
  { label: "Data", enabled: false },
  { label: "Train", enabled: true },
  { label: "Evaluate", enabled: false },
  { label: "Deploy", enabled: false },
  { label: "Agents", enabled: false },
];

export function AppShell() {
  const [workspace, setWorkspace] = useState<"Build" | "Train">("Build");
  const graphName = useDesignerStore((state) => state.graphName);
  const health = useQuery({
    queryKey: ["health"],
    queryFn: api.health,
    refetchInterval: 8000,
  });

  const connected = health.isSuccess;
  const { desktop, status, restart } = useDesktopBackend();
  const phase = status?.state;
  const blocked = phase === "failed" || phase === "unavailable";
  const starting = !connected && !blocked && (phase === "starting" || health.isPending);

  const backendPill = connected
    ? `Backend ${health.data.torch_version}`
    : blocked
      ? "Backend stopped"
      : starting
        ? "Starting local backend"
        : health.isError
          ? "Backend unreachable"
          : "Checking backend";
  const backendTitle = status?.message
    ? `${status.message}${status.log ? `\nLog: ${status.log}` : ""}`
    : `${getApiBaseUrl()}${desktop ? "\nUse File → Restart local backend if it stays down." : ""}`;

  const windowActions = [
    {
      label: "Minimize window",
      onClick: () => desktopBridge()?.minimizeWindow().catch(() => undefined),
      icon: Minus,
    },
    {
      label: "Maximize window",
      onClick: () => desktopBridge()?.toggleWindowMaximize().catch(() => undefined),
      icon: Square,
    },
    {
      label: "Close window",
      onClick: () => desktopBridge()?.closeWindow().catch(() => undefined),
      icon: X,
    },
  ];

  return (
    <div className="flex h-full flex-col bg-background text-foreground">
      <header
        className="flex h-14 shrink-0 items-center border-b gap-6 border-border bg-card px-4"
        style={{ WebkitAppRegion: "drag" } as React.CSSProperties}
      >
        <div className="flex items-center gap-2.5" style={{ WebkitAppRegion: "no-drag" } as React.CSSProperties}>
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-[#7c6cf8] to-[#5a4ae0] text-[12px] font-bold text-white">
            TN
          </div>
          <div className="text-[15px] font-semibold leading-none">ThinkNet</div>
        </div>
        <nav className="flex h-full items-stretch gap-1" aria-label="Workspaces" style={{ WebkitAppRegion: "no-drag" } as React.CSSProperties}>
          {TABS.map((tab) => {
            const active = tab.label === workspace;
            return (
              <button
                key={tab.label}
                type="button"
                disabled={!tab.enabled}
                onClick={() => {
                  if (tab.label === "Build" || tab.label === "Train") setWorkspace(tab.label);
                }}
                aria-current={active ? "page" : undefined}
                title={tab.enabled ? undefined : tab.label + " is not available yet"}
                className={cn(
                  "relative px-3 text-sm font-medium outline-none focus-visible:ring-2 focus-visible:ring-ring",
                  active
                    ? "text-accent-foreground after:absolute after:inset-x-3 after:bottom-0 after:h-0.5 after:rounded-full after:bg-primary"
                    : tab.enabled
                      ? "text-muted-foreground hover:text-foreground"
                      : "cursor-not-allowed text-muted-foreground/60",
                )}
              >
                {tab.label}
              </button>
            );
          })}
        </nav>
        <div className="ml-auto flex items-center gap-3 text-[12px]">
          <span className="hidden font-mono text-muted-foreground lg:inline">{getApiBaseUrl()}</span>
          <span
            title={backendTitle}
            className="inline-flex items-center gap-1.5 rounded-full border border-border bg-background px-3 py-1"
          >
            <span
              className={cn(
                "h-2 w-2 rounded-full",
                connected ? "bg-success" : blocked ? "bg-destructive" : "animate-pulse bg-warning",
              )}
            />
            {backendPill}
            {desktop && blocked && (
              <button
                type="button"
                onClick={restart}
                className="ml-1 rounded border border-border px-1.5 py-0.5 text-[11px] font-medium text-foreground hover:bg-accent"
              >
                Restart
              </button>
            )}
          </span>
          <span className="inline-flex max-w-56 items-center gap-2 rounded-lg border border-border bg-background px-3 py-1.5 text-sm">
            <Box className="h-4 w-4 shrink-0 text-accent-foreground" />
            <span className="truncate font-medium">{graphName || "untitled_architecture"}</span>
          </span>
          {desktop && (
            <div className="flex items-center gap-1 rounded-full border border-border bg-background p-1" style={{ WebkitAppRegion: "no-drag" } as React.CSSProperties}>
              {windowActions.map(({ label, onClick, icon: Icon }) => (
                <button
                  key={label}
                  type="button"
                  aria-label={label}
                  title={label}
                  onClick={onClick}
                  className="flex h-7 w-7 items-center justify-center rounded-full text-muted-foreground transition hover:bg-accent hover:text-foreground"
                >
                  <Icon className="h-3.5 w-3.5" />
                </button>
              ))}
            </div>
          )}
        </div>
      </header>
      {workspace === "Build" ? <DesignerWorkspace /> : <TrainingStudio />}
    </div>
  );
}

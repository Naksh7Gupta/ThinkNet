import { useQuery } from "@tanstack/react-query";
import { Workflow } from "lucide-react";
import { useEffect, useRef } from "react";
import { DesignerWorkspace } from "@/components/designer/DesignerWorkspace";
import { api, getApiBaseUrl } from "@/lib/api";
import { cn } from "@/lib/utils";

export function AppShell() {
  const searchRef = useRef<HTMLInputElement>(null);
  const health = useQuery({
    queryKey: ["health"],
    queryFn: api.health,
    refetchInterval: 8000,
  });

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (!event.shiftKey || event.key.toLowerCase() !== "a") return;
      const tag = (event.target as HTMLElement | null)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
      event.preventDefault();
      searchRef.current?.focus();
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  const connected = health.isSuccess;

  return (
    <div className="flex h-full flex-col bg-background text-foreground">
      <header className="flex h-12 items-center gap-4 border-b border-border bg-card px-4">
        <div className="flex items-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-md bg-primary text-[11px] font-bold text-primary-foreground">
            TN
          </div>
          <div>
            <div className="text-sm font-semibold leading-none">ThinkNet</div>
            <div className="text-[11px] text-muted-foreground">Architecture workspace</div>
          </div>
        </div>
        <nav className="flex items-center gap-1">
          <span className="inline-flex items-center gap-1.5 rounded-md bg-accent px-3 py-1.5 text-sm font-medium text-accent-foreground">
            <Workflow className="h-3.5 w-3.5" />
            Model Designer
          </span>
        </nav>
        <div className="ml-auto flex items-center gap-3 text-[12px]">
          <span className="hidden font-mono text-muted-foreground sm:inline">{getApiBaseUrl()}</span>
          <span className="inline-flex items-center gap-1.5">
            <span className={cn("h-2 w-2 rounded-full", connected ? "bg-success" : "bg-destructive")} />
            {connected
              ? `Backend ${health.data.torch_version}`
              : health.isError
                ? "Backend unreachable"
                : "Checking backend"}
          </span>
        </div>
      </header>
      <DesignerWorkspace searchRef={searchRef} />
    </div>
  );
}

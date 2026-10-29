import { useReactFlow } from "@xyflow/react";
import { CirclePlus, FolderOpen, PanelRight, ScanLine, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { useDesignerStore } from "@/store/designer-store";

function RailButton({
  label,
  active,
  disabled,
  onClick,
  children,
}: {
  label: string;
  active?: boolean;
  disabled?: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      disabled={disabled}
      onClick={onClick}
      className={cn(
        "flex h-10 w-10 items-center justify-center rounded-lg text-muted-foreground transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-40",
        active ? "bg-primary text-primary-foreground" : "hover:bg-muted hover:text-foreground",
      )}
    >
      {children}
    </button>
  );
}

export function ToolRail({
  libraryOpen,
  onToggleLibrary,
  assetsOpen,
  onToggleAssets,
  panelOpen,
  onTogglePanel,
}: {
  libraryOpen: boolean;
  onToggleLibrary: () => void;
  assetsOpen: boolean;
  onToggleAssets: () => void;
  panelOpen: boolean;
  onTogglePanel: () => void;
}) {
  const { fitView, deleteElements } = useReactFlow();
  const selectedNodeId = useDesignerStore((s) => s.selectedNodeId);

  return (
    <nav
      aria-label="Canvas tools"
      className="flex w-14 shrink-0 flex-col items-center gap-2 border-r border-border bg-card py-3"
    >
      <RailButton label="Add node (Shift+A)" active={libraryOpen} onClick={onToggleLibrary}>
        <CirclePlus className="h-5 w-5" />
      </RailButton>
      <RailButton label="Assets" active={assetsOpen} onClick={onToggleAssets}>
        <FolderOpen className="h-5 w-5" />
      </RailButton>
      <RailButton label="Fit graph to view" onClick={() => void fitView({ padding: 0.24, duration: 180 })}>
        <ScanLine className="h-5 w-5" />
      </RailButton>
      <RailButton
        label="Delete selected node"
        disabled={!selectedNodeId}
        onClick={() => {
          if (selectedNodeId) void deleteElements({ nodes: [{ id: selectedNodeId }] });
        }}
      >
        <Trash2 className="h-5 w-5" />
      </RailButton>
      <div className="mt-auto">
        <RailButton label="Toggle properties panel" active={panelOpen} onClick={onTogglePanel}>
          <PanelRight className="h-5 w-5" />
        </RailButton>
      </div>
    </nav>
  );
}
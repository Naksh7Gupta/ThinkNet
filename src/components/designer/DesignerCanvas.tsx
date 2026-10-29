import {
  Background,
  BackgroundVariant,
  Controls,
  MiniMap,
  ReactFlow,
  useReactFlow,
  type Connection,
  type IsValidConnection,
} from "@xyflow/react";
import { useCallback, useEffect, useMemo } from "react";
import { ArchitectureNode } from "@/components/designer/ArchitectureNode";
import { BlockFrameNode } from "@/components/designer/BlockFrameNode";
import { FRAME_NODE_TYPE, TENSOR_NODE_TYPE, type ThinkNetNode } from "@/lib/graph";
import { useDesignerStore } from "@/store/designer-store";
import type { CatalogNode } from "@/types/api";

const nodeTypes = {
  [TENSOR_NODE_TYPE]: ArchitectureNode,
  [FRAME_NODE_TYPE]: BlockFrameNode,
};

export function DesignerCanvas({ catalog }: { catalog: CatalogNode[] }) {
  const nodes = useDesignerStore((s) => s.nodes);
  const edges = useDesignerStore((s) => s.edges);
  const onNodesChange = useDesignerStore((s) => s.onNodesChange);
  const onEdgesChange = useDesignerStore((s) => s.onEdgesChange);
  const onConnect = useDesignerStore((s) => s.onConnect);
  const addCatalogNode = useDesignerStore((s) => s.addCatalogNode);
  const revision = useDesignerStore((s) => s.canvasRevision);
  const { screenToFlowPosition, fitView } = useReactFlow();

  const catalogByType = useMemo(
    () => new Map(catalog.map((item) => [item.type, item])),
    [catalog],
  );

  useEffect(() => {
    if (revision > 0) {
      const frame = requestAnimationFrame(() => {
        void fitView({ padding: 0.24, duration: 180 });
      });
      return () => cancelAnimationFrame(frame);
    }
  }, [fitView, revision]);

  const isValidConnection = useCallback<IsValidConnection>(
    (connection: Connection | { source: string | null; target: string | null }) => {
      if (!connection.source || !connection.target) return false;
      return connection.source !== connection.target;
    },
    [],
  );

  const onDragOver = useCallback((event: React.DragEvent) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = "copy";
  }, []);

  const onDrop = useCallback(
    (event: React.DragEvent) => {
      event.preventDefault();
      const typeName = event.dataTransfer.getData("application/thinknet-node");
      const item = catalogByType.get(typeName);
      if (!item) return;
      addCatalogNode(item, screenToFlowPosition({ x: event.clientX, y: event.clientY }));
    },
    [addCatalogNode, catalogByType, screenToFlowPosition],
  );

  return (
    <div className="relative min-h-0 flex-1">
      <ReactFlow<ThinkNetNode>
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        isValidConnection={isValidConnection}
        onDragOver={onDragOver}
        onDrop={onDrop}
        fitView
        deleteKeyCode={["Delete", "Backspace"]}
        minZoom={0.15}
        maxZoom={1.75}
        defaultEdgeOptions={{ type: "smoothstep" }}
        selectionOnDrag
        panOnScroll
        proOptions={{ hideAttribution: false }}
      >
        <Background variant={BackgroundVariant.Dots} gap={18} size={1} color="#c5ccd8" />
        <Controls showInteractive={false} />
        <MiniMap
          pannable
          zoomable
          nodeColor={(node) => {
            if (node.type === FRAME_NODE_TYPE) return "transparent";
            const data = node.data as ThinkNetNode["data"] | undefined;
            return data?.catalog?.color ?? "#94A3B8";
          }}
        />
      </ReactFlow>
      {nodes.length === 0 && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <div className="max-w-sm rounded-lg border border-border bg-card/95 px-4 py-3 text-center shadow-sm">
            <p className="text-sm font-medium">Empty architecture</p>
            <p className="mt-1 text-[12px] leading-5 text-muted-foreground">
              Add catalog nodes, drag them onto the canvas, or load a backend-supported example from
              the toolbar.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
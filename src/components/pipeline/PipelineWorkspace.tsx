import {
  addEdge,
  Background,
  BackgroundVariant,
  Controls,
  MiniMap,
  ReactFlow,
  useEdgesState,
  useNodesState,
  type Connection,
  type Edge,
  type Node,
} from "@xyflow/react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Play, Save, ShieldCheck, Plus, FolderOpen, Sparkles } from "lucide-react";
import { useMemo, useState } from "react";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { PipelineGraph, PipelineNode, PipelineProject } from "@/types/api";

type CanvasData = {
  label: string;
  type: string;
  config: Record<string, unknown>;
  inputPort: string;
  outputPort: string;
};

type CanvasNode = Node<CanvasData>;
type CanvasEdge = Edge<{ sourcePort: string; targetPort: string }>;

const DEFAULT_POSITION = { x: 180, y: 100 };

function slug(value: string): string {
  return value.trim().toLowerCase().replace(/[^a-z0-9_-]+/g, "-").replace(/^-|-$/g, "").slice(0, 70) || "pipeline";
}

export function PipelineWorkspace() {
  const client = useQueryClient();
  const catalog = useQuery({ queryKey: ["pipeline-components"], queryFn: api.listPipelineComponents });
  const projects = useQuery({ queryKey: ["pipeline-projects"], queryFn: api.listPipelineProjects });
  const [name, setName] = useState("untitled-pipeline");
  const [projectId, setProjectId] = useState("untitled-pipeline");
  const [nodes, setNodes, onNodesChange] = useNodesState<CanvasNode>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<CanvasEdge>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [configText, setConfigText] = useState("{}");
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");

  const graph = useMemo<PipelineGraph>(() => ({
    name,
    nodes: nodes.map((node): PipelineNode => ({
      id: node.id,
      type: node.data.type,
      config: node.data.config,
    })),
    edges: edges.map((edge) => {
      const source = nodes.find((node) => node.id === edge.source);
      const target = nodes.find((node) => node.id === edge.target);
      return {
        source: edge.source,
        target: edge.target,
        source_port: edge.data?.sourcePort ?? source?.data.outputPort ?? "output",
        target_port: edge.data?.targetPort ?? target?.data.inputPort ?? "input",
      };
    }),
  }), [name, nodes, edges]);

  const selectedNode = nodes.find((node) => node.id === selectedId) ?? null;

  const loadMnistStarter = () => {
    const modelGraph = {
      name: "mnist-mlp",
      nodes: [
        { id: "input", type: "Input", config: { shape: [1, 28, 28] } },
        { id: "flatten", type: "Flatten", config: { start_dim: 1 } },
        { id: "hidden", type: "Linear", config: { in_features: 784, out_features: 128 } },
        { id: "activation", type: "ReLU", config: {} },
        { id: "classes", type: "Linear", config: { in_features: 128, out_features: 10 } },
        { id: "output", type: "Output", config: {} },
      ],
      edges: [
        { source: "input", target: "flatten", source_port: "output", target_port: "input" },
        { source: "flatten", target: "hidden", source_port: "output", target_port: "input" },
        { source: "hidden", target: "activation", source_port: "output", target_port: "input" },
        { source: "activation", target: "classes", source_port: "output", target_port: "input" },
        { source: "classes", target: "output", source_port: "output", target_port: "input" },
      ],
    };
    const definitions = [
      { id: "mnist_data", type: "mnist.load", config: {}, inputPort: "input", outputPort: "train" },
      { id: "mnist_model", type: "model.build_graph", config: { graph: modelGraph }, inputPort: "input", outputPort: "model" },
      { id: "mnist_train", type: "mnist.train", config: { epochs: 3, batch_size: 128, learning_rate: 0.001, device: "auto" }, inputPort: "model", outputPort: "model" },
      { id: "mnist_evaluate", type: "mnist.evaluate", config: {}, inputPort: "model", outputPort: "report" },
      { id: "mnist_save", type: "model.save", config: {}, inputPort: "model", outputPort: "model" },
      { id: "mnist_predict", type: "mnist.predict", config: { limit: 20 }, inputPort: "model", outputPort: "predictions" },
    ];
    const positions = [
      { x: 80, y: 180 }, { x: 360, y: 60 }, { x: 650, y: 180 },
      { x: 960, y: 60 }, { x: 960, y: 300 }, { x: 1260, y: 180 },
    ];
    setNodes(definitions.map((item, index) => ({
      id: item.id,
      type: "default",
      position: positions[index],
      data: { label: item.type, type: item.type, config: item.config,
        inputPort: item.inputPort, outputPort: item.outputPort },
    })));
    const connections = [
      ["mnist_model", "mnist_train", "model", "model"],
      ["mnist_data", "mnist_train", "train", "dataset"],
      ["mnist_train", "mnist_evaluate", "model", "model"],
      ["mnist_data", "mnist_evaluate", "test", "dataset"],
      ["mnist_train", "mnist_save", "model", "model"],
      ["mnist_save", "mnist_predict", "model", "model"],
      ["mnist_data", "mnist_predict", "test", "dataset"],
    ] as const;
    setEdges(connections.map(([source, target, sourcePort, targetPort], index) => ({
      id: `mnist-edge-${index}`, source, target, sourceHandle: null, targetHandle: null,
      type: "smoothstep", data: { sourcePort, targetPort },
    })));
    setName("MNIST Image Classification");
    setProjectId("mnist-image-classification");
    setSelectedId(null);
    setError("");
    setNotice("MNIST starter loaded. Configure the dataset path if needed, then run the pipeline.");
  };

  const addNode = (type: string) => {
    const item = catalog.data?.components.find((component) => component.type === type);
    if (!item) return;
    const id = `${type.replace(/[^a-z0-9]+/gi, "_").toLowerCase()}_${nodes.length + 1}`;
    const inputPort = Object.keys(item.inputs).find((key) => !item.inputs[key].endsWith("?")) ??
      Object.keys(item.inputs)[0] ?? "input";
    const outputPort = Object.keys(item.outputs)[0] ?? "output";
    const node: CanvasNode = {
      id,
      type: "default",
      position: { x: DEFAULT_POSITION.x + (nodes.length % 4) * 230, y: DEFAULT_POSITION.y + Math.floor(nodes.length / 4) * 150 },
      data: { label: type, type, config: {}, inputPort, outputPort },
    };
    setNodes((current) => [...current, node]);
    setSelectedId(id);
    setConfigText("{}");
  };

  const onConnect = (connection: Connection) => {
    if (!connection.source || !connection.target || connection.source === connection.target) return;
    const source = nodes.find((node) => node.id === connection.source);
    const target = nodes.find((node) => node.id === connection.target);
    const targetComponent = catalog.data?.components.find((item) => item.type === target?.data.type);
    if (!source || !target || !targetComponent) return;
    const used = new Set(edges.filter((edge) => edge.target === target.id).map((edge) => edge.data?.targetPort));
    const targetPort = Object.keys(targetComponent.inputs).find((port) => !used.has(port));
    if (!targetPort) {
      setError("All input ports on this component are already connected.");
      return;
    }
    setEdges((current) => addEdge({
      ...connection,
      type: "smoothstep",
      data: { sourcePort: source.data.outputPort, targetPort },
    }, current));
  };

  const validate = useMutation({
    mutationFn: () => api.validatePipeline(graph),
    onSuccess: (result) => {
      setError(result.valid ? "" : (result.errors ?? ["Pipeline validation failed."]).join("; "));
      setNotice(result.valid ? `Valid pipeline · ${result.node_count} components · execution order: ${(result.execution_order ?? []).join(" → ")}` : "");
    },
    onError: (reason) => setError(reason instanceof Error ? reason.message : "Validation failed."),
  });

  const run = useMutation({
    mutationFn: () => api.runPipeline(graph),
    onSuccess: (result) => {
      setError(result.status === "failed" ? result.error ?? "Pipeline failed." : "");
      if (result.status === "completed") {
        const metrics = result.outputs?.mnist_train?.metrics as { training_accuracy?: number; training_loss?: number } | undefined;
        const report = result.outputs?.mnist_evaluate?.report as { accuracy?: number; loss?: number } | undefined;
        const saved = result.outputs?.mnist_save?.model as { checkpoint_id?: string } | undefined;
        const summary = report?.accuracy !== undefined
          ? ` · test accuracy ${(report.accuracy * 100).toFixed(1)}%`
          : metrics?.training_accuracy !== undefined
            ? ` · training accuracy ${(metrics.training_accuracy * 100).toFixed(1)}%` : "";
        setNotice(`Run ${result.run_id} completed${summary}. ${saved?.checkpoint_id ? `Saved model ID: ${saved.checkpoint_id}` : `Run record: ${result.run_record ?? "saved"}`}`);
      } else {
        setNotice("");
      }
    },
    onError: (reason) => setError(reason instanceof Error ? reason.message : "Pipeline run failed."),
  });

  const save = useMutation({
    mutationFn: () => {
      const id = slug(projectId || name);
      const project: PipelineProject = {
        project_id: id,
        name,
        description: "",
        graph,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      return api.savePipelineProject(project);
    },
    onSuccess: (project) => {
      setProjectId(project.project_id);
      setNotice(`Saved project “${project.name}”.`);
      void client.invalidateQueries({ queryKey: ["pipeline-projects"] });
    },
    onError: (reason) => setError(reason instanceof Error ? reason.message : "Project save failed."),
  });

  const openProject = async (id: string) => {
    try {
      const project = await api.getPipelineProject(id);
      setName(project.name);
      setProjectId(project.project_id);
      const componentMap = new Map((catalog.data?.components ?? []).map((item) => [item.type, item]));
      setNodes(project.graph.nodes.map((node, index) => {
        const component = componentMap.get(node.type);
        return {
          id: node.id,
          type: "default",
          position: { x: 160 + (index % 4) * 230, y: 90 + Math.floor(index / 4) * 150 },
          data: {
            label: node.type,
            type: node.type,
            config: node.config,
            inputPort: Object.keys(component?.inputs ?? {})[0] ?? "input",
            outputPort: Object.keys(component?.outputs ?? {})[0] ?? "output",
          },
        };
      }));
      setEdges(project.graph.edges.map((edge, index) => ({
        id: `e-${index}`, source: edge.source, target: edge.target,
        sourceHandle: null, targetHandle: null, type: "smoothstep",
        data: { sourcePort: edge.source_port, targetPort: edge.target_port },
      })));
      setSelectedId(null);
      setNotice(`Opened “${project.name}”.`);
      setError("");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not open project.");
    }
  };

  const applyConfig = () => {
    if (!selectedNode) return;
    try {
      const config = JSON.parse(configText) as Record<string, unknown>;
      setNodes((current) => current.map((node) =>
        node.id === selectedNode.id ? { ...node, data: { ...node.data, config } } : node,
      ));
      setError("");
      setNotice(`Updated configuration for ${selectedNode.data.type}.`);
    } catch {
      setError("Configuration must be valid JSON.");
    }
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex flex-wrap items-center gap-2 border-b border-border bg-background px-3 py-2">
        <Input value={name} onChange={(event) => setName(event.target.value)} aria-label="Pipeline name" className="h-9 w-48" />
        <Input value={projectId} onChange={(event) => setProjectId(event.target.value)} aria-label="Project ID" className="h-9 w-40" />
        <select
          aria-label="Open saved pipeline project"
          className="h-9 max-w-48 rounded-md border border-border bg-card px-2 text-sm"
          defaultValue=""
          onChange={(event) => { if (event.target.value) void openProject(event.target.value); event.target.value = ""; }}
        >
          <option value="">Open project…</option>
          {(projects.data?.projects ?? []).map((project) => <option key={project.project_id} value={project.project_id}>{project.name}</option>)}
        </select>
        <Button variant="secondary" onClick={loadMnistStarter}><Sparkles className="h-4 w-4" /> MNIST starter</Button>
        <Button variant="secondary" onClick={() => save.mutate()} disabled={save.isPending}><Save className="h-4 w-4" /> Save</Button>
        <Button variant="secondary" onClick={() => validate.mutate()} disabled={validate.isPending}><ShieldCheck className="h-4 w-4" /> Validate</Button>
        <Button onClick={() => run.mutate()} disabled={run.isPending || nodes.length === 0}><Play className="h-4 w-4" /> Run pipeline</Button>
      </div>
      <div className="flex min-h-0 flex-1">
        <aside className="w-60 shrink-0 overflow-y-auto border-r border-border bg-card p-3">
          <div className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Components</div>
          {(catalog.data?.components ?? []).map((component) => (
            <button key={component.type} onClick={() => addNode(component.type)} className="mb-1 flex w-full items-center gap-2 rounded-md border border-transparent px-2 py-2 text-left text-sm hover:border-border hover:bg-muted">
              <Plus className="h-3.5 w-3.5 text-primary" /> {component.type}
            </button>
          ))}
          {catalog.isError && <p className="text-xs text-destructive">Could not load component catalog.</p>}
        </aside>
        <div className="relative min-w-0 flex-1">
          <ReactFlow
            nodes={nodes}
            edges={edges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={onConnect}
            onNodeClick={(_, node) => {
              setSelectedId(node.id);
              setConfigText(JSON.stringify(node.data.config ?? {}, null, 2));
            }}
            fitView
            deleteKeyCode={["Delete", "Backspace"]}
            defaultEdgeOptions={{ type: "smoothstep" }}
          >
            <Background variant={BackgroundVariant.Dots} gap={18} size={1} />
            <Controls />
            <MiniMap pannable zoomable />
          </ReactFlow>
          {nodes.length === 0 && <div className="pointer-events-none absolute inset-0 flex items-center justify-center text-sm text-muted-foreground">Add components from the library to start a pipeline.</div>}
        </div>
        <aside className="w-72 shrink-0 overflow-y-auto border-l border-border bg-card p-3">
          <div className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground"><FolderOpen className="h-3.5 w-3.5" /> Component settings</div>
          {selectedNode ? (
            <>
              <div className="mb-2 text-sm font-medium">{selectedNode.data.type}</div>
              <p className="mb-2 text-xs text-muted-foreground">Edit this component’s configuration as JSON. Input/output ports are declared by the component catalog.</p>
              <textarea value={configText} onChange={(event) => setConfigText(event.target.value)} className="min-h-48 w-full rounded-md border border-border bg-background p-2 font-mono text-xs" spellCheck={false} />
              <Button className="mt-2 w-full" onClick={applyConfig}>Apply configuration</Button>
            </>
          ) : <p className="text-xs text-muted-foreground">Select a node to configure it.</p>}
        </aside>
      </div>
      {(error || notice) && <div className={`border-t border-border px-4 py-2 text-xs ${error ? "text-destructive" : "text-muted-foreground"}`}>{error || notice}</div>}
    </div>
  );
}

import { useMutation, useQuery } from "@tanstack/react-query";
import { Handle, Position, type NodeProps } from "@xyflow/react";
import {
  CheckCircle2,
  FolderOpen,
  HardDrive,
  LoaderCircle,
  PackageCheck,
  TriangleAlert,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { api } from "@/lib/api";
import { selectModelInput, selectOutputDirectory } from "@/lib/desktop";
import { formatBytes, formatCount, estimateModelWeightStorage } from "@thinknet/compute-estimator";
import {
  MODEL_LOADER_CATALOG,
  type ThinkNetNode,
} from "@/lib/graph";
import { useDesignerStore } from "@/store/designer-store";
import type {
  LocalModelAsset,
  LocalModelInspection,
  LocalQuantizationJob,
} from "@/types/api";

type QuantizationDtype = "float16" | "bfloat16";

function isInspection(value: unknown): value is LocalModelInspection {
  return (
    typeof value === "object" &&
    value !== null &&
    "model_name" in value &&
    typeof value.model_name === "string" &&
    "parameter_count" in value &&
    typeof value.parameter_count === "number" &&
    "size_bytes" in value &&
    typeof value.size_bytes === "number" &&
    "dtype_counts" in value &&
    typeof value.dtype_counts === "object" &&
    value.dtype_counts !== null
  );
}

function NodeError({ children }: { children: string }) {
  return (
    <p role="alert" className="mt-2 flex items-start gap-1.5 text-[10px] leading-4 text-destructive">
      <TriangleAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" />
      <span>{children}</span>
    </p>
  );
}

function NodeCard({
  title,
  subtitle,
  color,
  selected,
  children,
}: {
  title: string;
  subtitle: string;
  color: string;
  selected: boolean;
  children: React.ReactNode;
}) {
  return (
    <section
      className={`relative w-[292px] rounded-lg border bg-card p-3 shadow-xl ${
        selected ? "border-primary ring-1 ring-primary" : "border-border"
      }`}
      style={{ borderTopWidth: 3, borderTopColor: color }}
    >
      <header className="mb-3">
        <h3 className="text-sm font-semibold">{title}</h3>
        <p className="mt-0.5 text-[10px] leading-4 text-muted-foreground">{subtitle}</p>
      </header>
      {children}
    </section>
  );
}

export function ModelLoaderNode({ id, data, selected }: NodeProps<ThinkNetNode>) {
  const updateNodeConfig = useDesignerStore((state) => state.updateNodeConfig);
  const configuredInfo = data.config.model_info;
  const info = isInspection(configuredInfo) ? configuredInfo : null;
  const modelPath = typeof data.config.model_path === "string" ? data.config.model_path : "";
  const inspect = useMutation({
    mutationFn: async (path: string) => ({
      path,
      info: await api.inspectLocalModel(path),
    }),
    onSuccess: ({ path, info }) => {
      const currentConfig =
        useDesignerStore.getState().nodes.find((node) => node.id === id)?.data.config ?? {};
      updateNodeConfig(id, {
        ...currentConfig,
        model_path: path,
        model_info: info,
        model_error: null,
      });
    },
  });

  async function browseModel() {
    try {
      const path = await selectModelInput();
      if (!path) return;
      updateNodeConfig(id, {
        ...data.config,
        model_path: path,
        model_info: null,
        model_error: null,
      });
      inspect.mutate(path);
    } catch (error) {
      const currentConfig =
        useDesignerStore.getState().nodes.find((node) => node.id === id)?.data.config ?? {};
      updateNodeConfig(id, {
        ...currentConfig,
        model_error: error instanceof Error ? error.message : "Could not select the model input.",
      });
    }
  }

  return (
    <NodeCard
      title="Model Loader"
      subtitle="Load a Hugging Face model folder or .safetensors, .pt, .pth, .bin, or .ckpt checkpoint."
      color={MODEL_LOADER_CATALOG.color}
      selected={selected}
    >
      <Handle
        id="output"
        type="source"
        position={Position.Right}
        className="!h-3 !w-3 !border-2 !border-background !bg-sky-400"
      />
      <Button
        className="nodrag nowheel w-full"
        size="sm"
        variant="secondary"
        onClick={browseModel}
        disabled={inspect.isPending}
      >
        {inspect.isPending ? (
          <LoaderCircle className="h-3.5 w-3.5 animate-spin" />
        ) : (
          <FolderOpen className="h-3.5 w-3.5" />
        )}
        {modelPath ? "Choose another model" : "Browse local models"}
      </Button>
      {modelPath && (
        <p className="mt-2 break-all font-mono text-[9px] leading-4 text-muted-foreground">{modelPath}</p>
      )}
      {info && (
        <dl className="mt-2 space-y-1 border-t border-border pt-2 text-[10px]">
          <div className="flex justify-between gap-2"><dt className="text-muted-foreground">Format</dt><dd>{info.format}</dd></div>
          <div className="flex justify-between gap-2"><dt className="text-muted-foreground">Architecture</dt><dd className="max-w-[65%] truncate text-right">{info.architecture}</dd></div>
          <div className="flex justify-between gap-2"><dt className="text-muted-foreground">Parameters</dt><dd>{formatCount(info.parameter_count)}</dd></div>
          <div className="flex justify-between gap-2"><dt className="text-muted-foreground">Size</dt><dd>{formatBytes(info.size_bytes)}</dd></div>
          <div className="flex justify-between gap-2"><dt className="text-muted-foreground">Dtypes</dt><dd>{Object.keys(info.dtype_counts).join(", ")}</dd></div>
        </dl>
      )}
      {typeof data.config.model_error === "string" && <NodeError>{data.config.model_error}</NodeError>}
      {inspect.error && <NodeError>{inspect.error.message}</NodeError>}
    </NodeCard>
  );
}

export function QuantizerNode({ id, data, selected }: NodeProps<ThinkNetNode>) {
  const nodes = useDesignerStore((state) => state.nodes);
  const edges = useDesignerStore((state) => state.edges);
  const updateNodeConfig = useDesignerStore((state) => state.updateNodeConfig);
  const addLocalAsset = useDesignerStore((state) => state.addLocalAsset);
  const sourceId = edges.find((edge) => edge.target === id)?.source;
  const sourceNode = nodes.find((node) => node.id === sourceId && node.data.typeName === "ModelLoader");
  const sourcePath = typeof sourceNode?.data.config.model_path === "string"
    ? sourceNode.data.config.model_path
    : "";
  const sourceInfo = isInspection(sourceNode?.data.config.model_info)
    ? sourceNode.data.config.model_info
    : null;
  const dtype: QuantizationDtype = data.config.dtype === "bfloat16" ? "bfloat16" : "float16";
  const [outputDirectory, setOutputDirectory] = useState("");
  const [outputName, setOutputName] = useState("");
  const [jobId, setJobId] = useState<string | null>(null);
  const processedJobId = useRef<string | null>(null);
  const [pickerError, setPickerError] = useState<string | null>(null);

  const start = useMutation({
    mutationFn: api.startLocalQuantization,
    onSuccess: (job) => {
      setJobId(job.job_id);
      processedJobId.current = null;
    },
  });
  const job = useQuery({
    queryKey: ["local-model-quantization", jobId],
    queryFn: () => {
      if (!jobId) throw new Error("Quantization job ID is unavailable.");
      return api.getLocalQuantizationJob(jobId);
    },
    enabled: jobId !== null,
    refetchInterval: (query) => {
      const status = (query.state.data as LocalQuantizationJob | undefined)?.status;
      return status === "queued" || status === "running" ? 800 : false;
    },
  });

  const running = start.isPending || job.data?.status === "queued" || job.data?.status === "running";
  const result = job.data?.status === "completed" ? job.data.result : null;
  const error =
    pickerError ??
    start.error?.message ??
    job.error?.message ??
    (job.data?.status === "failed" ? job.data.error : null);
  const estimate = estimateModelWeightStorage(sourceInfo?.parameter_count ?? null, dtype);

  useEffect(() => {
    if (!result || !jobId || processedJobId.current === jobId) return;
    processedJobId.current = jobId;
    const asset: LocalModelAsset = {
      path: result.output_path,
      model_name: result.output_path.split(/[\\/]/).filter(Boolean).at(-1) ?? "quantized-model",
      format: result.format,
      dtype: result.dtype,
      parameter_count: result.parameter_count,
      size_bytes: result.output_size_bytes,
      source_path: sourcePath,
      validation_status: result.validation_status,
    };
    addLocalAsset(asset);
    const currentConfig =
      useDesignerStore.getState().nodes.find((node) => node.id === id)?.data.config ?? {};
    updateNodeConfig(id, { ...currentConfig, output_path: result.output_path });
  }, [addLocalAsset, data.config, id, jobId, result, sourcePath, updateNodeConfig]);

  async function chooseOutputDirectory() {
    try {
      const path = await selectOutputDirectory();
      if (!path) return;
      setOutputDirectory(path);
      setPickerError(null);
      if (!outputName && sourceInfo) setOutputName(`${sourceInfo.model_name}-${dtype}`);
    } catch (cause) {
      setPickerError(cause instanceof Error ? cause.message : "Could not select the output directory.");
    }
  }

  function runQuantization() {
    if (!sourcePath || !outputDirectory || !outputName.trim()) return;
    start.mutate({
      model_path: sourcePath,
      output_directory: outputDirectory,
      output_name: outputName.trim(),
      dtype,
    });
  }

  return (
    <NodeCard
      title="Quantizer"
      subtitle="Convert the connected model and add the validated output to Assets."
      color={data.catalog?.color ?? "#EA580C"}
      selected={selected}
    >
      <Handle
        id="input"
        type="target"
        position={Position.Left}
        className="!h-3 !w-3 !border-2 !border-background !bg-orange-400"
      />
      {!sourceNode && (
        <p className="rounded-md bg-muted px-2 py-1.5 text-[10px] leading-4 text-muted-foreground">
          Connect a Model Loader node to begin.
        </p>
      )}
      {sourceNode && !sourcePath && (
        <p className="rounded-md bg-muted px-2 py-1.5 text-[10px] leading-4 text-muted-foreground">
          Choose a model in the connected Model Loader node.
        </p>
      )}
      <label className="block text-[10px] text-muted-foreground">
        Output precision
        <select
          className="nodrag nowheel mt-1 h-8 w-full rounded-md border border-border bg-background px-2 text-xs text-foreground"
          value={dtype}
          onChange={(event) => {
            const value = event.target.value as QuantizationDtype;
            updateNodeConfig(id, { ...data.config, dtype: value });
            if (sourceInfo) setOutputName(`${sourceInfo.model_name}-${value}`);
          }}
          disabled={running}
        >
          <option value="float16">FP16</option>
          <option value="bfloat16">BF16</option>
        </select>
      </label>
      {estimate.value !== null && (
        <p className="mt-2 flex items-center gap-1 text-[9px] leading-4 text-muted-foreground">
          <HardDrive className="h-3 w-3 shrink-0" />
          Estimated weights: {formatBytes(estimate.value)}. {estimate.warnings[0]}
        </p>
      )}
      <Button
        className="nodrag nowheel mt-2 w-full"
        size="sm"
        variant="secondary"
        onClick={chooseOutputDirectory}
        disabled={running}
      >
        <FolderOpen className="h-3.5 w-3.5" />
        {outputDirectory ? "Change output folder" : "Choose output folder"}
      </Button>
      {outputDirectory && (
        <p className="mt-1 break-all font-mono text-[9px] leading-4 text-muted-foreground">{outputDirectory}</p>
      )}
      <input
        className="nodrag nowheel mt-2 h-8 w-full rounded-md border border-border bg-background px-2 text-[10px] text-foreground"
        aria-label="Output model folder name"
        placeholder="Output folder name"
        value={outputName}
        maxLength={128}
        onChange={(event) => setOutputName(event.target.value)}
        disabled={running}
      />
      <Button
        className="nodrag nowheel mt-2 w-full"
        size="sm"
        onClick={runQuantization}
        disabled={!sourcePath || !outputDirectory || !outputName.trim() || running}
      >
        {running ? <LoaderCircle className="h-3.5 w-3.5 animate-spin" /> : <PackageCheck className="h-3.5 w-3.5" />}
        {running ? "Quantizing…" : "Quantize model"}
      </Button>
      {job.data && (job.data.status === "queued" || job.data.status === "running") && (
        <div className="mt-2" role="status" aria-live="polite">
          <div className="flex justify-between gap-2 text-[9px]">
            <span>{job.data.phase}</span><span>{job.data.progress}%</span>
          </div>
          <div className="mt-1 h-1 overflow-hidden rounded-full bg-muted">
            <div className="h-full bg-primary transition-[width]" style={{ width: `${job.data.progress}%` }} />
          </div>
        </div>
      )}
      {result && (
        <p className="mt-2 flex items-center gap-1 text-[10px] text-success" role="status">
          <CheckCircle2 className="h-3.5 w-3.5" />
          Validated · {formatBytes(result.output_size_bytes)} · {result.size_reduction_percent}% size change
        </p>
      )}
      {error && <NodeError>{error}</NodeError>}
    </NodeCard>
  );
}

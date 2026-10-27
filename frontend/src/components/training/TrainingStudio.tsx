import { useMutation, useQuery } from "@tanstack/react-query";
import { Activity, AlertCircle, CheckCircle2, CircleHelp, Cpu, Database, Download, Play, RefreshCw, ShieldAlert, ShieldCheck, Square, Timer, TriangleAlert, Waves } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { api } from "@/lib/api";
import { useDesignerStore } from "@/store/designer-store";
import { toGraphDef } from "@/lib/graph";
import type { TrainingJob, TrainingPreflight, TrainingSettings } from "@/types/api";

const INITIAL_SETTINGS: TrainingSettings = {
  learning_rate: 0.0003,
  batch_size: 2,
  sequence_length: 32,
  max_steps: 100,
  log_every_steps: 5,
  save_every_steps: 25,
  weight_decay: 0.01,
  gradient_clip_norm: 1,
  seed: 42,
  tokenizer_name: "gpt2",
  dataset_path: "backend/data/text.txt",
  output_dir: "training_output",
};

const numberFields: Array<{ key: keyof TrainingSettings; label: string; min?: number; max?: number; step?: number }> = [
  { key: "learning_rate", label: "Learning rate", min: 0.000001, max: 1, step: 0.0001 },
  { key: "batch_size", label: "Batch size", min: 1, max: 1024, step: 1 },
  { key: "sequence_length", label: "Sequence length", min: 2, max: 8192, step: 1 },
  { key: "max_steps", label: "Training steps", min: 1, max: 10000000, step: 1 },
  { key: "log_every_steps", label: "Log interval", min: 1, max: 1000000, step: 1 },
  { key: "save_every_steps", label: "Checkpoint interval", min: 1, max: 1000000, step: 1 },
  { key: "weight_decay", label: "Weight decay", min: 0, max: 10, step: 0.001 },
  { key: "gradient_clip_norm", label: "Gradient clip norm", min: 0.000001, max: 1000, step: 0.1 },
  { key: "seed", label: "Random seed", min: 0, max: 4294967295, step: 1 },
];

function Metric({ label, value, icon: Icon }: { label: string; value: string; icon: LucideIcon }) {
  return (
    <div className="rounded-xl border border-border bg-background/70 p-4">
      <div className="flex items-center gap-2 text-xs text-muted-foreground"><Icon className="h-4 w-4" />{label}</div>
      <div className="mt-2 text-xl font-semibold tabular-nums">{value}</div>
    </div>
  );
}

function ReadinessRow({ icon: Icon, label, value }: { icon: LucideIcon; label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3 text-xs">
      <span className="flex items-center gap-1.5 text-muted-foreground"><Icon className="h-3.5 w-3.5" />{label}</span>
      <span className="font-mono tabular-nums text-right">{value}</span>
    </div>
  );
}

function ReadinessPanel({ pending, stale, result, error, onCheck }: {
  pending: boolean;
  stale: boolean;
  result: TrainingPreflight | null;
  error: string | null;
  onCheck: () => void;
}) {
  const tone = pending || result == null
    ? "border-border bg-background/60"
    : result.ready
      ? "border-success/30 bg-success/5"
      : "border-destructive/30 bg-destructive/5";
  const Icon = pending || result == null ? CircleHelp : result.ready ? ShieldCheck : ShieldAlert;
  const headline = pending
    ? "Checking graph, dataset and tokenizer…"
    : result == null
      ? "Check that this architecture can train before starting a run."
      : result.ready
        ? "Ready to train."
        : "Cannot start this run yet.";
  return (
    <section className={"mt-4 rounded-xl border p-3 " + tone}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-xs font-semibold">
          <Icon className={"h-4 w-4 shrink-0 " + (pending ? "animate-spin text-accent-foreground" : result?.ready ? "text-success" : "text-destructive")} />
          Run readiness
          {stale && !pending && <span className="rounded-full border border-border px-2 py-0.5 text-[10px] font-normal text-muted-foreground">settings changed</span>}
        </div>
        <button type="button" onClick={onCheck} disabled={pending} className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-card px-2.5 py-1 text-[11px] font-medium hover:bg-muted disabled:opacity-50">
          <RefreshCw className={"h-3.5 w-3.5 " + (pending ? "animate-spin" : "")} />
          {stale || result ? "Re-check" : "Check"}
        </button>
      </div>
      <p className={"mt-2 text-xs leading-5 " + (result && !result.ready ? "text-destructive" : "text-muted-foreground")}>{headline}</p>
      {result && (
        <div className="mt-3 space-y-1.5">
          <ReadinessRow icon={Waves} label="Tokenizer" value={result.tokenizer_name} />
          <ReadinessRow
            icon={Database}
            label="Vocabulary"
            value={result.vocabulary_size == null
              ? "—"
              : result.model_vocab_size != null && result.model_vocab_size !== result.vocabulary_size
                ? result.model_vocab_size.toLocaleString() + " → " + result.vocabulary_size.toLocaleString()
                : result.vocabulary_size.toLocaleString()}
          />
          <ReadinessRow icon={Activity} label="Dataset tokens" value={result.token_count?.toLocaleString() ?? "—"} />
          <ReadinessRow icon={Cpu} label="Parameters" value={result.parameter_count?.toLocaleString() ?? "—"} />
        </div>
      )}
      {result?.graph_adjustments.length ? (
        <ul className="mt-3 space-y-1 border-t border-border pt-2 text-[11px] leading-4 text-muted-foreground">
          {result.graph_adjustments.map((adjustment) => <li key={adjustment}>• {adjustment}</li>)}
        </ul>
      ) : null}
      {result?.warnings.length ? (
        <ul className="mt-2 space-y-1 border-t border-border pt-2 text-[11px] leading-4 text-warning">
          {result.warnings.map((warning) => (
            <li key={warning} className="flex items-start gap-1.5"><TriangleAlert className="mt-0.5 h-3 w-3 shrink-0" /><span>{warning}</span></li>
          ))}
        </ul>
      ) : null}
      {(result?.errors.length ? result.errors : error ? [error] : []).map((message) => (
        <p key={message} role="alert" className="mt-2 flex items-start gap-1.5 text-[11px] leading-4 text-destructive">
          <AlertCircle className="mt-0.5 h-3 w-3 shrink-0" /><span>{message}</span>
        </p>
      ))}
    </section>
  );
}

export function TrainingStudio() {
  const graphName = useDesignerStore((state) => state.graphName);
  const nodes = useDesignerStore((state) => state.nodes);
  const edges = useDesignerStore((state) => state.edges);
  const graph = useMemo(() => toGraphDef(graphName, nodes, edges), [graphName, nodes, edges]);
  const [settings, setSettings] = useState<TrainingSettings>(INITIAL_SETTINGS);
  const [jobId, setJobId] = useState<string | null>(null);
  const [readiness, setReadiness] = useState<{ fingerprint: string; result: TrainingPreflight } | null>(null);
  const hasGraph = graph.nodes.length > 0;
  const activeJob = useQuery({
    queryKey: ["training-job", jobId],
    queryFn: () => api.getTrainingJob(jobId as string),
    enabled: Boolean(jobId),
    refetchInterval: (query) => {
      const status = query.state.data?.status;
      return status === "queued" || status === "running" || status === "cancelling" ? 1200 : false;
    },
  });
  const start = useMutation({
    mutationFn: () => api.startTrainingJob(graph, settings),
    onSuccess: (result) => setJobId(result.job.job_id),
  });
  const cancel = useMutation({
    mutationFn: () => api.cancelTrainingJob(jobId as string),
    onSuccess: () => activeJob.refetch(),
  });
  const job: TrainingJob | undefined = activeJob.data;
  const busy = job?.status === "queued" || job?.status === "running" || job?.status === "cancelling";
  const statusLabel = job?.status ?? (start.isPending ? "submitting" : "ready");
  // Preflight compiles the model server-side, so it runs on demand instead of on every keystroke.
  const fingerprint = useMemo(() => JSON.stringify({ graph, settings }), [graph, settings]);
  const check = useMutation({
    mutationFn: () => api.preflightTrainingJob(graph, settings),
    onSuccess: (result) => setReadiness({ fingerprint, result }),
  });
  const autoChecked = useRef(false);
  const runCheck = useRef(check.mutate);
  runCheck.current = check.mutate;
  useEffect(() => {
    if (autoChecked.current || !hasGraph) return;
    autoChecked.current = true;
    runCheck.current();
  }, [hasGraph]);
  const preflight = readiness?.fingerprint === fingerprint ? readiness.result : null;
  const readinessStale = readiness !== null && preflight === null;
  const logs = useMemo(() => {
    if (!job) return [];
    return [
      "Status: " + job.status,
      job.device ? "Device: " + job.device : null,
      job.parameter_count ? "Parameters: " + job.parameter_count.toLocaleString() : null,
      job.vocabulary_size ? "Vocabulary: " + job.vocabulary_size.toLocaleString() : null,
      job.token_count ? "Dataset tokens: " + job.token_count.toLocaleString() : null,
      ...(job.graph_adjustments ?? []).map((adjustment) => "Graph adjusted: " + adjustment),
      job.message,
      job.error ? "Error: " + job.error : null,
    ].filter((line): line is string => Boolean(line));
  }, [job]);

  function updateSetting<K extends keyof TrainingSettings>(key: K, value: TrainingSettings[K]) {
    setSettings((current) => ({ ...current, [key]: value }));
  }

  return (
    <main className="min-h-0 flex-1 overflow-y-auto bg-background">
      <div className="mx-auto max-w-6xl space-y-6 p-6 lg:p-8">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-accent-foreground">
              <Waves className="h-4 w-4" /> ThinkNet / Experiment
            </div>
            <h1 className="text-3xl font-semibold tracking-tight">Model Training Studio</h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
              Configure a run for the current architecture, monitor backend metrics, and export the resulting checkpoints.
            </p>
          </div>
          <span className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-3 py-2 text-xs">
            <span className={"h-2 w-2 rounded-full " + (busy ? "animate-pulse bg-warning" : job?.status === "completed" ? "bg-success" : job?.status === "failed" ? "bg-destructive" : "bg-muted-foreground")} />
            {statusLabel}
          </span>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <Metric label="Current architecture" value={graph.name || "Untitled"} icon={Cpu} />
          <Metric label="Training objective" value="Next-token prediction" icon={Activity} />
          <Metric label="Execution" value={job?.device ?? "Local backend"} icon={Waves} />
          <Metric label="Elapsed time" value={job ? Math.floor(job.elapsed_seconds / 60) + "m " + Math.floor(job.elapsed_seconds % 60) + "s" : "—"} icon={Timer} />
        </div>

        <div className="grid gap-6 xl:grid-cols-[minmax(0,1.15fr)_minmax(340px,0.85fr)]">
          <section className="rounded-2xl border border-border bg-card p-5">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="text-base font-semibold">Training configuration</h2>
                <p className="mt-1 text-xs leading-5 text-muted-foreground">Settings are sent to the backend when you start a run.</p>
              </div>
              <button type="button" onClick={() => setSettings(INITIAL_SETTINGS)} disabled={Boolean(busy)} className="rounded-lg border border-border px-3 py-1.5 text-xs hover:bg-muted disabled:opacity-50">Reset</button>
            </div>
            <div className="mt-5 grid gap-4 sm:grid-cols-2">
              {numberFields.map(({ key, label, min, max, step }) => (
                <label key={key} className="block">
                  <span className="mb-1.5 block text-xs font-medium text-muted-foreground">{label}</span>
                  <input
                    className="w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm outline-none focus:border-primary"
                    type="number" min={min} max={max} step={step}
                    value={settings[key] as number}
                    disabled={Boolean(busy)}
                    onChange={(event) => updateSetting(key, Number(event.target.value) as never)}
                  />
                </label>
              ))}
              <label className="block">
                <span className="mb-1.5 block text-xs font-medium text-muted-foreground">Tokenizer model</span>
                <input className="w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm outline-none focus:border-primary" value={settings.tokenizer_name} disabled={Boolean(busy)} onChange={(event) => updateSetting("tokenizer_name", event.target.value)} />
              </label>
              <label className="block sm:col-span-2">
                <span className="mb-1.5 block text-xs font-medium text-muted-foreground">Dataset text file (backend path)</span>
                <input className="w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm outline-none focus:border-primary" value={settings.dataset_path} disabled={Boolean(busy)} onChange={(event) => updateSetting("dataset_path", event.target.value)} />
              </label>
            </div>
            <div className="mt-4 flex items-start gap-2 rounded-xl border border-border bg-background/60 p-3 text-xs leading-5 text-muted-foreground">
              <CircleHelp className="mt-0.5 h-4 w-4 shrink-0 text-accent-foreground" />
              This live runner supports causal language models whose output is [batch, sequence, vocabulary] logits. Before training, ThinkNet widens the token embedding, language-model head and position limits on a job-local copy of your graph so they cover the tokenizer — the canvas graph is never modified, and the widened graph is saved with the run. GPU use depends on the device already available to the backend; remote GPU providers are not connected yet.
            </div>
            <ReadinessPanel
              pending={check.isPending}
              stale={readinessStale}
              result={preflight}
              error={check.isError ? check.error.message : null}
              onCheck={() => check.mutate()}
            />
            <div className="mt-5 flex flex-wrap gap-3">
              <button type="button" onClick={() => start.mutate()} disabled={!hasGraph || Boolean(busy) || start.isPending} className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40">
                <Play className="h-4 w-4" /> {start.isPending ? "Starting…" : "Start training"}
              </button>
              {busy && <button type="button" onClick={() => cancel.mutate()} disabled={cancel.isPending || job?.status === "cancelling"} className="inline-flex items-center gap-2 rounded-xl border border-border px-4 py-2.5 text-sm font-medium hover:bg-muted disabled:opacity-50"><Square className="h-4 w-4" /> Cancel run</button>}
              {job?.artifact_available && <button type="button" onClick={() => window.open(api.getTrainingDownloadUrl(job.job_id), "_blank", "noopener,noreferrer")} className="inline-flex items-center gap-2 rounded-xl border border-border px-4 py-2.5 text-sm font-medium hover:bg-muted"><Download className="h-4 w-4" /> Download artifacts</button>}
            </div>
            {!hasGraph && <p className="mt-3 text-xs text-warning">Build or load a graph in the Build workspace before starting training.</p>}
            {start.isError && <p role="alert" className="mt-3 text-xs text-destructive">{start.error.message}</p>}
            {activeJob.isError && <p role="alert" className="mt-3 text-xs text-destructive">{activeJob.error.message}</p>}
          </section>

          <section className="rounded-2xl border border-border bg-card p-5">
            <div className="flex items-start justify-between">
              <div><h2 className="text-base font-semibold">Live run monitor</h2><p className="mt-1 text-xs text-muted-foreground">Refreshes from the backend while the job is active.</p></div>
              <Activity className="h-5 w-5 text-accent-foreground" />
            </div>
            <div className="mt-5 grid grid-cols-2 gap-3">
              <Metric label="Step" value={job ? job.step + " / " + job.total_steps : "0 / 0"} icon={Activity} />
              <Metric label="Latest loss" value={typeof job?.loss === "number" ? job.loss.toFixed(4) : "—"} icon={Waves} />
            </div>
            <div className="mt-5">
              <div className="mb-2 flex justify-between text-xs"><span className="text-muted-foreground">Progress</span><span className="font-mono">{(job?.progress ?? 0).toFixed(1)}%</span></div>
              <div className="h-2 overflow-hidden rounded-full bg-muted"><div className="h-full rounded-full bg-primary transition-all duration-300" style={{ width: (job?.progress ?? 0) + "%" }} /></div>
            </div>
            <div className="mt-5 rounded-xl border border-border bg-background p-3">
              <div className="mb-2 flex items-center gap-2 text-xs font-semibold"><Activity className="h-4 w-4 text-accent-foreground" /> Run events</div>
              <div className="max-h-48 space-y-2 overflow-auto font-mono text-[11px] leading-5 text-muted-foreground">
                {logs.length ? logs.map((line, index) => <div key={index} className="break-words">{line}</div>) : <div>Configure the run and start training to see live status here.</div>}
              </div>
            </div>
            {job?.status === "running" && job.phase === "saving" && <div className="mt-4 flex items-center gap-2 rounded-xl border border-border bg-background/60 p-3 text-xs text-muted-foreground"><RefreshCw className="h-4 w-4 animate-spin" /> Saving weights, checkpoints, metrics and the artifact archive…</div>}
            {job?.status === "completed" && <div className="mt-4 flex items-center gap-2 rounded-xl border border-success/30 bg-success/5 p-3 text-xs text-success"><CheckCircle2 className="h-4 w-4" /> {job.artifact_available ? "Run complete. model_state_dict.pt, checkpoints, metrics, graph.json and the tokenizer are packaged for download." : "Run complete, but no artifact bundle was written. Check the backend output directory."}</div>}
            {job?.status === "failed" && <div role="alert" className="mt-4 flex items-start gap-2 rounded-xl border border-destructive/30 bg-destructive/5 p-3 text-xs leading-5 text-destructive"><AlertCircle className="mt-0.5 h-4 w-4 shrink-0" /><span>{job.error || "Training failed. Check the backend logs."}</span></div>}
            {job?.status === "cancelled" && <div className="mt-4 rounded-xl border border-border p-3 text-xs leading-5 text-muted-foreground">{job.artifact_available ? "Run cancelled. Weights up to the last completed step were saved — download the artifact bundle, then start another run when ready." : "Run cancelled before any step completed, so nothing was saved. Start another run when ready."}</div>}
          </section>
        </div>
        <p className="text-xs leading-5 text-muted-foreground">Local-first milestone: jobs run in the backend process and are held in memory. Restarting the backend clears the run list. Only the supported causal-language-model objective is enabled in this version; image classification, RL, remote GPUs, and resume-from-checkpoint are future work.</p>
      </div>
    </main>
  );
}

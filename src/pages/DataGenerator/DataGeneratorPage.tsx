import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Check, Copy, Database, Download, Loader2, Sparkles } from 'lucide-react';
import {
  allEpisodes,
  environmentFamilies,
  getEpisodeBySlug,
  getEpisodesBySeriesId,
  getSeriesByFamilySlug,
} from '../../data/environments';
import { standardDifficultyLevels } from '../../data/engine/universalEngine';
import { ResearchImage } from '../../components/shared/ResearchImage';
import { visualAssets } from '../../data/visualAssets';
import { FamilySlug } from '../../types/thinknet';

type TrainingFormat =
  | 'SFT Trajectory'
  | 'Verifiable Reward (RLVR)'
  | 'Preference Pair (DPO)'
  | 'Reasoning Distillation';

interface GeneratedSample {
  sampleId: string;
  taskTitle: string;
  inputPrompt: string;
  expectedToolsOrContext: string[];
  primaryOutput: string;
  secondaryOutput?: string;
  verificationCriteria: string;
  verificationNotes: string;
  qualityScoreEstimate: number;
}

interface GeneratorResponse {
  generatedAt: string;
  model: string;
  metadata: {
    familyName: string;
    seriesName: string;
    episodeName: string;
    difficultyLevel: string;
    trainingFormat: string;
  };
  curriculumSummary: string;
  contaminationSafeguard: string;
  samples: GeneratedSample[];
}

const trainingFormats: Array<{ id: TrainingFormat; desc: string }> = [
  {
    id: 'SFT Trajectory',
    desc: 'Validated task prompt, reasoning trace, tool/environment steps, and final verified output.',
  },
  {
    id: 'Verifiable Reward (RLVR)',
    desc: 'Task prompt paired with deterministic test, math, geometric, or state verification criteria.',
  },
  {
    id: 'Preference Pair (DPO)',
    desc: 'Chosen high-rigor execution trajectory paired against a flawed trajectory for preference tuning.',
  },
  {
    id: 'Reasoning Distillation',
    desc: 'Detailed teacher reasoning synthesis mapped to a compact student target representation.',
  },
];

const presetSlugs = [
  'kernel-optimization',
  'beat-perplexity-ai-in-the-research-game',
  'build-better-than-the-original',
  'the-tool-using-llm',
];

export function DataGeneratorPage() {
  const [searchParams] = useSearchParams();
  const initialEpSlug = searchParams.get('episode');
  const initialEp = initialEpSlug ? getEpisodeBySlug(initialEpSlug) : undefined;

  const [familySlug, setFamilySlug] = useState<FamilySlug>(
    initialEp?.familySlug ?? 'low-level-engineering'
  );

  const seriesInFamily = useMemo(
    () => getSeriesByFamilySlug(familySlug),
    [familySlug]
  );

  const [seriesId, setSeriesId] = useState<string>(
    initialEp?.seriesId ?? seriesInFamily[0]?.id ?? ''
  );

  const episodesInSeries = useMemo(
    () => getEpisodesBySeriesId(seriesId),
    [seriesId]
  );

  const [episodeSlug, setEpisodeSlug] = useState<string>(
    initialEp?.slug ?? episodesInSeries[0]?.slug ?? ''
  );

  useEffect(() => {
    if (initialEp) {
      setFamilySlug(initialEp.familySlug);
      setSeriesId(initialEp.seriesId);
      setEpisodeSlug(initialEp.slug);
    }
  }, [initialEpSlug]);

  // Sync seriesId when family changes
  useEffect(() => {
    if (!seriesInFamily.some((s) => s.id === seriesId)) {
      const nextSeries = seriesInFamily[0];
      if (nextSeries) {
        setSeriesId(nextSeries.id);
      }
    }
  }, [familySlug, seriesInFamily, seriesId]);

  // Sync episodeSlug when series changes
  useEffect(() => {
    if (!episodesInSeries.some((e) => e.slug === episodeSlug)) {
      const nextEp = episodesInSeries[0];
      if (nextEp) {
        setEpisodeSlug(nextEp.slug);
      }
    }
  }, [seriesId, episodesInSeries, episodeSlug]);

  const selectedFamily =
    environmentFamilies.find((f) => f.slug === familySlug) ?? environmentFamilies[0];
  const selectedSeries =
    seriesInFamily.find((s) => s.id === seriesId) ?? seriesInFamily[0];
  const selectedEpisode =
    episodesInSeries.find((e) => e.slug === episodeSlug) ??
    episodesInSeries[0] ??
    allEpisodes[0];

  const [difficultyLevel, setDifficultyLevel] = useState<string>(
    'Level 3 — Advanced'
  );
  const [trainingFormat, setTrainingFormat] = useState<TrainingFormat>(
    'Verifiable Reward (RLVR)'
  );
  const [sampleCount, setSampleCount] = useState<number>(3);
  const [customFocus, setCustomFocus] = useState<string>('');

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<GeneratorResponse | null>(null);
  const [viewMode, setViewMode] = useState<'structured' | 'jsonl'>('structured');
  const [copied, setCopied] = useState(false);

  const applyPreset = (slug: string) => {
    const ep = getEpisodeBySlug(slug);
    if (!ep) return;
    setFamilySlug(ep.familySlug);
    setSeriesId(ep.seriesId);
    setEpisodeSlug(ep.slug);
  };

  const handleGenerate = async () => {
    if (!selectedEpisode) return;
    setLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/data-generator', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          familyName: selectedFamily.name,
          seriesName: selectedSeries?.name ?? selectedEpisode.seriesName,
          episodeName: selectedEpisode.name,
          episodeObjective: selectedEpisode.objective,
          learningObjectives: selectedEpisode.learningObjectives,
          difficultyLevel,
          trainingFormat,
          sampleCount,
          customFocus: customFocus.trim() || undefined,
        }),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || `Request failed with status ${response.status}`);
      }
      setResult(data as GeneratorResponse);
    } catch (err: unknown) {
      setError(
        err instanceof Error
          ? err.message
          : 'Unable to reach ThinkNet Data Generator service.'
      );
    } finally {
      setLoading(false);
    }
  };

  const jsonlString = useMemo(() => {
    if (!result) return '';
    return result.samples
      .map((s) =>
        JSON.stringify({
          ...result.metadata,
          model: result.model,
          generatedAt: result.generatedAt,
          ...s,
        })
      )
      .join('\n');
  }, [result]);

  const handleCopy = async () => {
    if (!jsonlString) return;
    await navigator.clipboard.writeText(jsonlString);
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  };

  const handleDownload = () => {
    if (!jsonlString || !selectedEpisode) return;
    const blob = new Blob([jsonlString], { type: 'application/x-ndjson' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `thinknet-${selectedEpisode.slug}-${Date.now()}.jsonl`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
      {/* Header */}
      <header className="border-b border-white/[0.08] pb-10 grid grid-cols-1 gap-8 lg:grid-cols-12 items-stretch">
        <div className="lg:col-span-7 flex flex-col justify-center">
          <p className="font-mono text-xs uppercase tracking-wider text-[#38BDF8]">
            Data Engineering · Training Data Exporter
          </p>
          <h1 className="mt-2 font-display text-3xl font-bold text-white sm:text-4xl text-balance">
            ThinkNet Synthetic Data Generator
          </h1>
          <p className="mt-3 text-sm text-slate-300 sm:text-base leading-relaxed">
            Synthesize structured, curriculum-aligned training examples directly from ThinkNet&apos;s
            Environment Families, Episodes, and Difficulty Tiers—complete with verifiable reward
            criteria, contamination safeguards, and JSONL export for SFT, RLVR, DPO, and
            Knowledge Distillation.
          </p>
          <div className="mt-5 flex flex-wrap items-center gap-2 text-xs text-slate-400">
            <span className="font-mono text-slate-300">Quick Presets:</span>
            {presetSlugs.map((slug) => {
              const ep = getEpisodeBySlug(slug);
              if (!ep) return null;
              return (
                <button
                  key={slug}
                  type="button"
                  onClick={() => applyPreset(slug)}
                  className={`rounded border px-2.5 py-1 text-xs transition-colors whitespace-nowrap ${
                    selectedEpisode?.slug === slug
                      ? 'border-[#38BDF8] bg-[#38BDF8]/10 text-white'
                      : 'border-white/[0.1] bg-[#0B0E17] text-slate-300 hover:border-white/25 hover:text-white'
                  }`}
                >
                  {ep.name}
                </button>
              );
            })}
          </div>
        </div>

        <div className="lg:col-span-5 overflow-hidden rounded-lg border border-white/[0.08]">
          <ResearchImage
            src={visualAssets.heroLab.src}
            alt={visualAssets.heroLab.alt}
            caption="Data Research Agent · Curriculum Synthesis & Trajectory Export"
            aspectClass="aspect-video lg:h-full"
          />
        </div>
      </header>

      {/* Main Split Console */}
      <div className="mt-10 grid grid-cols-1 gap-8 lg:grid-cols-12 items-start">
        {/* Left Parameter Configuration Column */}
        <aside className="lg:col-span-4 rounded-lg border border-white/[0.08] bg-[#0B0E17] p-6 space-y-5">
          <div>
            <h2 className="font-display text-base font-semibold text-white">
              Curriculum &amp; Export Configuration
            </h2>
            <p className="mt-1 text-xs text-slate-400">
              Bind generation strictly to an episode in the ThinkNet registry.
            </p>
          </div>

          {/* Environment Family */}
          <div className="space-y-1.5">
            <label
              htmlFor="gen-family"
              className="block font-mono text-[11px] uppercase tracking-wider text-slate-400"
            >
              Environment Family
            </label>
            <select
              id="gen-family"
              value={familySlug}
              onChange={(e) => setFamilySlug(e.target.value as FamilySlug)}
              className="w-full rounded-md border border-white/[0.12] bg-[#07090E] px-3 py-2 text-sm text-white focus:border-[#3B82F6] focus:outline-none"
            >
              {environmentFamilies.map((f) => (
                <option key={f.id} value={f.slug}>
                  {f.number}. {f.name}
                </option>
              ))}
            </select>
          </div>

          {/* Series */}
          <div className="space-y-1.5">
            <label
              htmlFor="gen-series"
              className="block font-mono text-[11px] uppercase tracking-wider text-slate-400"
            >
              Series / Environment
            </label>
            <select
              id="gen-series"
              value={seriesId}
              onChange={(e) => setSeriesId(e.target.value)}
              className="w-full rounded-md border border-white/[0.12] bg-[#07090E] px-3 py-2 text-sm text-white focus:border-[#3B82F6] focus:outline-none"
            >
              {seriesInFamily.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.code}: {s.name}
                </option>
              ))}
            </select>
          </div>

          {/* Episode */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label
                htmlFor="gen-episode"
                className="block font-mono text-[11px] uppercase tracking-wider text-slate-400"
              >
                Target Episode
              </label>
              {selectedEpisode && (
                <Link
                  to={`/episodes/${selectedEpisode.slug}`}
                  className="text-[11px] text-[#38BDF8] hover:underline"
                >
                  View Spec →
                </Link>
              )}
            </div>
            <select
              id="gen-episode"
              value={episodeSlug}
              onChange={(e) => setEpisodeSlug(e.target.value)}
              className="w-full rounded-md border border-white/[0.12] bg-[#07090E] px-3 py-2 text-sm text-white focus:border-[#3B82F6] focus:outline-none"
            >
              {episodesInSeries.map((ep) => (
                <option key={ep.id} value={ep.slug}>
                  {ep.number} — {ep.name}
                </option>
              ))}
            </select>
          </div>

          {/* Difficulty Level */}
          <div className="space-y-1.5">
            <label
              htmlFor="gen-difficulty"
              className="block font-mono text-[11px] uppercase tracking-wider text-slate-400"
            >
              Difficulty Progression Tier
            </label>
            <select
              id="gen-difficulty"
              value={difficultyLevel}
              onChange={(e) => setDifficultyLevel(e.target.value)}
              className="w-full rounded-md border border-white/[0.12] bg-[#07090E] px-3 py-2 text-sm text-white focus:border-[#3B82F6] focus:outline-none"
            >
              {standardDifficultyLevels.map((lvl) => (
                <option
                  key={lvl.id}
                  value={`Level ${lvl.level} — ${lvl.name}`}
                >
                  Level {lvl.level} — {lvl.name}
                </option>
              ))}
            </select>
          </div>

          {/* Training Output Format */}
          <div className="space-y-2">
            <span className="block font-mono text-[11px] uppercase tracking-wider text-slate-400">
              Training Integration Format
            </span>
            <div className="space-y-1.5">
              {trainingFormats.map((fmt) => {
                const active = trainingFormat === fmt.id;
                return (
                  <button
                    key={fmt.id}
                    type="button"
                    onClick={() => setTrainingFormat(fmt.id)}
                    className={`w-full rounded-md border p-3 text-left transition-colors ${
                      active
                        ? 'border-[#3B82F6] bg-[#3B82F6]/10'
                        : 'border-white/[0.08] bg-[#07090E] hover:border-white/20'
                    }`}
                  >
                    <p className="text-xs font-semibold text-white">{fmt.id}</p>
                    <p className="mt-0.5 text-[11px] text-slate-400 leading-relaxed">
                      {fmt.desc}
                    </p>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Sample Count */}
          <div className="space-y-1.5">
            <span className="block font-mono text-[11px] uppercase tracking-wider text-slate-400">
              Batch Size (Samples)
            </span>
            <div className="grid grid-cols-3 gap-2">
              {[1, 3, 5].map((n) => (
                <button
                  key={n}
                  type="button"
                  onClick={() => setSampleCount(n)}
                  className={`rounded border py-2 font-mono text-xs tabular-nums transition-colors ${
                    sampleCount === n
                      ? 'border-[#3B82F6] bg-[#3B82F6] text-white'
                      : 'border-white/[0.08] bg-[#07090E] text-slate-300 hover:border-white/25'
                  }`}
                >
                  {n} {n === 1 ? 'Sample' : 'Samples'}
                </button>
              ))}
            </div>
          </div>

          {/* Optional Custom Focus */}
          <div className="space-y-1.5">
            <label
              htmlFor="gen-focus"
              className="block font-mono text-[11px] uppercase tracking-wider text-slate-400"
            >
              Custom Constraint or Focus (Optional)
            </label>
            <textarea
              id="gen-focus"
              rows={2}
              value={customFocus}
              onChange={(e) => setCustomFocus(e.target.value)}
              placeholder="e.g., Triton shared-memory bank conflicts, or 100K+ cross-file API drift..."
              className="w-full rounded-md border border-white/[0.12] bg-[#07090E] px-3 py-2 text-xs text-white placeholder-slate-500 focus:border-[#3B82F6] focus:outline-none"
            />
          </div>

          <button
            type="button"
            disabled={loading}
            onClick={handleGenerate}
            className="flex w-full items-center justify-center gap-2 rounded-md bg-[#3B82F6] px-4 py-3 text-sm font-medium text-white transition-colors hover:bg-[#2563EB] disabled:opacity-50"
          >
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                <span>Synthesizing Dataset...</span>
              </>
            ) : (
              <>
                <Sparkles className="h-4 w-4" />
                <span>Generate Training Samples</span>
              </>
            )}
          </button>
        </aside>

        {/* Right Output & Dataset Inspector */}
        <section className="lg:col-span-8 space-y-6">
          {/* Selected Episode Context Strip */}
          {selectedEpisode && (
            <div className="rounded-lg border border-white/[0.08] bg-[#0B0E17] p-5 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-400">
                <span className="font-mono text-[#38BDF8]">
                  Active Target: {selectedEpisode.number} · {selectedEpisode.name}
                </span>
                <span className="font-mono tabular-nums">
                  {selectedEpisode.learningObjectives.length} Learning Objectives
                </span>
              </div>
              <p className="text-xs text-slate-300 leading-relaxed">
                {selectedEpisode.objective}
              </p>
            </div>
          )}

          {/* Error State */}
          {error && (
            <div
              role="alert"
              className="rounded-lg border border-rose-500/40 bg-rose-950/25 p-5 space-y-2"
            >
              <p className="font-mono text-xs uppercase text-rose-400">
                Generation Error
              </p>
              <p className="text-sm text-rose-100">{error}</p>
              <p className="text-xs text-slate-300">
                Ensure a valid Gemini API key is configured in your environment{' '}
                <span className="font-medium text-white">Settings &gt; Secrets</span> panel.
              </p>
            </div>
          )}

          {/* Loading Skeleton */}
          {loading && (
            <div className="space-y-4">
              {Array.from({ length: sampleCount }).map((_, idx) => (
                <div
                  key={idx}
                  className="animate-pulse rounded-lg border border-white/[0.08] bg-[#0B0E17] p-6 space-y-3"
                >
                  <div className="h-3 w-36 rounded bg-white/[0.08]" />
                  <div className="h-5 w-2/3 rounded bg-white/[0.08]" />
                  <div className="h-16 w-full rounded bg-white/[0.05]" />
                </div>
              ))}
            </div>
          )}

          {/* Empty State */}
          {!loading && !result && !error && (
            <div className="rounded-lg border border-white/[0.08] bg-[#0B0E17] p-10 text-center space-y-4">
              <Database className="mx-auto h-8 w-8 text-[#38BDF8]/80" />
              <div className="space-y-2 max-w-lg mx-auto">
                <h3 className="font-display text-lg font-semibold text-white">
                  Ready to Synthesize Structured Training Data
                </h3>
                <p className="text-sm text-slate-400 leading-relaxed">
                  Select an Environment Family, Episode, Difficulty Tier, and Training Format on
                  the left, then click <span className="text-white">Generate Training Samples</span>{' '}
                  to produce verifiable synthetic records ready for JSONL export.
                </p>
              </div>
            </div>
          )}

          {/* Populated Results */}
          {!loading && result && (
            <div className="space-y-6">
              {/* Summary & Export Controls */}
              <div className="rounded-lg border border-white/[0.08] bg-[#0B0E17] p-5 space-y-4">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="font-mono text-xs text-[#38BDF8]">
                      Generated {result.samples.length} Samples · {result.metadata.trainingFormat}
                    </p>
                    <p className="mt-1 text-xs text-slate-300 leading-relaxed">
                      {result.curriculumSummary}
                    </p>
                  </div>

                  <div className="flex flex-wrap items-center gap-2 shrink-0">
                    <div className="flex rounded border border-white/[0.1] bg-[#07090E] p-0.5">
                      <button
                        type="button"
                        onClick={() => setViewMode('structured')}
                        className={`rounded px-2.5 py-1 text-xs font-medium ${
                          viewMode === 'structured'
                            ? 'bg-[#3B82F6] text-white'
                            : 'text-slate-400 hover:text-white'
                        }`}
                      >
                        Structured
                      </button>
                      <button
                        type="button"
                        onClick={() => setViewMode('jsonl')}
                        className={`rounded px-2.5 py-1 text-xs font-medium ${
                          viewMode === 'jsonl'
                            ? 'bg-[#3B82F6] text-white'
                            : 'text-slate-400 hover:text-white'
                        }`}
                      >
                        JSONL
                      </button>
                    </div>

                    <button
                      type="button"
                      onClick={handleCopy}
                      className="inline-flex items-center gap-1.5 rounded border border-white/[0.12] bg-[#07090E] px-3 py-1.5 text-xs text-slate-200 hover:border-white/30"
                    >
                      {copied ? (
                        <>
                          <Check className="h-3.5 w-3.5 text-emerald-400" />
                          <span>Copied</span>
                        </>
                      ) : (
                        <>
                          <Copy className="h-3.5 w-3.5" />
                          <span>Copy JSONL</span>
                        </>
                      )}
                    </button>

                    <button
                      type="button"
                      onClick={handleDownload}
                      className="inline-flex items-center gap-1.5 rounded bg-[#3B82F6] px-3 py-1.5 text-xs font-medium text-white hover:bg-[#2563EB]"
                    >
                      <Download className="h-3.5 w-3.5" />
                      <span>Export .jsonl</span>
                    </button>
                  </div>
                </div>

                <div className="rounded border border-white/[0.06] bg-[#07090E] px-3.5 py-2.5 text-xs text-slate-400">
                  <span className="font-mono text-slate-300 uppercase mr-2">
                    Contamination Safeguard:
                  </span>
                  {result.contaminationSafeguard}
                </div>
              </div>

              {viewMode === 'jsonl' ? (
                <pre className="overflow-x-auto rounded-lg border border-white/[0.08] bg-[#0B0E17] p-5 font-mono text-xs text-slate-200 leading-relaxed">
                  {jsonlString}
                </pre>
              ) : (
                <div className="space-y-4">
                  {result.samples.map((sample) => (
                    <article
                      key={sample.sampleId}
                      className="rounded-lg border border-white/[0.08] bg-[#0B0E17] p-6 space-y-4"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-400">
                        <span className="font-mono text-[#38BDF8]">{sample.sampleId}</span>
                        <span className="font-mono tabular-nums">
                          Rubric Clarity Score: {sample.qualityScoreEstimate.toFixed(2)}
                        </span>
                      </div>

                      <h3 className="font-display text-lg font-semibold text-white">
                        {sample.taskTitle}
                      </h3>

                      <div className="space-y-1.5">
                        <p className="font-mono text-[11px] uppercase tracking-wider text-slate-400">
                          Task Input / Prompt
                        </p>
                        <div className="rounded border border-white/[0.06] bg-[#07090E] p-3.5 text-sm text-slate-200 whitespace-pre-wrap leading-relaxed">
                          {sample.inputPrompt}
                        </div>
                      </div>

                      {sample.expectedToolsOrContext.length > 0 && (
                        <div className="flex flex-wrap items-center gap-2 text-xs text-slate-400">
                          <span className="font-mono uppercase text-[11px]">
                            Environment Tools:
                          </span>
                          {sample.expectedToolsOrContext.map((t, i) => (
                            <span key={t} className="font-mono text-slate-200">
                              {i > 0 && '· '}
                              {t}
                            </span>
                          ))}
                        </div>
                      )}

                      <div className="space-y-1.5">
                        <p className="font-mono text-[11px] uppercase tracking-wider text-[#38BDF8]">
                          {result.metadata.trainingFormat === 'Preference Pair (DPO)'
                            ? 'Chosen Trajectory (Primary)'
                            : result.metadata.trainingFormat === 'Reasoning Distillation'
                              ? 'Teacher Reasoning Trace'
                              : 'Reference Execution / Trajectory'}
                        </p>
                        <div className="rounded border border-white/[0.06] bg-[#07090E] p-3.5 text-xs text-slate-200 whitespace-pre-wrap leading-relaxed font-mono">
                          {sample.primaryOutput}
                        </div>
                      </div>

                      {sample.secondaryOutput && (
                        <div className="space-y-1.5">
                          <p className="font-mono text-[11px] uppercase tracking-wider text-slate-400">
                            {result.metadata.trainingFormat === 'Preference Pair (DPO)'
                              ? 'Rejected Trajectory (Comparison)'
                              : result.metadata.trainingFormat === 'Reasoning Distillation'
                                ? 'Compact Student Target'
                                : 'Edge-Case Variant'}
                          </p>
                          <div className="rounded border border-white/[0.06] bg-[#07090E] p-3.5 text-xs text-slate-300 whitespace-pre-wrap leading-relaxed font-mono">
                            {sample.secondaryOutput}
                          </div>
                        </div>
                      )}

                      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 border-t border-white/[0.06] pt-4 text-xs">
                        <div>
                          <p className="font-mono text-[11px] uppercase text-slate-400 mb-1">
                            Verification Criteria
                          </p>
                          <p className="text-slate-300 leading-relaxed">
                            {sample.verificationCriteria}
                          </p>
                        </div>
                        <div>
                          <p className="font-mono text-[11px] uppercase text-slate-400 mb-1">
                            Quality &amp; Failure Notes
                          </p>
                          <p className="text-slate-300 leading-relaxed">
                            {sample.verificationNotes}
                          </p>
                        </div>
                      </div>
                    </article>
                  ))}
                </div>
              )}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

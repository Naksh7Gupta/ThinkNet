import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, Search } from 'lucide-react';
import {
  adaptiveEpisodeLoop,
  engineHierarchy,
  roboticsInterconnectionDomains,
  standardDifficultyLevels,
  universalEngineComponents,
} from '../../data/engine/universalEngine';
import { allEpisodes, environmentFamilies } from '../../data/environments';
import { EngineComponent, FamilySlug } from '../../types/thinknet';
import { ResearchImage } from '../../components/shared/ResearchImage';
import { visualAssets } from '../../data/visualAssets';

const componentLayers: Array<'All' | EngineComponent['layer']> = [
  'All',
  'Definition',
  'Generation',
  'Execution',
  'Measurement',
  'Integration',
];

export function EpisodesDirectoryPage() {
  const [selectedStep, setSelectedStep] = useState(0);
  const [layerFilter, setLayerFilter] = useState<'All' | EngineComponent['layer']>('All');
  const [selectedAdaptiveStep, setSelectedAdaptiveStep] = useState(0);

  const [familyFilter, setFamilyFilter] = useState<'all' | FamilySlug>('all');
  const [episodeQuery, setEpisodeQuery] = useState('');
  const [page, setPage] = useState(1);
  const pageSize = 18;

  const visibleComponents = useMemo(() => {
    if (layerFilter === 'All') return universalEngineComponents;
    return universalEngineComponents.filter((c) => c.layer === layerFilter);
  }, [layerFilter]);

  const filteredEpisodes = useMemo(() => {
    const q = episodeQuery.trim().toLowerCase();
    return allEpisodes.filter((ep) => {
      if (familyFilter !== 'all' && ep.familySlug !== familyFilter) return false;
      if (!q) return true;
      return (
        ep.name.toLowerCase().includes(q) ||
        ep.seriesName.toLowerCase().includes(q) ||
        ep.number.toLowerCase().includes(q) ||
        ep.learningObjectives.some((lo) => lo.toLowerCase().includes(q))
      );
    });
  }, [familyFilter, episodeQuery]);

  const totalPages = Math.max(1, Math.ceil(filteredEpisodes.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  const pagedEpisodes = filteredEpisodes.slice(
    (currentPage - 1) * pageSize,
    currentPage * pageSize
  );

  return (
    <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
      {/* Section 1: Universal Episode Engine Hero */}
      <header className="border-b border-white/[0.08] pb-12">
        <div className="grid grid-cols-1 gap-8 lg:grid-cols-12 items-stretch">
          <div className="lg:col-span-7 flex flex-col justify-center">
            <p className="font-mono text-xs uppercase tracking-wider text-[#38BDF8]">
              The Universal Episode Engine
            </p>
            <h1 className="mt-2 font-display text-3xl font-bold text-white sm:text-5xl text-balance">
              One Engine. An Entire Ecosystem of Experiences.
            </h1>
            <p className="mt-4 max-w-3xl text-base text-slate-300 leading-relaxed">
              Rather than building thousands of isolated training scripts, ThinkNet standardizes on
              one reusable Environment Engine. Every environment family and episode shares the same
              registry, task generation, execution isolation, observation logging, evaluation, and
              training-data export infrastructure.
            </p>
            <div className="mt-5">
              <Link
                to="/data-generator"
                className="inline-flex items-center gap-2 rounded-md border border-[#3B82F6]/50 bg-[#3B82F6]/10 px-4 py-2 text-xs font-medium text-[#38BDF8] hover:bg-[#3B82F6]/20 hover:text-white"
              >
                <span>Synthesize Episode Training Data</span>
                <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </div>
          </div>
          <div className="lg:col-span-5 overflow-hidden rounded-lg border border-white/[0.08]">
            <ResearchImage
              src={visualAssets.families['agentic-generative'].src}
              alt={visualAssets.families['agentic-generative'].alt}
              caption="Universal Episode Engine · Registry, Task Generation & Trajectory Export"
              aspectClass="aspect-video lg:h-full"
            />
          </div>
        </div>

        {/* Interactive Hierarchy Explorer */}
        <div className="mt-10 rounded-lg border border-white/[0.08] bg-[#0B0E17] p-6">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
            <h2 className="font-display text-base font-semibold text-white">
              Standard Environment Hierarchy
            </h2>
            <span className="font-mono text-xs text-slate-400">
              Click any layer to inspect its engine contract
            </span>
          </div>

          <div className="grid grid-cols-1 gap-2 lg:grid-cols-5">
            {engineHierarchy.map((node, idx) => {
              const active = idx === selectedStep;
              return (
                <div key={node.step} className="flex items-stretch gap-2">
                  <button
                    type="button"
                    onClick={() => setSelectedStep(idx)}
                    className={`flex-1 rounded-md border p-4 text-left transition-colors ${
                      active
                        ? 'border-[#3B82F6] bg-[#3B82F6]/12'
                        : 'border-white/[0.08] bg-[#07090E] hover:border-white/20'
                    }`}
                  >
                    <span className="font-mono text-[11px] text-[#38BDF8]">
                      Layer {node.step}
                    </span>
                    <p className="mt-1 font-display text-sm font-bold text-white">
                      {node.name}
                    </p>
                    <p className="mt-1 text-xs text-slate-400 line-clamp-2">
                      {node.definition}
                    </p>
                  </button>
                  {idx < engineHierarchy.length - 1 && (
                    <div
                      aria-hidden="true"
                      className="hidden lg:flex items-center text-slate-600"
                    >
                      <ArrowRight className="h-4 w-4" />
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          <div className="mt-4 rounded border border-white/[0.06] bg-[#07090E] p-4 flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <span className="font-mono text-xs text-[#38BDF8]">
                {engineHierarchy[selectedStep].name}
              </span>
              <p className="text-sm text-slate-200 mt-0.5">
                {engineHierarchy[selectedStep].definition}{' '}
                <span className="text-slate-400">
                  {engineHierarchy[selectedStep].detail}
                </span>
              </p>
            </div>
            <span className="font-mono text-[11px] text-slate-500 whitespace-nowrap shrink-0">
              100s–1,000s of tasks / episode
            </span>
          </div>
        </div>
      </header>

      {/* Section 2: 15 Reusable Engine Components */}
      <section className="py-12 border-b border-white/[0.08]">
        <div className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h2 className="font-display text-2xl font-bold text-white">
              Fifteen Standard Episode Components
            </h2>
            <p className="mt-1 text-sm text-slate-400">
              Shared modular architecture powering every episode across all four environment families.
            </p>
          </div>
          <div className="flex flex-wrap gap-1 rounded-lg border border-white/[0.08] bg-[#0B0E17] p-1">
            {componentLayers.map((layer) => (
              <button
                key={layer}
                type="button"
                onClick={() => setLayerFilter(layer)}
                className={`rounded px-2.5 py-1 text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
                  layerFilter === layer
                    ? 'bg-[#3B82F6] text-white'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                {layer}
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {visibleComponents.map((comp) => (
            <div
              key={comp.id}
              className="rounded-lg border border-white/[0.08] bg-[#0B0E17] p-4 space-y-2"
            >
              <div className="flex items-center justify-between text-xs text-slate-400">
                <span className="font-mono text-[#38BDF8]">{comp.number}</span>
                <span className="font-mono text-[11px] text-slate-500">{comp.layer}</span>
              </div>
              <h3 className="font-display text-sm font-semibold text-white">
                {comp.name}
              </h3>
              <p className="text-xs text-slate-400 leading-relaxed">
                {comp.description}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* Section 3: Adaptive Episodes, Difficulty Levels & Environment Interconnection */}
      <section className="py-12 border-b border-white/[0.08] space-y-10">
        {/* Adaptive Episodes Loop */}
        <div className="rounded-lg border border-white/[0.08] bg-[#0B0E17] p-6">
          <div className="mb-5 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="font-display text-xl font-bold text-white">
                Adaptive Episodes &amp; Curriculum Learning
              </h2>
              <p className="text-xs text-slate-400 mt-1">
                Rather than relying exclusively on static task collections, the engine adapts dynamically to measured weaknesses.
              </p>
            </div>
            <span className="font-mono text-xs text-[#38BDF8]">7-Step Adaptive Cycle</span>
          </div>

          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-7">
            {adaptiveEpisodeLoop.map((item, idx) => (
              <button
                key={item.step}
                type="button"
                onClick={() => setSelectedAdaptiveStep(idx)}
                className={`rounded border p-3 text-left transition-colors ${
                  selectedAdaptiveStep === idx
                    ? 'border-[#38BDF8] bg-[#38BDF8]/10'
                    : 'border-white/[0.08] bg-[#07090E] hover:border-white/20'
                }`}
              >
                <span className="font-mono text-[11px] text-[#38BDF8]">{item.step}</span>
                <p className="mt-1 text-xs font-semibold text-white">{item.label}</p>
              </button>
            ))}
          </div>

          <p className="mt-4 text-sm text-slate-300">
            <span className="font-mono text-xs text-[#38BDF8] mr-2">
              Step {adaptiveEpisodeLoop[selectedAdaptiveStep].step}:
            </span>
            {adaptiveEpisodeLoop[selectedAdaptiveStep].detail}
          </p>
        </div>

        {/* Difficulty Levels & Environment Interconnection */}
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
          <div className="lg:col-span-7 rounded-lg border border-white/[0.08] bg-[#0B0E17] p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-display text-lg font-semibold text-white">
                Planned Difficulty Progression
              </h3>
              <span className="font-mono text-[11px] text-slate-400">
                Flexible Curriculum Tiers
              </span>
            </div>
            <div className="space-y-2.5">
              {standardDifficultyLevels.map((lvl) => (
                <div
                  key={lvl.id}
                  className="flex items-center justify-between rounded border border-white/[0.06] bg-[#07090E] px-4 py-2.5 text-sm"
                >
                  <div>
                    <span className="font-mono text-xs text-[#38BDF8] mr-3">
                      Level {lvl.level}
                    </span>
                    <span className="font-medium text-white">{lvl.name}</span>
                  </div>
                  <span className="text-xs text-slate-400 text-right ml-4">
                    {lvl.description}
                  </span>
                </div>
              ))}
            </div>
          </div>

          <div className="lg:col-span-5 rounded-lg border border-white/[0.08] bg-[#0B0E17] p-6 flex flex-col justify-between">
            <div className="space-y-3">
              <span className="font-mono text-xs text-[#38BDF8]">
                Environment Interconnection &amp; Training Integration
              </span>
              <h3 className="font-display text-lg font-semibold text-white">
                Multi-Environment Composition
              </h3>
              <p className="text-xs text-slate-300 leading-relaxed">
                Complex tasks combine multiple environments inside one assignment. For example,
                building an AI-powered robotics system spans eight distinct capability domains:
              </p>
              <div className="grid grid-cols-2 gap-2 pt-1">
                {roboticsInterconnectionDomains.map((dom) => (
                  <div
                    key={dom}
                    className="rounded border border-white/[0.06] bg-[#07090E] px-3 py-2 text-xs text-slate-200"
                  >
                    {dom}
                  </div>
                ))}
              </div>
            </div>

            <div className="mt-5 border-t border-white/[0.06] pt-4">
              <Link
                to="/research/training"
                className="inline-flex items-center gap-1.5 text-xs font-medium text-[#38BDF8] hover:text-white"
              >
                <span>See how validated trajectories integrate into model training</span>
                <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Section 4: Complete Paginated Episode Registry */}
      <section className="pt-12">
        <div className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h2 className="font-display text-2xl font-bold text-white">
              Complete Episode Registry ({filteredEpisodes.length})
            </h2>
            <p className="mt-1 text-xs text-slate-400">
              Every episode across ThinkNet is clickable and linked to a standardized detail specification.
            </p>
          </div>

          <div className="relative w-full lg:w-80">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
            <input
              type="text"
              value={episodeQuery}
              onChange={(e) => {
                setEpisodeQuery(e.target.value);
                setPage(1);
              }}
              placeholder="Search episode name or objective..."
              className="w-full rounded-md border border-white/[0.1] bg-[#0B0E17] py-2 pl-9 pr-3 text-sm text-white placeholder-slate-500 focus:border-[#3B82F6] focus:outline-none"
            />
          </div>
        </div>

        <div className="mb-6 flex flex-wrap gap-1.5 rounded-lg border border-white/[0.08] bg-[#0B0E17] p-1.5">
          <button
            type="button"
            onClick={() => {
              setFamilyFilter('all');
              setPage(1);
            }}
            className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
              familyFilter === 'all'
                ? 'bg-[#3B82F6] text-white'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            All ({allEpisodes.length})
          </button>
          {environmentFamilies.map((fam) => (
            <button
              key={fam.id}
              type="button"
              onClick={() => {
                setFamilyFilter(fam.slug);
                setPage(1);
              }}
              className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
                familyFilter === fam.slug
                  ? 'bg-[#3B82F6] text-white'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              {fam.number}. {fam.shortName}
            </button>
          ))}
        </div>

        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
          {pagedEpisodes.map((ep) => (
            <Link
              key={ep.id}
              to={`/episodes/${ep.slug}`}
              className="group flex flex-col justify-between rounded-lg border border-white/[0.08] bg-[#0B0E17] p-5 transition-colors hover:border-[#3B82F6]/60"
            >
              <div>
                <div className="flex items-center gap-2 text-xs text-slate-400">
                  <span className="font-mono text-[#38BDF8]">{ep.number}</span>
                  <span aria-hidden="true">·</span>
                  <span className="truncate">{ep.seriesName}</span>
                </div>
                <h3 className="mt-2 font-display text-base font-semibold text-white group-hover:text-[#38BDF8]">
                  {ep.name}
                </h3>
                <p className="mt-1.5 text-xs text-slate-400 line-clamp-2 leading-relaxed">
                  {ep.objective}
                </p>
              </div>
              <div className="mt-4 flex items-center justify-between border-t border-white/[0.06] pt-3 text-xs text-slate-500">
                <span className="font-mono tabular-nums">
                  {ep.learningObjectives.length} objectives
                </span>
                <span className="text-slate-300 group-hover:text-white">Open →</span>
              </div>
            </Link>
          ))}
        </div>

        {/* Pagination Controls */}
        {totalPages > 1 && (
          <div className="mt-8 flex items-center justify-between border-t border-white/[0.08] pt-6">
            <span className="font-mono text-xs text-slate-400 tabular-nums">
              Page {currentPage} of {totalPages}
            </span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                disabled={currentPage <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                className="rounded border border-white/[0.12] px-3 py-1.5 text-xs text-slate-200 disabled:opacity-40 hover:border-white/30"
              >
                Previous
              </button>
              <button
                type="button"
                disabled={currentPage >= totalPages}
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                className="rounded border border-white/[0.12] px-3 py-1.5 text-xs text-slate-200 disabled:opacity-40 hover:border-white/30"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}

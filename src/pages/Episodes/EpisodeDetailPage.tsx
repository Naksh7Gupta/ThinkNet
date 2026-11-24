import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, ArrowRight, Database } from 'lucide-react';
import { Breadcrumb } from '../../components/shared/Breadcrumb';
import { ResearchImage } from '../../components/shared/ResearchImage';
import { visualAssets } from '../../data/visualAssets';
import {
  getEpisodeById,
  getEpisodeBySlug,
  getFamilyBySlug,
  getSeriesById,
} from '../../data/environments';
import { standardDifficultyLevels } from '../../data/engine/universalEngine';

export function EpisodeDetailPage() {
  const { episodeSlug } = useParams<{ episodeSlug: string }>();
  const episode = getEpisodeBySlug(episodeSlug ?? '');
  const [selectedLevel, setSelectedLevel] = useState<number>(1);

  if (!episode) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-20 text-center">
        <h1 className="font-display text-2xl font-bold text-white">
          Episode Not Found
        </h1>
        <p className="mt-2 text-sm text-slate-400">
          The requested episode identifier is not in the ThinkNet registry.
        </p>
        <Link
          to="/episodes"
          className="mt-6 inline-flex items-center gap-2 rounded-md bg-[#3B82F6] px-4 py-2 text-sm font-medium text-white"
        >
          <ArrowLeft className="h-4 w-4" />
          <span>Back to Episodes Directory</span>
        </Link>
      </div>
    );
  }

  const family = getFamilyBySlug(episode.familySlug);
  const series = getSeriesById(episode.seriesId);
  const familyVisual = visualAssets.families[episode.familySlug];
  const relatedEpisodes = episode.relatedEpisodeIds
    .map((id) => getEpisodeById(id))
    .filter((e): e is NonNullable<typeof e> => Boolean(e));
  const relatedEnvironments = episode.relatedEnvironmentIds
    .map((id) => getSeriesById(id))
    .filter((s): s is NonNullable<typeof s> => Boolean(s));

  const activeTier =
    standardDifficultyLevels.find((d) => d.level === selectedLevel) ??
    standardDifficultyLevels[0];

  return (
    <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
      <Breadcrumb
        items={[
          { label: 'Home', to: '/' },
          { label: 'Environments', to: '/environments' },
          ...(family
            ? [{ label: family.shortName, to: `/environments/${family.slug}` }]
            : []),
          ...(series
            ? [{ label: series.name, to: `/environments/${episode.familySlug}#${series.slug}` }]
            : []),
          { label: episode.name },
        ]}
      />

      {/* Episode Identity Header */}
      <header className="border-b border-white/[0.08] pb-10 grid grid-cols-1 gap-8 lg:grid-cols-12 items-stretch">
        <div className="lg:col-span-8 flex flex-col justify-center">
          <div className="flex flex-wrap items-center gap-2 text-xs text-slate-400">
            <span className="font-mono text-[#38BDF8]">Episode {episode.number}</span>
            <span aria-hidden="true">·</span>
            <Link
              to={`/environments/${episode.familySlug}`}
              className="hover:text-white transition-colors"
            >
              {family?.name ?? episode.familySlug}
            </Link>
            <span aria-hidden="true">·</span>
            <span>{episode.seriesName}</span>
            {episode.parentSeriesName && (
              <>
                <span aria-hidden="true">·</span>
                <span>{episode.parentSeriesName}</span>
              </>
            )}
          </div>

          <h1 className="mt-3 font-display text-3xl font-bold text-white sm:text-4xl lg:text-5xl text-balance">
            {episode.name}
          </h1>

          <p className="mt-4 text-base text-slate-300 leading-relaxed">
            {episode.description}
          </p>

          <div className="mt-6 rounded-lg border border-white/[0.08] bg-[#0B0E17] p-5">
            <p className="font-mono text-[11px] uppercase tracking-wider text-[#38BDF8]">
              Episode Objective
            </p>
            <p className="mt-1.5 text-sm text-slate-200 leading-relaxed">
              {episode.objective}
            </p>
          </div>

          <div className="mt-5">
            <Link
              to={`/data-generator?episode=${episode.slug}`}
              className="inline-flex items-center gap-2 rounded-md border border-[#38BDF8]/40 bg-[#38BDF8]/10 px-4 py-2 text-xs font-medium text-white hover:bg-[#38BDF8]/20"
            >
              <Database className="h-3.5 w-3.5 text-[#38BDF8]" />
              <span>Generate Training Data for This Episode</span>
            </Link>
          </div>
        </div>

        <div className="lg:col-span-4 overflow-hidden rounded-lg border border-white/[0.08]">
          <ResearchImage
            src={familyVisual.src}
            alt={familyVisual.alt}
            caption={familyVisual.caption}
            aspectClass="aspect-[4/3] lg:h-full"
          />
        </div>
      </header>

      {/* Planned Difficulty Progression System */}
      <section className="py-10 border-b border-white/[0.08]">
        <div className="mb-5 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="font-display text-lg font-semibold text-white">
              Planned Difficulty Progression
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Standard ThinkNet curriculum progression structure. These represent planned difficulty levels, not completed training achievements.
            </p>
          </div>
          <span className="font-mono text-xs text-slate-400">
            5-Stage Curriculum Structure
          </span>
        </div>

        <div className="grid grid-cols-1 gap-2 sm:grid-cols-5">
          {standardDifficultyLevels.map((tier) => {
            const active = tier.level === selectedLevel;
            return (
              <button
                key={tier.id}
                type="button"
                onClick={() => setSelectedLevel(tier.level)}
                className={`rounded-md border p-4 text-left transition-colors ${
                  active
                    ? 'border-[#3B82F6] bg-[#3B82F6]/12'
                    : 'border-white/[0.08] bg-[#0B0E17] hover:border-white/20'
                }`}
              >
                <div className="flex items-center justify-between text-xs">
                  <span className="font-mono text-[#38BDF8]">
                    Level {tier.level}
                  </span>
                  <span className="font-mono text-[10px] text-slate-500">
                    Planned
                  </span>
                </div>
                <p className="mt-1.5 font-display text-sm font-semibold text-white">
                  {tier.name}
                </p>
                <p className="mt-1 text-xs text-slate-400 leading-relaxed">
                  {tier.description}
                </p>
              </button>
            );
          })}
        </div>

        <div className="mt-3 rounded border border-white/[0.06] bg-[#0B0E17] px-4 py-3 text-xs text-slate-300">
          <span className="font-mono text-[#38BDF8] mr-2">
            Level {activeTier.level} — {activeTier.name}:
          </span>
          {activeTier.description} Task specifications at this level are managed by the Universal Episode Engine Curriculum Manager.
        </div>
      </section>

      {/* Main Content Grid: Learning Objectives, Technical Capabilities, Competencies */}
      <section className="py-10 grid grid-cols-1 gap-8 lg:grid-cols-12 border-b border-white/[0.08]">
        {/* Learning Objectives */}
        <div className="lg:col-span-6 rounded-lg border border-white/[0.08] bg-[#0B0E17] p-6">
          <h2 className="font-display text-lg font-semibold text-white">
            Learning Objectives
          </h2>
          <p className="mt-1 text-xs text-slate-400">
            Targeted knowledge and operational behaviors defined for this episode.
          </p>
          <ul className="mt-5 space-y-2.5">
            {episode.learningObjectives.map((obj, i) => (
              <li
                key={obj}
                className="flex items-start gap-3 rounded border border-white/[0.05] bg-[#07090E] px-3.5 py-2.5 text-sm text-slate-200"
              >
                <span className="font-mono text-xs text-[#38BDF8] mt-0.5 tabular-nums">
                  {String(i + 1).padStart(2, '0')}
                </span>
                <span>{obj}</span>
              </li>
            ))}
          </ul>
        </div>

        {/* Technical Capabilities & Expected Competencies */}
        <div className="lg:col-span-6 space-y-6">
          <div className="rounded-lg border border-white/[0.08] bg-[#0B0E17] p-6">
            <h2 className="font-display text-lg font-semibold text-white">
              Technical Capabilities
            </h2>
            <p className="mt-1 text-xs text-slate-400">
              Engineering and reasoning primitives exercised inside the environment.
            </p>
            <ul className="mt-4 space-y-2">
              {episode.technicalCapabilities.map((cap) => (
                <li
                  key={cap}
                  className="flex items-start gap-2.5 text-sm text-slate-300"
                >
                  <span className="mt-2 h-1 w-1 rounded-full bg-[#38BDF8] shrink-0" />
                  <span>{cap}</span>
                </li>
              ))}
            </ul>
          </div>

          <div className="rounded-lg border border-white/[0.08] bg-[#0B0E17] p-6">
            <h2 className="font-display text-lg font-semibold text-white">
              Expected Competencies
            </h2>
            <p className="mt-1 text-xs text-slate-400">
              Measurable capabilities evaluated before trajectories qualify for training export.
            </p>
            <ul className="mt-4 space-y-2">
              {episode.expectedCompetencies.map((comp) => (
                <li
                  key={comp}
                  className="flex items-start gap-2.5 text-sm text-slate-300"
                >
                  <span className="mt-2 h-1 w-1 rounded-full bg-[#3B82F6] shrink-0" />
                  <span>{comp}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      {/* Special Sections / Final Challenge / Future Expansion */}
      <section className="py-10 space-y-6 border-b border-white/[0.08]">
        {/* Cross-Environment Challenge Steps */}
        {episode.crossEnvironmentSteps && (
          <div className="rounded-lg border border-[#3B82F6]/30 bg-[#0B0E17] p-6 space-y-4">
            <h2 className="font-display text-lg font-semibold text-white">
              Cross-Environment Execution Sequence
            </h2>
            {episode.crossEnvironmentResearchObjective && (
              <p className="text-sm text-[#38BDF8]">
                {episode.crossEnvironmentResearchObjective}
              </p>
            )}
            <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-4">
              {episode.crossEnvironmentSteps.map((step) => (
                <div
                  key={step}
                  className="rounded border border-white/[0.08] bg-[#07090E] px-3.5 py-3 text-xs text-slate-200"
                >
                  {step}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Simulated AI Company Roles */}
        {episode.simulatedCompanyRoles && (
          <div className="rounded-lg border border-[#3B82F6]/30 bg-[#0B0E17] p-6 space-y-4">
            <h2 className="font-display text-lg font-semibold text-white">
              Simulated Company Specialized Agent Structure
            </h2>
            <p className="text-sm text-slate-300">
              Agents must collaborate, delegate, review results, and deliver functioning products across six coordinated organizational roles:
            </p>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
              {episode.simulatedCompanyRoles.map((role) => (
                <div
                  key={role}
                  className="rounded border border-white/[0.08] bg-[#07090E] p-3 text-center text-xs font-medium text-white"
                >
                  {role}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Enterprise Audit Dimensions Example */}
        {episode.auditMetricsExample && (
          <div className="rounded-lg border border-white/[0.08] bg-[#0B0E17] p-6 space-y-4">
            <h2 className="font-display text-lg font-semibold text-white">
              Systematic Software Audit Research Direction
            </h2>
            <p className="text-sm text-slate-300 leading-relaxed">
              {episode.auditMetricsExample.note}
            </p>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {episode.auditMetricsExample.dimensions.map((dim) => (
                <div
                  key={dim}
                  className="rounded border border-white/[0.06] bg-[#07090E] px-3 py-2 text-xs text-slate-200"
                >
                  {dim}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Inspiration or Safety Notes */}
        {(episode.inspirationNote || episode.specialNotes) && (
          <div className="rounded-lg border border-white/[0.08] bg-[#0B0E17] p-5 space-y-2 text-xs text-slate-300">
            {episode.inspirationNote && <p>{episode.inspirationNote}</p>}
            {episode.specialNotes?.map((note) => (
              <p key={note}>{note}</p>
            ))}
          </div>
        )}

        {/* Final Challenge OR Future Expansion Placeholder */}
        <div className="rounded-lg border border-white/[0.08] bg-[#0B0E17] p-6">
          <div className="flex items-center justify-between">
            <h2 className="font-display text-lg font-semibold text-white">
              Final Challenge Specification
            </h2>
            <span className="font-mono text-xs text-slate-400">
              {episode.finalChallenge ? 'Defined in Source Context' : 'Placeholder for Future Expansion'}
            </span>
          </div>
          {episode.finalChallenge ? (
            <p className="mt-3 text-sm text-slate-200 leading-relaxed">
              {episode.finalChallenge}
            </p>
          ) : (
            <p className="mt-3 text-sm text-slate-400 leading-relaxed">
              No episode-specific final challenge prompt is defined in the master blueprint for{' '}
              <span className="text-slate-200">{episode.name}</span>. Benchmark tasks and capstone
              evaluation criteria will be populated here as the Episode Registry expands in Phase 2
              and Phase 4.
            </p>
          )}
        </div>
      </section>

      {/* Related Episodes & Related Environments */}
      <section className="pt-10 grid grid-cols-1 gap-8 lg:grid-cols-12">
        <div className="lg:col-span-8 space-y-4">
          <h2 className="font-display text-lg font-semibold text-white">
            Related Episodes
          </h2>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {relatedEpisodes.map((rel) => (
              <Link
                key={rel.id}
                to={`/episodes/${rel.slug}`}
                className="group rounded-lg border border-white/[0.08] bg-[#0B0E17] p-4 transition-colors hover:border-[#3B82F6]/60"
              >
                <div className="flex items-center justify-between text-xs text-slate-400">
                  <span className="font-mono text-[#38BDF8]">Episode {rel.number}</span>
                  <span>{rel.seriesName}</span>
                </div>
                <p className="mt-1.5 font-display text-sm font-semibold text-white group-hover:text-[#38BDF8]">
                  {rel.name}
                </p>
              </Link>
            ))}
          </div>
        </div>

        <div className="lg:col-span-4 space-y-4">
          <h2 className="font-display text-lg font-semibold text-white">
            Related Environments
          </h2>
          <div className="space-y-2.5">
            {relatedEnvironments.map((env) => (
              <Link
                key={env.id}
                to={`/environments/${env.familySlug}#${env.slug}`}
                className="flex items-center justify-between rounded-lg border border-white/[0.08] bg-[#0B0E17] p-4 text-sm text-white hover:border-[#3B82F6]/60"
              >
                <div>
                  <p className="font-medium">{env.name}</p>
                  <p className="text-xs text-slate-400 mt-0.5">{env.code}</p>
                </div>
                <ArrowRight className="h-4 w-4 text-slate-400" />
              </Link>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}

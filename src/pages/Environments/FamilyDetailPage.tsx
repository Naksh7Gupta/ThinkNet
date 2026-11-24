import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import { Breadcrumb } from '../../components/shared/Breadcrumb';
import { ResearchImage } from '../../components/shared/ResearchImage';
import { visualAssets } from '../../data/visualAssets';
import {
  environmentFamilies,
  getEpisodesBySeriesId,
  getFamilyBySlug,
  getFamilyStats,
  getSeriesByFamilySlug,
} from '../../data/environments';

export function FamilyDetailPage() {
  const { familySlug } = useParams<{ familySlug: string }>();
  const family = getFamilyBySlug(familySlug ?? '');
  const [selectedSeriesId, setSelectedSeriesId] = useState<string>('all');

  useEffect(() => {
    setSelectedSeriesId('all');
  }, [familySlug]);

  if (!family) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-20 text-center">
        <h1 className="font-display text-2xl font-bold text-white">
          Environment Family Not Found
        </h1>
        <p className="mt-2 text-sm text-slate-400">
          Select one of the four ThinkNet environment families to inspect its series and episodes.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-3">
          {environmentFamilies.map((f) => (
            <Link
              key={f.id}
              to={`/environments/${f.slug}`}
              className="rounded-md border border-white/[0.12] bg-[#0B0E17] px-4 py-2 text-sm text-white hover:border-[#3B82F6]"
            >
              {f.number}. {f.shortName}
            </Link>
          ))}
        </div>
      </div>
    );
  }

  const seriesList = getSeriesByFamilySlug(family.slug);
  const stats = getFamilyStats(family.slug);
  const visibleSeries =
    selectedSeriesId === 'all'
      ? seriesList
      : seriesList.filter((s) => s.id === selectedSeriesId);
  const familyVisual = visualAssets.families[family.slug];

  return (
    <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
      <Breadcrumb
        items={[
          { label: 'Home', to: '/' },
          { label: 'Environments', to: '/environments' },
          { label: `Family ${family.number}: ${family.name}` },
        ]}
      />

      {/* Family Hero Header */}
      <div className="border-b border-white/[0.08] pb-10">
        <div className="grid grid-cols-1 gap-8 lg:grid-cols-12 items-stretch">
          <div className="lg:col-span-7 flex flex-col justify-center">
            <div className="flex flex-wrap items-center gap-3 text-xs text-slate-400">
              <span className="font-mono text-[#38BDF8]">
                Environment Family {family.number}
              </span>
              <span aria-hidden="true">·</span>
              <span className="font-mono tabular-nums">
                {stats.seriesCount} {stats.seriesCount === 1 ? 'Series' : 'Series / Domains'}
              </span>
              <span aria-hidden="true">·</span>
              <span className="font-mono tabular-nums">{stats.episodeCount} Episodes</span>
            </div>

            <h1 className="mt-3 font-display text-3xl font-bold text-white sm:text-4xl text-balance">
              {family.name}
            </h1>
            <p className="mt-3 text-base text-slate-300 leading-relaxed">
              {family.description}
            </p>
            <div className="mt-5 rounded-md border border-white/[0.08] bg-[#0B0E17] p-4">
              <p className="text-xs font-mono uppercase tracking-wider text-slate-400">
                Family Objective
              </p>
              <p className="mt-1 text-sm text-slate-200">{family.objective}</p>
            </div>
          </div>

          <div className="lg:col-span-5 overflow-hidden rounded-lg border border-white/[0.08]">
            <ResearchImage
              src={familyVisual.src}
              alt={familyVisual.alt}
              caption={familyVisual.caption}
              aspectClass="aspect-[4/3] lg:h-full"
            />
          </div>
        </div>

        {/* Switch Between Families */}
        <div className="mt-8 flex flex-wrap gap-2">
          {environmentFamilies.map((fam) => (
            <Link
              key={fam.id}
              to={`/environments/${fam.slug}`}
              className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
                fam.slug === family.slug
                  ? 'bg-[#3B82F6] text-white'
                  : 'border border-white/[0.08] bg-[#0B0E17] text-slate-400 hover:text-white'
              }`}
            >
              {fam.number}. {fam.shortName}
            </Link>
          ))}
        </div>
      </div>

      {/* Series Filter Bar (if > 1 series) */}
      {seriesList.length > 1 && (
        <div className="mt-8 flex flex-wrap items-center gap-1.5 rounded-lg border border-white/[0.08] bg-[#0B0E17] p-1.5">
          <button
            type="button"
            onClick={() => setSelectedSeriesId('all')}
            className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
              selectedSeriesId === 'all'
                ? 'bg-[#3B82F6] text-white'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            All ({stats.episodeCount} episodes)
          </button>
          {seriesList.map((s) => (
            <button
              key={s.id}
              type="button"
              onClick={() => setSelectedSeriesId(s.id)}
              className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
                selectedSeriesId === s.id
                  ? 'bg-[#3B82F6] text-white'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              {s.code}: {s.name} ({s.episodeIds.length})
            </button>
          ))}
        </div>
      )}

      {/* Series & Episodes Sections */}
      <div className="mt-10 space-y-14">
        {visibleSeries.map((series) => {
          const episodes = getEpisodesBySeriesId(series.id);
          return (
            <section
              key={series.id}
              id={series.slug}
              className="scroll-mt-24 space-y-6 border-b border-white/[0.08] pb-12 last:border-b-0"
            >
              <div className="space-y-3">
                <div className="flex flex-wrap items-center gap-2 text-xs text-slate-400">
                  <span className="font-mono text-[#38BDF8]">{series.code}</span>
                  {series.parentSeriesName && (
                    <>
                      <span aria-hidden="true">·</span>
                      <span>{series.parentSeriesName}</span>
                    </>
                  )}
                  <span aria-hidden="true">·</span>
                  <span className="font-mono tabular-nums">{episodes.length} Episodes</span>
                </div>
                <h2 className="font-display text-2xl font-bold text-white">
                  {series.name}
                </h2>
                <p className="max-w-3xl text-sm text-slate-300 leading-relaxed">
                  {series.description}
                </p>
                {series.objective && (
                  <p className="max-w-3xl text-xs text-slate-400">
                    <span className="font-medium text-slate-200">Objective:</span>{' '}
                    {series.objective}
                  </p>
                )}
                {series.researchNote && (
                  <div className="max-w-3xl rounded-md border border-[#38BDF8]/30 bg-[#38BDF8]/5 p-4 text-xs text-slate-200 leading-relaxed">
                    <span className="font-mono text-[#38BDF8] uppercase mr-2">
                      Research Objective:
                    </span>
                    {series.researchNote}
                  </div>
                )}
              </div>

              {/* Episodes Grid */}
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                {episodes.map((ep) => (
                  <Link
                    key={ep.id}
                    to={`/episodes/${ep.slug}`}
                    className={`group flex flex-col justify-between rounded-lg border p-5 transition-colors ${
                      ep.isSpecialEpisode || ep.isCrossEnvironment
                        ? 'md:col-span-2 border-[#3B82F6]/40 bg-[#0D1322] hover:border-[#38BDF8]'
                        : 'border-white/[0.08] bg-[#0B0E17] hover:border-[#3B82F6]/60'
                    }`}
                  >
                    <div className="space-y-3">
                      <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-400">
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-[#38BDF8]">
                            Episode {ep.number}
                          </span>
                          {ep.parentSeriesName && (
                            <>
                              <span aria-hidden="true">·</span>
                              <span>{ep.parentSeriesName}</span>
                            </>
                          )}
                        </div>
                        <span className="font-mono text-[11px] text-slate-500 tabular-nums">
                          {ep.learningObjectives.length} objectives
                        </span>
                      </div>

                      <h3 className="font-display text-lg font-semibold text-white group-hover:text-[#38BDF8] transition-colors">
                        {ep.name}
                      </h3>

                      <p className="text-sm text-slate-300 leading-relaxed">
                        {ep.description}
                      </p>

                      {/* Show Learning Objectives */}
                      <div className="pt-2">
                        <p className="mb-1.5 font-mono text-[11px] uppercase tracking-wider text-slate-500">
                          Learning Objectives
                        </p>
                        <ul className="grid grid-cols-1 gap-1 sm:grid-cols-2 text-xs text-slate-300">
                          {ep.learningObjectives.map((lo) => (
                            <li key={lo} className="flex items-start gap-2">
                              <span className="mt-1.5 h-1 w-1 rounded-full bg-[#38BDF8] shrink-0" />
                              <span>{lo}</span>
                            </li>
                          ))}
                        </ul>
                      </div>

                      {ep.crossEnvironmentResearchObjective && (
                        <div className="rounded border border-white/[0.08] bg-[#07090E] p-3 text-xs text-slate-300">
                          <span className="font-mono text-[#38BDF8] block mb-1">
                            Cross-Environment Capability Transfer
                          </span>
                          {ep.crossEnvironmentResearchObjective}
                        </div>
                      )}

                      {ep.simulatedCompanyRoles && (
                        <div className="rounded border border-white/[0.08] bg-[#07090E] p-3 text-xs text-slate-300">
                          <span className="font-mono text-[#38BDF8] block mb-1.5">
                            Simulated Company Specialized Agents
                          </span>
                          <div className="flex flex-wrap gap-x-4 gap-y-1">
                            {ep.simulatedCompanyRoles.map((role) => (
                              <span key={role} className="text-slate-200">
                                · {role}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}

                      {ep.finalChallenge && (
                        <div className="rounded border border-white/[0.08] bg-[#07090E] p-3 text-xs text-slate-300">
                          <span className="font-mono text-slate-400 uppercase mr-2">
                            Challenge:
                          </span>
                          {ep.finalChallenge}
                        </div>
                      )}
                    </div>

                    <div className="mt-5 flex items-center justify-between border-t border-white/[0.06] pt-3 text-xs">
                      <span className="text-slate-400">
                        View full episode blueprint &amp; difficulty progression
                      </span>
                      <span className="inline-flex items-center gap-1 font-medium text-[#38BDF8] group-hover:translate-x-0.5 transition-transform">
                        Open Episode <ArrowRight className="h-3.5 w-3.5" />
                      </span>
                    </div>
                  </Link>
                ))}
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}

import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, Search } from 'lucide-react';
import { ResearchImage } from '../../components/shared/ResearchImage';
import { visualAssets } from '../../data/visualAssets';
import {
  allEpisodes,
  allSeries,
  environmentFamilies,
  getEpisodesByFamilySlug,
  getFamilyStats,
  getSeriesByFamilySlug,
} from '../../data/environments';
import { FamilySlug } from '../../types/thinknet';

export function EnvironmentsOverviewPage() {
  const [activeFamily, setActiveFamily] = useState<'all' | FamilySlug>('all');
  const [query, setQuery] = useState('');

  const filteredEpisodes = useMemo(() => {
    const q = query.trim().toLowerCase();
    return allEpisodes.filter((ep) => {
      if (activeFamily !== 'all' && ep.familySlug !== activeFamily) return false;
      if (!q) return true;
      return (
        ep.name.toLowerCase().includes(q) ||
        ep.seriesName.toLowerCase().includes(q) ||
        ep.description.toLowerCase().includes(q) ||
        ep.learningObjectives.some((lo) => lo.toLowerCase().includes(q))
      );
    });
  }, [activeFamily, query]);

  return (
    <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
      {/* Header */}
      <div className="border-b border-white/[0.08] pb-10">
        <p className="font-mono text-xs uppercase tracking-wider text-[#38BDF8]">
          The ThinkNet Environment Ecosystem
        </p>
        <h1 className="mt-2 font-display text-3xl font-bold text-white sm:text-4xl text-balance">
          Interactive Learning &amp; Capability Environments
        </h1>
        <p className="mt-3 max-w-3xl text-sm text-slate-300 sm:text-base leading-relaxed">
          Rather than relying solely on static text corpora, ThinkNet environments embed models
          inside real software, scientific workflows, simulations, hardware engineering, and
          multi-agent collaboration. Currently cataloging {environmentFamilies.length} families,{' '}
          {allSeries.length} series/domains, and {allEpisodes.length} structured episodes.
        </p>
      </div>

      {/* Four Families Grid */}
      <section className="py-12 border-b border-white/[0.08]">
        <div className="mb-6 flex items-center justify-between">
          <h2 className="font-display text-xl font-semibold text-white">
            Environment Families
          </h2>
          <span className="font-mono text-xs text-slate-400">
            Select a family for its dedicated specification page
          </span>
        </div>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          {environmentFamilies.map((fam) => {
            const stats = getFamilyStats(fam.slug);
            const seriesList = getSeriesByFamilySlug(fam.slug);
            const asset = visualAssets.families[fam.slug];
            return (
              <div
                key={fam.id}
                className="flex flex-col justify-between overflow-hidden rounded-lg border border-white/[0.08] bg-[#0B0E17]"
              >
                <div>
                  <div className="border-b border-white/[0.06]">
                    <ResearchImage
                      src={asset.src}
                      alt={asset.alt}
                      aspectClass="aspect-[16/9]"
                    />
                  </div>
                  <div className="p-6 space-y-4">
                    <div className="flex items-center justify-between text-xs text-slate-400">
                      <span className="font-mono text-[#38BDF8]">
                        Family {fam.number}
                      </span>
                      <span className="font-mono tabular-nums">
                        {stats.seriesCount} Series · {stats.episodeCount} Episodes
                      </span>
                    </div>
                    <h3 className="font-display text-2xl font-bold text-white">
                      {fam.name}
                    </h3>
                    <p className="text-sm text-slate-300 leading-relaxed">
                      {fam.objective}
                    </p>

                    <div className="space-y-1.5 border-t border-white/[0.06] pt-4">
                      <p className="font-mono text-[11px] uppercase tracking-wider text-slate-500">
                        Included Series &amp; Environments
                      </p>
                      <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-2">
                        {seriesList.map((s) => (
                          <Link
                            key={s.id}
                            to={`/environments/${fam.slug}#${s.slug}`}
                            className="flex items-center justify-between rounded border border-white/[0.06] bg-[#07090E] px-3 py-2 text-xs text-slate-300 hover:border-[#3B82F6]/50 hover:text-white"
                          >
                            <span className="truncate">{s.name}</span>
                            <span className="font-mono text-[11px] text-slate-500 ml-2 shrink-0 tabular-nums">
                              {s.episodeIds.length}
                            </span>
                          </Link>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>

                <div className="mx-6 mb-6 flex items-center justify-between border-t border-white/[0.06] pt-4">
                  <span className="text-xs text-slate-400">
                    {getEpisodesByFamilySlug(fam.slug).length} clickable episode pages
                  </span>
                  <Link
                    to={`/environments/${fam.slug}`}
                    className="inline-flex items-center gap-2 rounded-md bg-[#3B82F6] px-4 py-2 text-xs font-medium text-white hover:bg-[#2563EB] whitespace-nowrap shrink-0"
                  >
                    <span>Open Family {fam.number}</span>
                    <ArrowRight className="h-3.5 w-3.5" />
                  </Link>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* Interactive Episode Explorer */}
      <section className="pt-12">
        <div className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h2 className="font-display text-xl font-semibold text-white">
              Interactive Ecosystem Explorer
            </h2>
            <p className="text-xs text-slate-400 mt-1">
              Filter across all {allEpisodes.length} episodes by family or keyword. Click any episode to open its full specification.
            </p>
          </div>

          <div className="relative w-full lg:w-80">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Filter episodes or objectives..."
              className="w-full rounded-md border border-white/[0.1] bg-[#0B0E17] py-2 pl-9 pr-3 text-sm text-white placeholder-slate-500 focus:border-[#3B82F6] focus:outline-none"
            />
          </div>
        </div>

        {/* Family Filter Tabs */}
        <div className="mb-6 flex flex-wrap gap-1.5 rounded-lg border border-white/[0.08] bg-[#0B0E17] p-1.5">
          <button
            type="button"
            onClick={() => setActiveFamily('all')}
            className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
              activeFamily === 'all'
                ? 'bg-[#3B82F6] text-white'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            All Families ({allEpisodes.length})
          </button>
          {environmentFamilies.map((fam) => {
            const count = getEpisodesByFamilySlug(fam.slug).length;
            return (
              <button
                key={fam.id}
                type="button"
                onClick={() => setActiveFamily(fam.slug)}
                className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
                  activeFamily === fam.slug
                    ? 'bg-[#3B82F6] text-white'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                {fam.number}. {fam.shortName} ({count})
              </button>
            );
          })}
        </div>

        {/* Episode Results Grid */}
        {filteredEpisodes.length === 0 ? (
          <div className="rounded-lg border border-white/[0.08] bg-[#0B0E17] p-10 text-center">
            <p className="text-sm text-slate-300">No episodes match your current filter.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
            {filteredEpisodes.map((ep) => (
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
                  <h3 className="mt-2 font-display text-base font-semibold text-white group-hover:text-[#38BDF8] transition-colors">
                    {ep.name}
                  </h3>
                  <p className="mt-1.5 text-xs text-slate-400 line-clamp-2 leading-relaxed">
                    {ep.description}
                  </p>
                </div>

                <div className="mt-4 flex items-center justify-between border-t border-white/[0.06] pt-3 text-xs text-slate-500">
                  <span className="font-mono tabular-nums">
                    {ep.learningObjectives.length} learning objectives
                  </span>
                  <span className="text-slate-300 group-hover:text-white">Inspect →</span>
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

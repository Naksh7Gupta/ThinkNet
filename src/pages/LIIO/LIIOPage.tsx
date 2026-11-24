import { useMemo, useState } from 'react';
import { LIIOObservatoryConsole } from '../../components/visualizations/LIIOObservatoryConsole';
import { ResearchImage } from '../../components/shared/ResearchImage';
import { visualAssets } from '../../data/visualAssets';
import { liioCapabilities } from '../../data/research/liio';
import { LIIOCapability } from '../../types/thinknet';

const categories: Array<'All' | LIIOCapability['category']> = [
  'All',
  'Structural',
  'Attention & MLP',
  'Representational',
  'Experimental',
];

export function LIIOPage() {
  const [categoryFilter, setCategoryFilter] = useState<'All' | LIIOCapability['category']>('All');

  const visibleCapabilities = useMemo(() => {
    if (categoryFilter === 'All') return liioCapabilities;
    return liioCapabilities.filter((c) => c.category === categoryFilter);
  }, [categoryFilter]);

  return (
    <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
      {/* Header */}
      <header className="border-b border-white/[0.08] pb-10 grid grid-cols-1 gap-8 lg:grid-cols-12 items-stretch">
        <div className="lg:col-span-7 flex flex-col justify-center">
          <p className="font-mono text-xs uppercase tracking-wider text-[#38BDF8]">
            Interpretability &amp; Internal Analysis Platform
          </p>
          <h1 className="mt-2 font-display text-3xl font-bold text-white sm:text-4xl lg:text-5xl text-balance">
            LIIO — LLM Internal Intelligence Observatory
          </h1>
          <p className="mt-4 text-base text-slate-300 leading-relaxed">
            A research platform designed to inspect, measure, visualize and experimentally
            investigate the internal computational behaviour of pretrained LLMs. LIIO connects
            directly with ThinkNet&apos;s training infrastructure and evaluation system to understand
            why models produce particular outputs and whether architectural modifications yield
            measurable improvements.
          </p>
        </div>

        <div className="lg:col-span-5 overflow-hidden rounded-lg border border-white/[0.08]">
          <ResearchImage
            src={visualAssets.liioOptics.src}
            alt={visualAssets.liioOptics.alt}
            caption={visualAssets.liioOptics.caption}
            aspectClass="aspect-video lg:h-full"
          />
        </div>
      </header>

      {/* Interactive Scientific Instrument Console */}
      <section className="py-10 border-b border-white/[0.08]">
        <LIIOObservatoryConsole />
      </section>

      {/* All 10 Proposed Capabilities */}
      <section className="pt-12">
        <div className="mb-8 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h2 className="font-display text-2xl font-bold text-white">
              Ten Proposed Observatory Capabilities
            </h2>
            <p className="mt-1 text-sm text-slate-400">
              Analytical instruments for layer, head, neuron, activation, token, and architecture experimentation.
            </p>
          </div>

          <div className="flex flex-wrap gap-1 rounded-lg border border-white/[0.08] bg-[#0B0E17] p-1">
            {categories.map((cat) => (
              <button
                key={cat}
                type="button"
                onClick={() => setCategoryFilter(cat)}
                className={`rounded px-3 py-1.5 text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
                  categoryFilter === cat
                    ? 'bg-[#3B82F6] text-white'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {visibleCapabilities.map((cap) => (
            <article
              key={cap.id}
              id={cap.id}
              className="scroll-mt-24 rounded-lg border border-white/[0.08] bg-[#0B0E17] p-6 space-y-3"
            >
              <div className="flex items-center justify-between text-xs text-slate-400">
                <span className="font-mono text-[#38BDF8]">Capability {cap.number}</span>
                <span className="font-mono text-slate-500">{cap.category}</span>
              </div>
              <h3 className="font-display text-lg font-bold text-white">{cap.name}</h3>
              <p className="text-sm text-slate-300 leading-relaxed">{cap.description}</p>
              <div className="rounded border border-white/[0.06] bg-[#07090E] p-3 text-xs text-slate-400 leading-relaxed">
                <span className="font-mono text-slate-300 uppercase mr-2">Research Focus:</span>
                {cap.researchFocus}
              </div>
              <div className="flex flex-wrap items-center gap-2 pt-1 text-[11px] font-mono text-slate-500">
                <span>Integrations:</span>
                {cap.connectedSystems.map((sys, i) => (
                  <span key={sys} className="text-slate-300">
                    {i > 0 && '· '}
                    {sys}
                  </span>
                ))}
              </div>
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}

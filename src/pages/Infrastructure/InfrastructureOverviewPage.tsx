import { Link } from 'react-router-dom';
import { ArrowRight, Database } from 'lucide-react';
import { InfrastructureFlowGraph } from '../../components/visualizations/InfrastructureFlowGraph';
import { ResearchImage } from '../../components/shared/ResearchImage';
import { visualAssets } from '../../data/visualAssets';
import { researchDivisions } from '../../data/infrastructure/divisions';

export function InfrastructureOverviewPage() {
  return (
    <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
      <header className="border-b border-white/[0.08] pb-10 grid grid-cols-1 gap-8 lg:grid-cols-12 items-stretch">
        <div className="lg:col-span-7 flex flex-col justify-center">
          <p className="font-mono text-xs uppercase tracking-wider text-[#38BDF8]">
            Core Technical Architecture
          </p>
          <h1 className="mt-2 font-display text-3xl font-bold text-white sm:text-4xl text-balance">
            ThinkNet Research &amp; Engineering Infrastructure
          </h1>
          <p className="mt-3 text-sm text-slate-300 sm:text-base leading-relaxed">
            ThinkNet is organized into eight interconnected technical divisions covering experiment
            management, GPU kernels, distributed training, dataset curation, distillation, model
            architecture, capability evaluation, and efficient inference serving.
          </p>
          <div className="mt-5">
            <Link
              to="/data-generator"
              className="inline-flex items-center gap-2 rounded-md border border-[#38BDF8]/40 bg-[#38BDF8]/10 px-4 py-2 text-xs font-medium text-white hover:bg-[#38BDF8]/20"
            >
              <Database className="h-3.5 w-3.5 text-[#38BDF8]" />
              <span>Open ThinkNet Data Generator (Division 04)</span>
            </Link>
          </div>
        </div>

        <div className="lg:col-span-5 overflow-hidden rounded-lg border border-white/[0.08]">
          <ResearchImage
            src={visualAssets.families['low-level-engineering'].src}
            alt={visualAssets.families['low-level-engineering'].alt}
            caption="Compute, Kernel & Execution Infrastructure"
            aspectClass="aspect-[4/3] lg:h-full"
          />
        </div>
      </header>

      {/* Interactive Division Connectivity Graph */}
      <section className="py-10 border-b border-white/[0.08]">
        <InfrastructureFlowGraph />
      </section>

      {/* Complete Grid of 8 Divisions with Every Listed Feature */}
      <section className="pt-12">
        <div className="mb-8">
          <h2 className="font-display text-2xl font-bold text-white">
            All Eight Infrastructure Divisions
          </h2>
          <p className="mt-1 text-sm text-slate-400">
            Select any division to open its dedicated architecture specification, connected systems, and responsible agents.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
          {researchDivisions.map((div) => (
            <div
              key={div.id}
              className="flex flex-col justify-between rounded-lg border border-white/[0.08] bg-[#0B0E17] p-6"
            >
              <div className="space-y-4">
                <div className="flex items-center justify-between text-xs text-slate-400">
                  <span className="font-mono text-[#38BDF8]">Division {div.number}</span>
                  <span className="font-mono tabular-nums">{div.features.length} tools</span>
                </div>
                <h3 className="font-display text-xl font-bold text-white">{div.name}</h3>
                <p className="text-sm text-slate-300 leading-relaxed">{div.description}</p>

                <div className="pt-2">
                  <p className="mb-2 font-mono text-[11px] uppercase tracking-wider text-slate-500">
                    Division Capabilities &amp; Tools
                  </p>
                  <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-2">
                    {div.features.map((feat) => (
                      <div
                        key={feat}
                        className="rounded border border-white/[0.05] bg-[#07090E] px-3 py-1.5 text-xs text-slate-300"
                      >
                        {feat}
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <div className="mt-6 border-t border-white/[0.06] pt-4 flex justify-end">
                <Link
                  to={`/infrastructure/${div.slug}`}
                  className="inline-flex items-center gap-2 rounded-md border border-white/[0.12] bg-[#07090E] px-4 py-2 text-xs font-medium text-white hover:border-[#3B82F6] hover:bg-[#3B82F6]/10"
                >
                  <span>Inspect Division {div.number}</span>
                  <ArrowRight className="h-3.5 w-3.5" />
                </Link>
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

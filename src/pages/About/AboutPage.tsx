import { Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import { ResearchImage } from '../../components/shared/ResearchImage';
import { visualAssets } from '../../data/visualAssets';
import { environmentFamilies, getFamilyStats } from '../../data/environments';
import { researchDivisions } from '../../data/infrastructure/divisions';

const targetCapabilities = [
  'Strong reasoning',
  'Scientific understanding',
  'Advanced coding',
  'Deep research capabilities',
  'Natural communication',
  'Long-context intelligence',
  'Multimodal intelligence',
  'Spatial understanding',
  'Software engineering',
  'Tool-use capabilities',
  'Autonomous workflows',
  'Efficient computational execution',
];

const underlyingTechnologies = [
  'Model architectures',
  'Training methods',
  'Data quality',
  'Distillation',
  'Inference',
  'GPU kernels',
  'Memory efficiency',
  'Distributed computing',
];

export function AboutPage() {
  return (
    <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
      {/* Header */}
      <header className="border-b border-white/[0.08] pb-12 grid grid-cols-1 gap-8 lg:grid-cols-12 items-stretch">
        <div className="lg:col-span-7 flex flex-col justify-center">
          <p className="font-mono text-xs uppercase tracking-wider text-[#38BDF8]">
            About ThinkNet
          </p>
          <h1 className="mt-2 font-display text-3xl font-bold text-white sm:text-5xl text-balance">
            Researching Intelligence. Engineering the Future.
          </h1>
          <p className="mt-5 text-base text-slate-300 leading-relaxed">
            ThinkNet is an AI research and engineering organization focused on understanding,
            developing, improving, and advancing artificial intelligence—particularly Large Language
            Models (LLMs). Our ambition is not simply to build another chatbot or model-training
            interface, but to establish an integrated research and engineering ecosystem.
          </p>
        </div>
        <div className="lg:col-span-5 overflow-hidden rounded-lg border border-white/[0.08]">
          <ResearchImage
            src={visualAssets.heroLab.src}
            alt={visualAssets.heroLab.alt}
            caption={visualAssets.heroLab.caption}
            aspectClass="aspect-video lg:h-full"
          />
        </div>
      </header>

      {/* Why ThinkNet Exists & Core Philosophy */}
      <section className="py-12 border-b border-white/[0.08] grid grid-cols-1 gap-10 lg:grid-cols-12">
        <div className="lg:col-span-6 space-y-4">
          <h2 className="font-display text-2xl font-bold text-white">
            Why ThinkNet Exists
          </h2>
          <p className="text-sm text-slate-300 leading-relaxed">
            Traditional AI training frequently relies on static datasets. While pretraining data
            provides broad informational coverage, true operational capability requires environments
            where models can act, inspect real software, test hypotheses, manipulate 3D and physical
            representations, optimize GPU kernels, receive objective verification, and improve from
            validated experience.
          </p>
        </div>

        <div className="lg:col-span-6 rounded-lg border border-white/[0.08] bg-[#0B0E17] p-6 space-y-3">
          <p className="font-mono text-xs uppercase tracking-wider text-[#38BDF8]">
            Core Philosophy
          </p>
          <p className="font-display text-xl font-semibold text-white leading-snug">
            &ldquo;Don&apos;t just train models on information. Give them environments in which they
            can develop capabilities.&rdquo;
          </p>
          <p className="text-sm text-slate-400 leading-relaxed">
            We want models to develop capabilities through both information and experience—bridging
            data engineering, interactive episodes, verifiable rewards, and interpretability.
          </p>
        </div>
      </section>

      {/* Major Research Divisions & Environment Ecosystem */}
      <section className="py-12 border-b border-white/[0.08] grid grid-cols-1 gap-10 lg:grid-cols-12">
        <div className="lg:col-span-6 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="font-display text-xl font-bold text-white">
              Eight Research Divisions
            </h2>
            <Link to="/infrastructure" className="text-xs text-[#38BDF8] hover:text-white">
              View Topology →
            </Link>
          </div>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {researchDivisions.map((div) => (
              <Link
                key={div.id}
                to={`/infrastructure/${div.slug}`}
                className="rounded border border-white/[0.08] bg-[#0B0E17] px-3.5 py-2.5 text-sm text-slate-200 hover:border-[#3B82F6]"
              >
                <span className="font-mono text-xs text-[#38BDF8] mr-2">{div.number}</span>
                {div.name}
              </Link>
            ))}
          </div>
        </div>

        <div className="lg:col-span-6 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="font-display text-xl font-bold text-white">
              Four Environment Families
            </h2>
            <Link to="/environments" className="text-xs text-[#38BDF8] hover:text-white">
              Explore All →
            </Link>
          </div>
          <div className="space-y-2">
            {environmentFamilies.map((fam) => {
              const stats = getFamilyStats(fam.slug);
              return (
                <Link
                  key={fam.id}
                  to={`/environments/${fam.slug}`}
                  className="flex items-center justify-between rounded border border-white/[0.08] bg-[#0B0E17] px-4 py-3 text-sm text-slate-200 hover:border-[#3B82F6]"
                >
                  <span>
                    <span className="font-mono text-xs text-[#38BDF8] mr-2">
                      {fam.number}
                    </span>
                    {fam.name}
                  </span>
                  <span className="font-mono text-xs text-slate-400 tabular-nums">
                    {stats.episodeCount} episodes
                  </span>
                </Link>
              );
            })}
          </div>
        </div>
      </section>

      {/* Long-Term Ambition */}
      <section className="py-12 border-b border-white/[0.08] grid grid-cols-1 gap-8 lg:grid-cols-12">
        <div className="lg:col-span-7 rounded-lg border border-white/[0.08] bg-[#0B0E17] p-6 space-y-4">
          <h2 className="font-display text-xl font-bold text-white">
            Capabilities Investigated for Foundation Models
          </h2>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {targetCapabilities.map((cap) => (
              <div
                key={cap}
                className="rounded border border-white/[0.06] bg-[#07090E] px-3 py-2 text-xs text-slate-200"
              >
                {cap}
              </div>
            ))}
          </div>
        </div>

        <div className="lg:col-span-5 rounded-lg border border-white/[0.08] bg-[#0B0E17] p-6 space-y-4">
          <h2 className="font-display text-xl font-bold text-white">
            Underlying Technology Advances
          </h2>
          <div className="grid grid-cols-2 gap-2">
            {underlyingTechnologies.map((tech) => (
              <div
                key={tech}
                className="rounded border border-white/[0.06] bg-[#07090E] px-3 py-2 text-xs text-slate-200"
              >
                {tech}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Concluding Statement */}
      <section className="pt-14 pb-6 text-center space-y-5">
        <p className="mx-auto max-w-3xl font-display text-2xl font-semibold text-white sm:text-3xl text-balance">
          &ldquo;Intelligence should be developed through knowledge, computation, interaction,
          experimentation and experience.&rdquo;
        </p>
        <div className="pt-4 space-y-1">
          <p className="font-display text-sm font-bold tracking-[0.2em] text-[#38BDF8]">
            THINKNET
          </p>
          <p className="text-sm text-slate-300">
            Researching Intelligence. Engineering the Future.
          </p>
        </div>
        <div className="pt-4">
          <Link
            to="/environments"
            className="inline-flex items-center gap-2 rounded-md bg-[#3B82F6] px-5 py-2.5 text-sm font-medium text-white hover:bg-[#2563EB]"
          >
            <span>Explore the Environment Ecosystem</span>
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </section>
    </div>
  );
}

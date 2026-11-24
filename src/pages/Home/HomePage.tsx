import { Link } from 'react-router-dom';
import { ArrowRight, ChevronRight } from 'lucide-react';
import { HeroEcosystemCanvas } from '../../components/visualizations/HeroEcosystemCanvas';
import { ResearchImage } from '../../components/shared/ResearchImage';
import { visualAssets } from '../../data/visualAssets';
import {
  allEpisodes,
  allSeries,
  environmentFamilies,
  getFamilyStats,
} from '../../data/environments';
import { researchDivisions } from '../../data/infrastructure/divisions';
import { specializedAgents } from '../../data/agents/researchAgents';
import { liioCapabilities } from '../../data/research/liio';
import { researchQuestions } from '../../data/research/register';

const philosophyPillars = [
  'High-quality pretraining data',
  'Synthetic data generation',
  'Interactive environments',
  'Structured episodes',
  'Realistic task execution',
  'AI-agent-assisted training',
  'Automated evaluation',
  'Feedback-driven learning',
  'Distillation and post-training',
  'Computational optimization',
];

export function HomePage() {
  return (
    <div>
      {/* 1. Hero Section */}
      <section className="relative overflow-hidden border-b border-white/[0.08] bg-[#07090E] bg-lab-grid">
        <HeroEcosystemCanvas />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 bg-gradient-to-r from-[#07090E] via-[#07090E]/88 to-[#07090E]/55"
        />

        <div className="relative mx-auto max-w-7xl px-4 py-16 sm:px-6 sm:py-24 lg:px-8 lg:py-28">
          <div className="grid grid-cols-1 gap-10 lg:grid-cols-12 items-stretch">
            <div className="lg:col-span-7 flex flex-col justify-center space-y-6">
              <p className="font-mono text-xs uppercase tracking-[0.16em] text-[#38BDF8]">
                AI Research &amp; Engineering Ecosystem
              </p>
              <h1 className="font-display text-4xl font-bold tracking-tight text-white sm:text-5xl lg:text-6xl text-balance leading-[1.08]">
                Researching Intelligence.
                <br />
                Engineering the Future.
              </h1>
              <p className="max-w-2xl text-base text-slate-300 sm:text-lg leading-relaxed">
                An integrated AI research and engineering ecosystem exploring how intelligent
                systems learn, reason, interact, experiment and evolve.
              </p>

              <div className="flex flex-wrap items-center gap-4 pt-2">
                <Link
                  to="/environments"
                  className="inline-flex items-center gap-2 rounded-md bg-[#3B82F6] px-5 py-3 text-sm font-medium text-white transition-colors duration-150 hover:bg-[#2563EB] whitespace-nowrap"
                >
                  <span>Explore the Ecosystem</span>
                  <ArrowRight className="h-4 w-4" />
                </Link>
                <Link
                  to="/research"
                  className="inline-flex items-center gap-2 rounded-md border border-white/[0.14] bg-[#0D111A]/80 px-5 py-3 text-sm font-medium text-slate-200 transition-colors duration-150 hover:border-white/30 hover:text-white whitespace-nowrap"
                >
                  <span>Our Research</span>
                </Link>
              </div>
            </div>

            <div className="lg:col-span-5 overflow-hidden rounded-lg border border-white/[0.1]">
              <ResearchImage
                src={visualAssets.heroLab.src}
                alt={visualAssets.heroLab.alt}
                caption={visualAssets.heroLab.caption}
                aspectClass="aspect-video lg:h-full"
              />
            </div>
          </div>

          {/* Grounded Ecosystem Registry Totals Strip (dynamically calculated) */}
          <div className="mt-14 grid grid-cols-2 gap-px overflow-hidden rounded-lg border border-white/[0.08] bg-white/[0.08] sm:grid-cols-3 lg:grid-cols-6">
            {[
              { label: 'Environment Families', value: environmentFamilies.length, to: '/environments' },
              { label: 'Series & Environments', value: allSeries.length, to: '/environments' },
              { label: 'Structured Episodes', value: allEpisodes.length, to: '/episodes' },
              { label: 'Technical Divisions', value: researchDivisions.length, to: '/infrastructure' },
              { label: 'Research Agents', value: specializedAgents.length, to: '/agentic-ai' },
              { label: 'Open Questions', value: researchQuestions.length, to: '/research/register' },
            ].map((stat) => (
              <Link
                key={stat.label}
                to={stat.to}
                className="bg-[#0B0E17]/95 p-4 transition-colors hover:bg-[#111622]"
              >
                <p className="font-mono text-2xl font-semibold text-white tabular-nums">
                  {stat.value}
                </p>
                <p className="mt-1 text-xs text-slate-400">{stat.label}</p>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* 2. Philosophy Section */}
      <section className="border-b border-white/[0.08] bg-[#0B0E17]">
        <div className="mx-auto max-w-7xl px-4 py-20 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 gap-12 lg:grid-cols-12">
            <div className="lg:col-span-5 space-y-5">
              <p className="font-mono text-xs uppercase tracking-wider text-slate-400">
                Core Research Philosophy
              </p>
              <h2 className="font-display text-3xl font-bold text-white sm:text-4xl text-balance">
                Intelligence is more than information.
              </h2>
              <p className="text-base font-medium text-[#38BDF8] leading-relaxed">
                Don&apos;t just train models on information. Give them environments in which they
                can develop capabilities.
              </p>
              <p className="text-sm text-slate-300 leading-relaxed">
                Traditional model training frequently relies on static datasets. ThinkNet
                investigates how models develop durable intelligence when knowledge,
                computation, interaction, experimentation, and experience operate together inside
                verifiable engineering and scientific environments.
              </p>
              <div className="pt-2">
                <Link
                  to="/data-generator"
                  className="inline-flex items-center gap-2 rounded-md border border-[#38BDF8]/40 bg-[#38BDF8]/10 px-4 py-2 text-xs font-medium text-white hover:bg-[#38BDF8]/20"
                >
                  <span>Launch ThinkNet Data Generator</span>
                  <ArrowRight className="h-3.5 w-3.5" />
                </Link>
              </div>
            </div>

            <div className="lg:col-span-7">
              <div className="rounded-lg border border-white/[0.08] bg-[#07090E] p-6">
                <h3 className="mb-4 font-display text-sm font-semibold text-white">
                  Ten Interconnected Components of Capability Development
                </h3>
                <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
                  {philosophyPillars.map((pillar, idx) => (
                    <div
                      key={pillar}
                      className="flex items-center gap-3 rounded border border-white/[0.06] bg-[#0D111A] px-3.5 py-2.5 text-sm text-slate-200"
                    >
                      <span className="font-mono text-xs text-[#38BDF8] tabular-nums">
                        {String(idx + 1).padStart(2, '0')}
                      </span>
                      <span>{pillar}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 3. Ecosystem Overview: 4 Major Environment Families */}
      <section className="border-b border-white/[0.08] bg-[#07090E]">
        <div className="mx-auto max-w-7xl px-4 py-20 sm:px-6 lg:px-8">
          <div className="mb-12 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div className="space-y-2 max-w-2xl">
              <p className="font-mono text-xs uppercase tracking-wider text-slate-400">
                The Environment Ecosystem
              </p>
              <h2 className="font-display text-3xl font-bold text-white sm:text-4xl">
                Four Environment Families
              </h2>
              <p className="text-sm text-slate-400 leading-relaxed">
                Every family operates on the shared Universal Episode Engine, progressing from
                intellectual research and real-world multimodal systems to GPU kernels and
                autonomous agents.
              </p>
            </div>
            <Link
              to="/episodes"
              className="inline-flex items-center gap-1.5 text-sm font-medium text-[#38BDF8] hover:text-white whitespace-nowrap shrink-0"
            >
              <span>Universal Episode Engine</span>
              <ChevronRight className="h-4 w-4" />
            </Link>
          </div>

          <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
            {environmentFamilies.map((fam) => {
              const stats = getFamilyStats(fam.slug);
              const asset = visualAssets.families[fam.slug];
              return (
                <div
                  key={fam.id}
                  className="flex flex-col justify-between overflow-hidden rounded-lg border border-white/[0.08] bg-[#0B0E17] transition-colors hover:border-white/20"
                >
                  <div>
                    <div className="border-b border-white/[0.06]">
                      <ResearchImage
                        src={asset.src}
                        alt={asset.alt}
                        aspectClass="aspect-[16/9]"
                      />
                    </div>
                    <div className="p-6 space-y-3">
                      <div className="flex items-center justify-between text-xs text-slate-400">
                        <span className="font-mono text-[#38BDF8]">
                          Environment Family {fam.number}
                        </span>
                        <span className="font-mono tabular-nums">
                          {stats.seriesCount} {stats.seriesCount === 1 ? 'Series' : 'Series / Domains'} · {stats.episodeCount} Episodes
                        </span>
                      </div>
                      <h3 className="font-display text-xl font-semibold text-white">
                        {fam.name}
                      </h3>
                      <p className="text-sm text-slate-300 leading-relaxed">
                        {fam.description}
                      </p>
                    </div>
                  </div>

                  <div className="mx-6 mb-6 flex items-center justify-between border-t border-white/[0.06] pt-4">
                    <span className="text-xs text-slate-400 truncate max-w-[65%]">
                      {fam.tagline}
                    </span>
                    <Link
                      to={`/environments/${fam.slug}`}
                      className="inline-flex items-center gap-1.5 rounded border border-white/[0.12] bg-[#0D111A] px-3.5 py-1.5 text-xs font-medium text-white transition-colors hover:border-[#3B82F6] hover:bg-[#3B82F6]/10 whitespace-nowrap shrink-0"
                    >
                      <span>Explore</span>
                      <ArrowRight className="h-3.5 w-3.5" />
                    </Link>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* 4. Research Infrastructure (8 Divisions) */}
      <section className="border-b border-white/[0.08] bg-[#0B0E17]">
        <div className="mx-auto max-w-7xl px-4 py-20 sm:px-6 lg:px-8">
          <div className="mb-12 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div className="space-y-2 max-w-2xl">
              <p className="font-mono text-xs uppercase tracking-wider text-slate-400">
                Core Technical Architecture
              </p>
              <h2 className="font-display text-3xl font-bold text-white sm:text-4xl">
                Research Infrastructure
              </h2>
              <p className="text-sm text-slate-400 leading-relaxed">
                Eight interconnected technical divisions spanning experiment management, custom
                GPU kernels, pretraining, data curation, distillation, architecture design,
                evaluation, and inference serving.
              </p>
            </div>
            <Link
              to="/infrastructure"
              className="inline-flex items-center gap-1.5 text-sm font-medium text-[#38BDF8] hover:text-white whitespace-nowrap shrink-0"
            >
              <span>Inspect System Topology</span>
              <ChevronRight className="h-4 w-4" />
            </Link>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {researchDivisions.map((div) => (
              <Link
                key={div.id}
                to={`/infrastructure/${div.slug}`}
                className="group rounded-lg border border-white/[0.08] bg-[#07090E] p-5 transition-colors hover:border-[#3B82F6]/60"
              >
                <div className="flex items-center justify-between text-xs text-slate-500">
                  <span className="font-mono text-[#38BDF8]">{div.number}</span>
                  <span className="font-mono tabular-nums">{div.features.length} tools</span>
                </div>
                <h3 className="mt-2.5 font-display text-base font-semibold text-white group-hover:text-[#38BDF8] transition-colors">
                  {div.name}
                </h3>
                <p className="mt-2 text-xs text-slate-400 leading-relaxed">
                  {div.summary}
                </p>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* 5. Agentic Research & LIIO Asymmetric Split */}
      <section className="border-b border-white/[0.08] bg-[#07090E]">
        <div className="mx-auto max-w-7xl px-4 py-20 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 gap-8 lg:grid-cols-12 items-stretch">
            {/* Agentic Research Card */}
            <div className="lg:col-span-7 flex flex-col justify-between rounded-lg border border-white/[0.08] bg-[#0B0E17] p-7">
              <div className="space-y-4">
                <div className="flex items-center justify-between text-xs text-slate-400">
                  <span className="font-mono text-[#38BDF8]">
                    Agentic Research &amp; Training System
                  </span>
                  <span className="font-mono tabular-nums">
                    {specializedAgents.length} Specialized Agents · 3 Autonomy Levels
                  </span>
                </div>
                <h2 className="font-display text-2xl font-bold text-white sm:text-3xl">
                  Specialized Research Agents
                </h2>
                <p className="text-sm text-slate-300 leading-relaxed">
                  AI agents participate across the entire training lifecycle—observing runs,
                  inspecting gradients, curating synthetic curricula, benchmarking kernels, and
                  proposing bounded experiments under human oversight.
                </p>

                <div className="grid grid-cols-1 gap-2.5 pt-2 sm:grid-cols-2">
                  {specializedAgents.map((agent) => (
                    <div
                      key={agent.id}
                      className="rounded border border-white/[0.06] bg-[#07090E] px-3.5 py-2.5"
                    >
                      <p className="text-xs font-semibold text-white">
                        {agent.code}. {agent.name}
                      </p>
                      <p className="mt-0.5 text-[11px] text-slate-400 truncate">
                        {agent.primaryDomain}
                      </p>
                    </div>
                  ))}
                </div>
              </div>

              <div className="mt-6 pt-5 border-t border-white/[0.06]">
                <Link
                  to="/agentic-ai"
                  className="inline-flex items-center gap-2 text-sm font-medium text-[#38BDF8] hover:text-white"
                >
                  <span>Explore Agentic Research Network</span>
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </div>
            </div>

            {/* LIIO Observatory Card */}
            <div className="lg:col-span-5 flex flex-col justify-between overflow-hidden rounded-lg border border-white/[0.08] bg-[#0B0E17]">
              <div>
                <div className="border-b border-white/[0.06]">
                  <ResearchImage
                    src={visualAssets.liioOptics.src}
                    alt={visualAssets.liioOptics.alt}
                    aspectClass="aspect-video"
                  />
                </div>
                <div className="p-6 space-y-4">
                  <div className="flex items-center justify-between text-xs text-slate-400">
                    <span className="font-mono text-[#38BDF8]">Interpretability</span>
                    <span className="font-mono tabular-nums">
                      {liioCapabilities.length} Analytical Instruments
                    </span>
                  </div>
                  <h2 className="font-display text-2xl font-bold text-white">
                    LIIO — LLM Internal Intelligence Observatory
                  </h2>
                  <p className="text-sm text-slate-300 leading-relaxed">
                    A research platform designed to inspect, measure, visualize and experimentally
                    investigate the internal computational behaviour of pretrained LLMs.
                  </p>

                  <ul className="space-y-2 pt-1 text-xs text-slate-300">
                    {liioCapabilities.slice(0, 4).map((cap) => (
                      <li
                        key={cap.id}
                        className="flex items-center justify-between border-b border-white/[0.05] pb-1.5"
                      >
                        <span>
                          <span className="font-mono text-slate-500 mr-2">{cap.number}</span>
                          {cap.name}
                        </span>
                        <span className="font-mono text-[11px] text-slate-500">
                          {cap.category}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>

              <div className="mx-6 mb-6 pt-4 border-t border-white/[0.06]">
                <Link
                  to="/liio"
                  className="inline-flex items-center gap-2 text-sm font-medium text-[#38BDF8] hover:text-white"
                >
                  <span>Open LIIO Observatory</span>
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 6. Closing Section */}
      <section className="bg-[#0B0E17]">
        <div className="mx-auto max-w-5xl px-4 py-20 text-center sm:px-6 lg:px-8">
          <h2 className="font-display text-3xl font-bold text-white sm:text-4xl text-balance">
            Building the infrastructure for the next generation of intelligence.
          </h2>
          <p className="mx-auto mt-4 max-w-2xl text-sm text-slate-400 leading-relaxed">
            Explore the complete ThinkNet architecture—from 86 structured training episodes and
            the Universal Episode Engine to low-level GPU kernel optimization and open research
            hypotheses.
          </p>
          <div className="mt-8 flex flex-wrap justify-center gap-4">
            <Link
              to="/environments"
              className="inline-flex items-center gap-2 rounded-md bg-[#3B82F6] px-6 py-3 text-sm font-medium text-white transition-colors hover:bg-[#2563EB]"
            >
              <span>Explore ThinkNet</span>
              <ArrowRight className="h-4 w-4" />
            </Link>
            <Link
              to="/about"
              className="inline-flex items-center gap-2 rounded-md border border-white/[0.12] bg-[#07090E] px-6 py-3 text-sm font-medium text-slate-200 transition-colors hover:border-white/30 hover:text-white"
            >
              <span>About Organization</span>
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}

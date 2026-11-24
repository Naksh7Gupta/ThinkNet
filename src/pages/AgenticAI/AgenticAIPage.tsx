import { useState } from 'react';
import { Link } from 'react-router-dom';
import { AgentNetworkGraph } from '../../components/visualizations/AgentNetworkGraph';
import { ResearchImage } from '../../components/shared/ResearchImage';
import { visualAssets } from '../../data/visualAssets';
import {
  autonomyLevels,
  continuousTrainingLoop,
  specializedAgents,
} from '../../data/agents/researchAgents';
import { getDivisionById } from '../../data/infrastructure/divisions';

export function AgenticAIPage() {
  const [activeStageIdx, setActiveStageIdx] = useState(0);

  return (
    <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
      {/* Header */}
      <header className="border-b border-white/[0.08] pb-10 grid grid-cols-1 gap-8 lg:grid-cols-12 items-stretch">
        <div className="lg:col-span-7 flex flex-col justify-center">
          <p className="font-mono text-xs uppercase tracking-wider text-[#38BDF8]">
            Agentic Research &amp; Training System
          </p>
          <h1 className="mt-2 font-display text-3xl font-bold text-white sm:text-4xl text-balance">
            Specialized AI Research Agents
          </h1>
          <p className="mt-3 text-base text-slate-300 leading-relaxed">
            AI agents actively participate throughout the model development and training lifecycle.
            Rather than executing isolated scripts, specialized agents observe runs, inspect
            gradients and architectures, curate curricula, benchmark checkpoints, and propose
            experiments under explicit human governance.
          </p>
        </div>
        <div className="lg:col-span-5 overflow-hidden rounded-lg border border-white/[0.08]">
          <ResearchImage
            src={visualAssets.families['agentic-generative'].src}
            alt={visualAssets.families['agentic-generative'].alt}
            caption="Multi-Agent Research Coordination & Governance"
            aspectClass="aspect-[4/3] lg:h-full"
          />
        </div>
      </header>

      {/* Interactive Multi-Agent Network */}
      <section className="py-10 border-b border-white/[0.08]">
        <AgentNetworkGraph />
      </section>

      {/* All 7 Specialized Agents */}
      <section className="py-12 border-b border-white/[0.08]">
        <div className="mb-8">
          <h2 className="font-display text-2xl font-bold text-white">
            All Seven Specialized Agents
          </h2>
          <p className="mt-1 text-sm text-slate-400">
            Responsibilities, primary domain, connected agents, and infrastructure integrations.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
          {specializedAgents.map((agent) => (
            <article
              key={agent.id}
              id={agent.slug}
              className="scroll-mt-24 rounded-lg border border-white/[0.08] bg-[#0B0E17] p-6 space-y-4"
            >
              <div className="flex items-center justify-between text-xs text-slate-400">
                <span className="font-mono text-[#38BDF8]">Agent {agent.code}</span>
                <span>{agent.primaryDomain}</span>
              </div>
              <h3 className="font-display text-xl font-bold text-white">{agent.name}</h3>
              <p className="text-sm text-slate-300 leading-relaxed">{agent.summary}</p>

              <div>
                <p className="mb-2 font-mono text-[11px] uppercase tracking-wider text-slate-500">
                  Responsibilities
                </p>
                <ul className="grid grid-cols-1 gap-1.5 sm:grid-cols-2 text-xs text-slate-300">
                  {agent.responsibilities.map((r) => (
                    <li key={r} className="flex items-start gap-2">
                      <span className="mt-1.5 h-1 w-1 rounded-full bg-[#38BDF8] shrink-0" />
                      <span>{r}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-3 border-t border-white/[0.06] pt-4 text-xs">
                <div className="flex flex-wrap gap-1.5">
                  {agent.relatedInfrastructureIds.map((id) => {
                    const div = getDivisionById(id);
                    if (!div) return null;
                    return (
                      <Link
                        key={div.id}
                        to={`/infrastructure/${div.slug}`}
                        className="rounded border border-white/[0.08] bg-[#07090E] px-2.5 py-1 text-slate-300 hover:border-[#3B82F6] hover:text-white"
                      >
                        {div.name}
                      </Link>
                    );
                  })}
                </div>
                <span className="font-mono text-[11px] text-slate-500 tabular-nums">
                  {agent.connectedAgentIds.length} agent links
                </span>
              </div>
            </article>
          ))}
        </div>
      </section>

      {/* Three Levels of Agent Autonomy & Safety Controls */}
      <section className="py-12 border-b border-white/[0.08]">
        <div className="mb-8 max-w-3xl">
          <h2 className="font-display text-2xl font-bold text-white">
            Three Levels of Agent Autonomy
          </h2>
          <p className="mt-2 text-sm text-slate-300 leading-relaxed">
            Initially, consequential changes require explicit human approval. Autonomous
            operations require validation gates, resource limits, immutable experiment logs, and
            automated rollback mechanisms.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
          {autonomyLevels.map((lvl) => (
            <div
              key={lvl.level}
              className="rounded-lg border border-white/[0.08] bg-[#0B0E17] p-6 space-y-4"
            >
              <div className="flex items-center justify-between text-xs">
                <span className="font-mono text-[#38BDF8]">Level {lvl.level}</span>
                <span className="font-mono text-slate-500">Governance Tier</span>
              </div>
              <h3 className="font-display text-xl font-bold text-white">
                Level {lvl.level} — {lvl.name}
              </h3>
              <p className="text-sm text-slate-200">{lvl.summary}</p>

              <div className="space-y-2 border-t border-white/[0.06] pt-4">
                <p className="font-mono text-[11px] uppercase tracking-wider text-slate-500">
                  Authorized Capabilities
                </p>
                <ul className="space-y-1.5 text-xs text-slate-300">
                  {lvl.permissions.map((p) => (
                    <li key={p} className="flex items-start gap-2">
                      <span className="mt-1.5 h-1 w-1 rounded-full bg-[#38BDF8] shrink-0" />
                      <span>{p}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <div className="space-y-2 border-t border-white/[0.06] pt-4">
                <p className="font-mono text-[11px] uppercase tracking-wider text-slate-500">
                  Approval &amp; Validation Safeguards
                </p>
                <ul className="space-y-1.5 text-xs text-slate-400">
                  {lvl.safeguards.map((s) => (
                    <li key={s} className="flex items-start gap-2">
                      <span className="mt-1.5 h-1 w-1 rounded-full bg-slate-500 shrink-0" />
                      <span>{s}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Continuous Training Intelligence Loop */}
      <section className="pt-12">
        <div className="mb-6">
          <h2 className="font-display text-2xl font-bold text-white">
            Continuous Training Intelligence Loop
          </h2>
          <p className="mt-1 text-sm text-slate-400">
            The agentic research system operates continuously across every phase of a training campaign to sustain a measurable research cycle.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-5">
          {continuousTrainingLoop.map((stage, idx) => {
            const active = idx === activeStageIdx;
            return (
              <button
                key={stage.id}
                type="button"
                onClick={() => setActiveStageIdx(idx)}
                className={`rounded-lg border p-4 text-left transition-colors ${
                  active
                    ? 'border-[#3B82F6] bg-[#3B82F6]/12'
                    : 'border-white/[0.08] bg-[#0B0E17] hover:border-white/20'
                }`}
              >
                <span className="font-mono text-[11px] text-[#38BDF8]">
                  {stage.timing}
                </span>
                <p className="mt-1 font-display text-sm font-semibold text-white">
                  {stage.stage}
                </p>
                <p className="mt-1 font-mono text-[11px] text-slate-500 tabular-nums">
                  {stage.actions.length} actions
                </p>
              </button>
            );
          })}
        </div>

        <div className="mt-4 rounded-lg border border-white/[0.08] bg-[#0B0E17] p-6">
          <div className="flex items-center justify-between">
            <h3 className="font-display text-lg font-semibold text-white">
              {continuousTrainingLoop[activeStageIdx].stage}
            </h3>
            <span className="font-mono text-xs text-[#38BDF8]">
              {continuousTrainingLoop[activeStageIdx].timing}
            </span>
          </div>
          <div className="mt-4 grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-4">
            {continuousTrainingLoop[activeStageIdx].actions.map((act) => (
              <div
                key={act}
                className="rounded border border-white/[0.06] bg-[#07090E] px-3.5 py-2.5 text-sm text-slate-200"
              >
                {act}
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}

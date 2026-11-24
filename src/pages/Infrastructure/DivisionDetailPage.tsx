import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, ArrowRight } from 'lucide-react';
import { Breadcrumb } from '../../components/shared/Breadcrumb';
import {
  getDivisionById,
  getDivisionBySlug,
  researchDivisions,
} from '../../data/infrastructure/divisions';
import { specializedAgents } from '../../data/agents/researchAgents';

export function DivisionDetailPage() {
  const { divisionSlug } = useParams<{ divisionSlug: string }>();
  const division = getDivisionBySlug(divisionSlug ?? '');

  if (!division) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-20 text-center">
        <h1 className="font-display text-2xl font-bold text-white">
          Infrastructure Division Not Found
        </h1>
        <Link
          to="/infrastructure"
          className="mt-6 inline-flex items-center gap-2 rounded-md bg-[#3B82F6] px-4 py-2 text-sm font-medium text-white"
        >
          <ArrowLeft className="h-4 w-4" />
          <span>Back to Infrastructure</span>
        </Link>
      </div>
    );
  }

  const upstream = division.upstreamIds
    .map((id) => getDivisionById(id))
    .filter((d): d is NonNullable<typeof d> => Boolean(d));
  const downstream = division.downstreamIds
    .map((id) => getDivisionById(id))
    .filter((d): d is NonNullable<typeof d> => Boolean(d));
  const agents = specializedAgents.filter((a) =>
    division.relatedAgentIds.includes(a.id)
  );

  return (
    <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
      <Breadcrumb
        items={[
          { label: 'Home', to: '/' },
          { label: 'Infrastructure', to: '/infrastructure' },
          { label: `Division ${division.number}: ${division.name}` },
        ]}
      />

      <header className="border-b border-white/[0.08] pb-10">
        <div className="flex items-center gap-2 text-xs text-slate-400">
          <span className="font-mono text-[#38BDF8]">
            Technical Division {division.number}
          </span>
          <span aria-hidden="true">·</span>
          <span className="font-mono tabular-nums">
            {division.features.length} Core Capabilities
          </span>
        </div>
        <h1 className="mt-2 font-display text-3xl font-bold text-white sm:text-4xl">
          {division.name}
        </h1>
        <p className="mt-3 max-w-3xl text-base text-slate-300 leading-relaxed">
          {division.description}
        </p>

        {/* Quick Division Switcher */}
        <div className="mt-6 flex flex-wrap gap-2">
          {researchDivisions.map((d) => (
            <Link
              key={d.id}
              to={`/infrastructure/${d.slug}`}
              className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
                d.slug === division.slug
                  ? 'bg-[#3B82F6] text-white'
                  : 'border border-white/[0.08] bg-[#0B0E17] text-slate-400 hover:text-white'
              }`}
            >
              {d.number}. {d.name}
            </Link>
          ))}
        </div>
      </header>

      {/* Capabilities & Tools */}
      <section className="py-10 border-b border-white/[0.08]">
        <h2 className="font-display text-xl font-bold text-white">
          Engineering &amp; Research Capabilities
        </h2>
        <p className="mt-1 text-sm text-slate-400">
          Every tool and methodology defined under {division.name}.
        </p>

        <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {division.features.map((feat, idx) => (
            <div
              key={feat}
              className="flex items-center gap-3 rounded-lg border border-white/[0.08] bg-[#0B0E17] p-4"
            >
              <span className="font-mono text-xs text-[#38BDF8] tabular-nums">
                {String(idx + 1).padStart(2, '0')}
              </span>
              <span className="text-sm font-medium text-white">{feat}</span>
            </div>
          ))}
        </div>
      </section>

      {/* Topology Links & Agents */}
      <section className="pt-10 grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="rounded-lg border border-white/[0.08] bg-[#0B0E17] p-6 space-y-4">
          <h3 className="font-display text-base font-semibold text-white">
            Upstream Inputs
          </h3>
          {upstream.length === 0 ? (
            <p className="text-xs text-slate-400">Primary source division.</p>
          ) : (
            <div className="space-y-2">
              {upstream.map((u) => (
                <Link
                  key={u.id}
                  to={`/infrastructure/${u.slug}`}
                  className="flex items-center justify-between rounded border border-white/[0.06] bg-[#07090E] px-3.5 py-2.5 text-xs text-slate-200 hover:border-[#3B82F6]"
                >
                  <span>
                    {u.number}. {u.name}
                  </span>
                  <ArrowRight className="h-3.5 w-3.5 text-slate-500" />
                </Link>
              ))}
            </div>
          )}
        </div>

        <div className="rounded-lg border border-white/[0.08] bg-[#0B0E17] p-6 space-y-4">
          <h3 className="font-display text-base font-semibold text-white">
            Downstream Consumers
          </h3>
          {downstream.length === 0 ? (
            <p className="text-xs text-slate-400">
              Terminal execution and serving layer.
            </p>
          ) : (
            <div className="space-y-2">
              {downstream.map((d) => (
                <Link
                  key={d.id}
                  to={`/infrastructure/${d.slug}`}
                  className="flex items-center justify-between rounded border border-white/[0.06] bg-[#07090E] px-3.5 py-2.5 text-xs text-slate-200 hover:border-[#3B82F6]"
                >
                  <span>
                    {d.number}. {d.name}
                  </span>
                  <ArrowRight className="h-3.5 w-3.5 text-slate-500" />
                </Link>
              ))}
            </div>
          )}
        </div>

        <div className="rounded-lg border border-white/[0.08] bg-[#0B0E17] p-6 space-y-4">
          <h3 className="font-display text-base font-semibold text-white">
            Cooperating Research Agents
          </h3>
          <div className="space-y-2">
            {agents.map((agent) => (
              <Link
                key={agent.id}
                to={`/agentic-ai#${agent.slug}`}
                className="block rounded border border-white/[0.06] bg-[#07090E] p-3 hover:border-[#3B82F6]"
              >
                <p className="text-xs font-semibold text-white">
                  {agent.code}. {agent.name}
                </p>
                <p className="mt-0.5 text-[11px] text-slate-400">
                  {agent.primaryDomain}
                </p>
              </Link>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}

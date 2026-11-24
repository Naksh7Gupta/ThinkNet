import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import { researchDivisions, getDivisionById } from '../../data/infrastructure/divisions';

const primaryPipelineOrder = [
  'div-data-eng',
  'div-training-infra',
  'div-post-training',
  'div-eval-infra',
  'div-inference-eng',
];

const supportingDivisions = [
  'div-research-infra',
  'div-model-arch',
  'div-compute-kernel',
];

export function InfrastructureFlowGraph() {
  const [selectedId, setSelectedId] = useState<string>('div-training-infra');
  const selected = getDivisionById(selectedId) ?? researchDivisions[0];

  const isUpstream = (id: string) => selected.upstreamIds.includes(id);
  const isDownstream = (id: string) => selected.downstreamIds.includes(id);

  return (
    <div className="rounded-lg border border-white/[0.08] bg-[#0B0E17] p-6">
      <div className="mb-6 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h3 className="font-display text-base font-semibold text-white">
            Interconnected Research & Engineering Topology
          </h3>
          <p className="text-xs text-slate-400">
            Illustrative workflow relationships across all eight divisions. Select any division to inspect upstream and downstream dependencies.
          </p>
        </div>
        <span className="font-mono text-xs text-slate-400 whitespace-nowrap shrink-0">
          8 Core Divisions
        </span>
      </div>

      {/* Supporting Foundations Row */}
      <div className="mb-4">
        <p className="mb-2 font-mono text-[11px] uppercase tracking-wider text-slate-500">
          Research, Architecture & Compute Foundations
        </p>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
          {supportingDivisions.map((id) => {
            const div = getDivisionById(id)!;
            const active = selectedId === div.id;
            const rel = isUpstream(div.id)
              ? 'Upstream input'
              : isDownstream(div.id)
                ? 'Downstream consumer'
                : null;
            return (
              <button
                key={div.id}
                type="button"
                onClick={() => setSelectedId(div.id)}
                className={`rounded-md border p-4 text-left transition-colors ${
                  active
                    ? 'border-[#3B82F6] bg-[#3B82F6]/10'
                    : rel
                      ? 'border-[#38BDF8]/40 bg-[#0D111A]'
                      : 'border-white/[0.08] bg-[#0D111A] hover:border-white/20'
                }`}
              >
                <div className="flex items-center justify-between text-xs text-slate-400">
                  <span className="font-mono">Division {div.number}</span>
                  {rel && <span className="font-mono text-[#38BDF8]">{rel}</span>}
                </div>
                <p className="mt-1.5 font-display text-sm font-semibold text-white">
                  {div.name}
                </p>
                <p className="mt-1 text-xs text-slate-400 line-clamp-2">{div.summary}</p>
              </button>
            );
          })}
        </div>
      </div>

      {/* Illustrative Primary Execution Flow */}
      <div className="mt-6">
        <p className="mb-2 font-mono text-[11px] uppercase tracking-wider text-slate-500">
          Illustrative Pipeline Flow (Non-Restrictive)
        </p>
        <div className="grid grid-cols-1 gap-3 lg:grid-cols-5">
          {primaryPipelineOrder.map((id, idx) => {
            const div = getDivisionById(id)!;
            const active = selectedId === div.id;
            const rel = isUpstream(div.id)
              ? 'Upstream'
              : isDownstream(div.id)
                ? 'Downstream'
                : null;
            return (
              <div key={div.id} className="flex items-stretch gap-2">
                <button
                  type="button"
                  onClick={() => setSelectedId(div.id)}
                  className={`flex-1 rounded-md border p-4 text-left transition-colors ${
                    active
                      ? 'border-[#3B82F6] bg-[#3B82F6]/10'
                      : rel
                        ? 'border-[#38BDF8]/40 bg-[#0D111A]'
                        : 'border-white/[0.08] bg-[#0D111A] hover:border-white/20'
                  }`}
                >
                  <div className="flex items-center justify-between text-xs text-slate-400">
                    <span className="font-mono">{div.number}</span>
                    {rel && <span className="font-mono text-[#38BDF8]">{rel}</span>}
                  </div>
                  <p className="mt-1.5 font-display text-sm font-semibold text-white">
                    {div.name}
                  </p>
                  <p className="mt-1 font-mono text-[11px] text-slate-500 tabular-nums">
                    {div.features.length} tools
                  </p>
                </button>
                {idx < primaryPipelineOrder.length - 1 && (
                  <div
                    aria-hidden="true"
                    className="hidden lg:flex items-center justify-center text-slate-600"
                  >
                    <ArrowRight className="h-4 w-4" />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Selected Division Inspection Drawer */}
      <div className="mt-6 border-t border-white/[0.08] pt-6">
        <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div className="space-y-2 max-w-2xl">
            <div className="flex items-center gap-2 text-xs text-slate-400">
              <span className="font-mono text-[#38BDF8]">Division {selected.number}</span>
              <span aria-hidden="true">·</span>
              <span>{selected.features.length} Infrastructure Capabilities</span>
            </div>
            <h4 className="font-display text-lg font-semibold text-white">
              {selected.name}
            </h4>
            <p className="text-sm text-slate-300 leading-relaxed">
              {selected.description}
            </p>
          </div>
          <Link
            to={`/infrastructure/${selected.slug}`}
            className="inline-flex items-center gap-2 rounded-md border border-[#3B82F6]/50 bg-[#3B82F6]/10 px-4 py-2 text-xs font-medium text-white hover:bg-[#3B82F6]/20 whitespace-nowrap shrink-0"
          >
            <span>Open Division Specification</span>
            <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
          {selected.features.map((feat) => (
            <div
              key={feat}
              className="rounded border border-white/[0.06] bg-[#07090E] px-3 py-2 text-xs text-slate-300"
            >
              {feat}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

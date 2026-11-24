import { useState } from 'react';
import { Link } from 'react-router-dom';
import { specializedAgents } from '../../data/agents/researchAgents';
import { getDivisionById } from '../../data/infrastructure/divisions';

const nodeCoordinates: Record<string, { x: number; y: number }> = {
  'agent-supervisor': { x: 320, y: 185 },
  'agent-inspector': { x: 130, y: 85 },
  'agent-data-research': { x: 510, y: 85 },
  'agent-kernel-opt': { x: 90, y: 235 },
  'agent-model-research': { x: 320, y: 42 },
  'agent-eval': { x: 550, y: 235 },
  'agent-post-training': { x: 320, y: 325 },
};

export function AgentNetworkGraph() {
  const [selectedId, setSelectedId] = useState<string>('agent-supervisor');
  const selected =
    specializedAgents.find((a) => a.id === selectedId) ?? specializedAgents[0];

  const isConnected = (id: string) =>
    selected.connectedAgentIds.includes(id) || selected.id === id;

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-12 items-stretch">
      {/* Interactive SVG Multi-Agent Graph */}
      <div className="lg:col-span-7 rounded-lg border border-white/[0.08] bg-[#0B0E17] p-5 flex flex-col justify-between">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="font-display text-sm font-semibold text-white">
            Multi-Agent Coordination Topology
          </h3>
          <span className="font-mono text-xs text-slate-400">
            Click any node to inspect
          </span>
        </div>

        <div className="w-full overflow-hidden rounded border border-white/[0.06] bg-[#07090E]">
          <svg
            viewBox="0 0 640 370"
            className="h-auto w-full"
            role="img"
            aria-label="Interactive multi-agent research network"
          >
            {/* Subtle coordinate grid */}
            <defs>
              <pattern
                id="agentGrid"
                width="32"
                height="32"
                patternUnits="userSpaceOnUse"
              >
                <path
                  d="M 32 0 L 0 0 0 32"
                  fill="none"
                  stroke="rgba(255,255,255,0.035)"
                  strokeWidth="1"
                />
              </pattern>
            </defs>
            <rect width="640" height="370" fill="url(#agentGrid)" />

            {/* Edges */}
            {specializedAgents.map((agent) =>
              agent.connectedAgentIds.map((targetId) => {
                if (agent.id > targetId) return null;
                const a = nodeCoordinates[agent.id];
                const b = nodeCoordinates[targetId];
                if (!a || !b) return null;
                const highlighted =
                  agent.id === selected.id || targetId === selected.id;
                return (
                  <line
                    key={`${agent.id}-${targetId}`}
                    x1={a.x}
                    y1={a.y}
                    x2={b.x}
                    y2={b.y}
                    stroke={
                      highlighted
                        ? '#38BDF8'
                        : 'rgba(148, 163, 184, 0.18)'
                    }
                    strokeWidth={highlighted ? 1.8 : 1}
                    strokeDasharray={highlighted ? undefined : '3 3'}
                  />
                );
              })
            )}

            {/* Nodes */}
            {specializedAgents.map((agent) => {
              const pos = nodeCoordinates[agent.id];
              if (!pos) return null;
              const active = agent.id === selected.id;
              const connected = isConnected(agent.id);
              const shortLabel = agent.name.replace(' Agent', '');

              return (
                <g
                  key={agent.id}
                  onClick={() => setSelectedId(agent.id)}
                  className="cursor-pointer"
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      setSelectedId(agent.id);
                    }
                  }}
                  aria-label={`Select ${agent.name}`}
                >
                  <circle
                    cx={pos.x}
                    cy={pos.y}
                    r={active ? 24 : 18}
                    fill={
                      active
                        ? 'rgba(59, 130, 246, 0.25)'
                        : connected
                          ? 'rgba(56, 189, 248, 0.12)'
                          : 'rgba(15, 23, 42, 0.9)'
                    }
                    stroke={
                      active
                        ? '#3B82F6'
                        : connected
                          ? '#38BDF8'
                          : 'rgba(148, 163, 184, 0.35)'
                    }
                    strokeWidth={active ? 2 : 1.2}
                  />
                  <text
                    x={pos.x}
                    y={pos.y + 4}
                    textAnchor="middle"
                    fill="#F8FAFC"
                    fontSize="11"
                    fontFamily="IBM Plex Mono, monospace"
                    fontWeight="600"
                  >
                    {agent.code}
                  </text>
                  <text
                    x={pos.x}
                    y={pos.y + (agent.id === 'agent-model-research' ? -24 : 34)}
                    textAnchor="middle"
                    fill={active ? '#FFFFFF' : '#94A3B8'}
                    fontSize="11"
                    fontFamily="DM Sans, sans-serif"
                    fontWeight={active ? '600' : '500'}
                  >
                    {shortLabel}
                  </text>
                </g>
              );
            })}
          </svg>
        </div>

        <p className="mt-3 text-xs text-slate-400">
          Solid cyan edges indicate direct coordination channels for the selected agent.
        </p>
      </div>

      {/* Selected Agent Details Panel */}
      <div className="lg:col-span-5 rounded-lg border border-white/[0.08] bg-[#0B0E17] p-6 flex flex-col justify-between">
        <div className="space-y-4">
          <div className="flex items-center gap-2 text-xs text-slate-400">
            <span className="font-mono text-[#38BDF8]">Agent {selected.code}</span>
            <span aria-hidden="true">·</span>
            <span>{selected.primaryDomain}</span>
          </div>

          <h4 className="font-display text-xl font-semibold text-white">
            {selected.name}
          </h4>

          <p className="text-sm text-slate-300 leading-relaxed">
            {selected.summary}
          </p>

          <div>
            <h5 className="mb-2 font-mono text-[11px] uppercase tracking-wider text-slate-400">
              Defined Responsibilities
            </h5>
            <ul className="space-y-1.5 text-sm text-slate-300">
              {selected.responsibilities.map((resp) => (
                <li key={resp} className="flex items-start gap-2">
                  <span className="mt-1.5 h-1 w-1 rounded-full bg-[#38BDF8] shrink-0" />
                  <span>{resp}</span>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h5 className="mb-2 font-mono text-[11px] uppercase tracking-wider text-slate-400">
              Related Infrastructure
            </h5>
            <div className="flex flex-wrap gap-2">
              {selected.relatedInfrastructureIds.map((divId) => {
                const div = getDivisionById(divId);
                if (!div) return null;
                return (
                  <Link
                    key={div.id}
                    to={`/infrastructure/${div.slug}`}
                    className="rounded border border-white/[0.1] bg-[#07090E] px-2.5 py-1 text-xs text-slate-200 hover:border-[#3B82F6]"
                  >
                    {div.name}
                  </Link>
                );
              })}
            </div>
          </div>
        </div>

        <div className="mt-6 border-t border-white/[0.08] pt-4">
          <p className="text-xs text-slate-400">
            <span className="font-medium text-slate-200">Governance:</span>{' '}
            {selected.autonomyScope}
          </p>
        </div>
      </div>
    </div>
  );
}

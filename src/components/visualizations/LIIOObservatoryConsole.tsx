import { useState } from 'react';

type InstrumentMode = 'layers' | 'attention' | 'tokens' | 'hidden-states';

const sampleTokens = ['ThinkNet', 'optimizes', 'GPU', 'kernels', 'for', 'verifiable', 'reasoning'];

const layerProfiles = Array.from({ length: 16 }, (_, idx) => {
  const layer = idx + 1;
  const attn = Number((0.28 + Math.sin(idx * 0.65) * 0.16 + idx * 0.015).toFixed(2));
  const mlp = Number((0.35 + Math.cos(idx * 0.5) * 0.14 + (idx > 8 ? 0.18 : 0.04)).toFixed(2));
  const residualDelta = Number((attn * 0.55 + mlp * 0.45).toFixed(2));
  return { layer, attn, mlp, residualDelta };
});

const attentionHeadData: Record<number, number[][]> = {
  0: [
    [0.92, 0.03, 0.02, 0.01, 0.01, 0.01, 0.0],
    [0.41, 0.52, 0.03, 0.02, 0.01, 0.01, 0.0],
    [0.12, 0.25, 0.58, 0.02, 0.01, 0.01, 0.01],
    [0.08, 0.11, 0.44, 0.34, 0.01, 0.01, 0.01],
    [0.15, 0.18, 0.1, 0.21, 0.34, 0.01, 0.01],
    [0.09, 0.14, 0.19, 0.28, 0.08, 0.21, 0.01],
    [0.11, 0.09, 0.16, 0.22, 0.06, 0.24, 0.12],
  ],
  1: [
    [0.85, 0.05, 0.04, 0.03, 0.01, 0.01, 0.01],
    [0.64, 0.28, 0.04, 0.02, 0.01, 0.01, 0.0],
    [0.52, 0.12, 0.31, 0.03, 0.01, 0.01, 0.0],
    [0.48, 0.08, 0.26, 0.15, 0.01, 0.01, 0.01],
    [0.43, 0.09, 0.14, 0.18, 0.14, 0.01, 0.01],
    [0.37, 0.06, 0.12, 0.15, 0.11, 0.18, 0.01],
    [0.34, 0.08, 0.11, 0.14, 0.09, 0.15, 0.09],
  ],
  2: [
    [0.95, 0.02, 0.01, 0.01, 0.01, 0.0, 0.0],
    [0.18, 0.77, 0.02, 0.01, 0.01, 0.01, 0.0],
    [0.06, 0.62, 0.29, 0.01, 0.01, 0.01, 0.0],
    [0.04, 0.12, 0.66, 0.16, 0.01, 0.01, 0.0],
    [0.05, 0.09, 0.14, 0.59, 0.11, 0.01, 0.01],
    [0.03, 0.07, 0.11, 0.18, 0.49, 0.11, 0.01],
    [0.04, 0.05, 0.09, 0.15, 0.12, 0.44, 0.11],
  ],
};

const tokenMetrics = [
  { token: 'ThinkNet', entropy: 1.42, norm: 18.4, topProb: 0.74 },
  { token: 'optimizes', entropy: 2.18, norm: 21.1, topProb: 0.51 },
  { token: 'GPU', entropy: 0.94, norm: 23.6, topProb: 0.86 },
  { token: 'kernels', entropy: 0.68, norm: 24.2, topProb: 0.91 },
  { token: 'for', entropy: 1.15, norm: 19.7, topProb: 0.79 },
  { token: 'verifiable', entropy: 2.41, norm: 26.8, topProb: 0.44 },
  { token: 'reasoning', entropy: 0.88, norm: 25.3, topProb: 0.88 },
];

export function LIIOObservatoryConsole() {
  const [mode, setMode] = useState<InstrumentMode>('layers');
  const [selectedLayer, setSelectedLayer] = useState<number>(10);
  const [selectedHead, setSelectedHead] = useState<number>(0);
  const [selectedTokenIdx, setSelectedTokenIdx] = useState<number>(3);

  const activeLayer =
    layerProfiles.find((l) => l.layer === selectedLayer) ?? layerProfiles[0];
  const matrix = attentionHeadData[selectedHead] ?? attentionHeadData[0];

  return (
    <div className="rounded-lg border border-white/[0.1] bg-[#0B0E17]">
      {/* Scientific Instrument Top Bar */}
      <div className="flex flex-col gap-3 border-b border-white/[0.08] bg-[#0D111A] px-5 py-3.5 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <span className="font-mono font-semibold text-[#38BDF8]">
            LIIO Instrument Console
          </span>
          <span aria-hidden="true" className="text-slate-600">·</span>
          <span className="text-slate-400">
            Illustrative Interface Preview (Simulated Reference Telemetry — Not Live Model Weights)
          </span>
        </div>
        <div className="flex flex-wrap items-center gap-1 rounded-md border border-white/[0.08] bg-[#07090E] p-1">
          {[
            { id: 'layers' as const, label: 'Layer Contributions' },
            { id: 'attention' as const, label: 'Attention Head Matrix' },
            { id: 'tokens' as const, label: 'Token-Level Trace' },
            { id: 'hidden-states' as const, label: 'Hidden-State Delta' },
          ].map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setMode(tab.id)}
              className={`rounded px-2.5 py-1.5 text-xs font-medium whitespace-nowrap shrink-0 transition-colors ${
                mode === tab.id
                  ? 'bg-[#3B82F6] text-white'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Main Instrument Viewport */}
      <div className="p-6">
        {mode === 'layers' && (
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
            <div className="lg:col-span-8 space-y-4">
              <div className="flex items-center justify-between">
                <h4 className="font-display text-sm font-semibold text-white">
                  Illustrative Transformer Layer Contribution Profile (L01–L16)
                </h4>
                <span className="font-mono text-xs text-slate-400">
                  Residual Stream Delta
                </span>
              </div>

              <div className="grid grid-cols-8 sm:grid-cols-16 gap-1.5 items-end h-52 rounded border border-white/[0.06] bg-[#07090E] p-4">
                {layerProfiles.map((item) => {
                  const isSel = item.layer === selectedLayer;
                  const heightPct = Math.min(100, Math.round(item.residualDelta * 125));
                  return (
                    <button
                      key={item.layer}
                      type="button"
                      onClick={() => setSelectedLayer(item.layer)}
                      className="group flex h-full flex-col items-center justify-end gap-1.5 focus:outline-none"
                      aria-label={`Inspect Layer ${item.layer}`}
                    >
                      <div className="relative flex w-full flex-1 items-end justify-center">
                        <div
                          style={{ height: `${heightPct}%` }}
                          className={`w-full rounded-t transition-colors ${
                            isSel
                              ? 'bg-[#38BDF8]'
                              : 'bg-[#3B82F6]/45 group-hover:bg-[#3B82F6]/75'
                          }`}
                        />
                      </div>
                      <span
                        className={`font-mono text-[10px] tabular-nums ${
                          isSel ? 'text-white font-semibold' : 'text-slate-500'
                        }`}
                      >
                        L{String(item.layer).padStart(2, '0')}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="lg:col-span-4 rounded border border-white/[0.08] bg-[#07090E] p-5 space-y-4">
              <div className="flex items-center justify-between text-xs text-slate-400">
                <span className="font-mono text-[#38BDF8]">
                  Layer {String(activeLayer.layer).padStart(2, '0')} Readout
                </span>
                <span>Illustrative Values</span>
              </div>
              <div className="space-y-3">
                <div>
                  <div className="flex justify-between text-xs text-slate-300 mb-1">
                    <span>Attention Contribution</span>
                    <span className="font-mono tabular-nums">{activeLayer.attn.toFixed(2)}</span>
                  </div>
                  <div className="h-1.5 w-full rounded bg-white/[0.06]">
                    <div
                      className="h-1.5 rounded bg-[#38BDF8]"
                      style={{ width: `${Math.min(100, activeLayer.attn * 100)}%` }}
                    />
                  </div>
                </div>
                <div>
                  <div className="flex justify-between text-xs text-slate-300 mb-1">
                    <span>MLP / Neuron Contribution</span>
                    <span className="font-mono tabular-nums">{activeLayer.mlp.toFixed(2)}</span>
                  </div>
                  <div className="h-1.5 w-full rounded bg-white/[0.06]">
                    <div
                      className="h-1.5 rounded bg-[#3B82F6]"
                      style={{ width: `${Math.min(100, activeLayer.mlp * 100)}%` }}
                    />
                  </div>
                </div>
                <div>
                  <div className="flex justify-between text-xs text-slate-300 mb-1">
                    <span>Combined Residual Delta</span>
                    <span className="font-mono tabular-nums">
                      {activeLayer.residualDelta.toFixed(2)}
                    </span>
                  </div>
                  <div className="h-1.5 w-full rounded bg-white/[0.06]">
                    <div
                      className="h-1.5 rounded bg-indigo-400"
                      style={{ width: `${Math.min(100, activeLayer.residualDelta * 100)}%` }}
                    />
                  </div>
                </div>
              </div>
              <p className="text-xs text-slate-400 leading-relaxed pt-2 border-t border-white/[0.06]">
                Layer Contribution Analyzer measures how attention and MLP blocks reshape hidden representations across model depth.
              </p>
            </div>
          </div>
        )}

        {mode === 'attention' && (
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
            <div className="lg:col-span-8 space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <h4 className="font-display text-sm font-semibold text-white">
                  Illustrative Causal Attention Matrix — Head H0{selectedHead + 1}
                </h4>
                <div className="flex items-center gap-1">
                  {[0, 1, 2].map((h) => (
                    <button
                      key={h}
                      type="button"
                      onClick={() => setSelectedHead(h)}
                      className={`rounded px-2.5 py-1 font-mono text-xs transition-colors ${
                        selectedHead === h
                          ? 'bg-[#3B82F6] text-white'
                          : 'border border-white/[0.08] text-slate-400 hover:text-white'
                      }`}
                    >
                      Head 0{h + 1}
                    </button>
                  ))}
                </div>
              </div>

              <div className="overflow-x-auto rounded border border-white/[0.06] bg-[#07090E] p-4">
                <div className="min-w-[460px] space-y-1">
                  <div className="grid grid-cols-8 gap-1 text-[11px] font-mono text-slate-500 pb-1">
                    <span>Q \ K</span>
                    {sampleTokens.map((t) => (
                      <span key={t} className="truncate text-center">
                        {t}
                      </span>
                    ))}
                  </div>
                  {matrix.map((row, rIdx) => (
                    <div key={sampleTokens[rIdx]} className="grid grid-cols-8 gap-1 items-center">
                      <span className="truncate font-mono text-[11px] text-slate-400 pr-2">
                        {sampleTokens[rIdx]}
                      </span>
                      {row.map((val, cIdx) => {
                        const masked = cIdx > rIdx;
                        return (
                          <div
                            key={`${rIdx}-${cIdx}`}
                            title={
                              masked
                                ? 'Causal mask'
                                : `${sampleTokens[rIdx]} → ${sampleTokens[cIdx]}: ${val.toFixed(2)}`
                            }
                            style={{
                              backgroundColor: masked
                                ? 'rgba(255,255,255,0.02)'
                                : `rgba(56, 189, 248, ${Math.max(0.06, val)})`,
                            }}
                            className="flex h-8 items-center justify-center rounded-[2px] font-mono text-[10px] tabular-nums text-white/90"
                          >
                            {masked ? '—' : val.toFixed(2)}
                          </div>
                        );
                      })}
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="lg:col-span-4 rounded border border-white/[0.08] bg-[#07090E] p-5 space-y-3">
              <span className="font-mono text-xs text-[#38BDF8]">
                Head Behaviour Hypothesis
              </span>
              <h5 className="font-display text-base font-semibold text-white">
                {selectedHead === 0
                  ? 'Local Phrase & Compound Binding'
                  : selectedHead === 1
                    ? 'Anchor / Initial Token Routing'
                    : 'Previous-Token Induction Pattern'}
              </h5>
              <p className="text-xs text-slate-400 leading-relaxed">
                {selectedHead === 0
                  ? 'Concentrates attention weight onto adjacent technical nouns (e.g., GPU ↔ kernels) during local syntactic composition.'
                  : selectedHead === 1
                    ? 'Demonstrates anchor-token attention routing often inspected during long-context sink and KV-cache eviction research.'
                    : 'Tracks shifted diagonal attention links characteristic of induction and sequence-continuation heads.'}
              </p>
              <div className="border-t border-white/[0.06] pt-3 text-[11px] font-mono text-slate-500">
                Illustrative pattern matrix for Attention Head Inspector & Attention Pattern Inspection.
              </div>
            </div>
          </div>
        )}

        {mode === 'tokens' && (
          <div className="space-y-5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h4 className="font-display text-sm font-semibold text-white">
                Illustrative Token-Level Entropy & Residual Norm Trace
              </h4>
              <span className="font-mono text-xs text-slate-400">
                Select any token to inspect trace telemetry
              </span>
            </div>

            <div className="flex flex-wrap gap-2">
              {tokenMetrics.map((tm, idx) => (
                <button
                  key={tm.token}
                  type="button"
                  onClick={() => setSelectedTokenIdx(idx)}
                  className={`rounded border px-3 py-2 font-mono text-xs transition-colors ${
                    selectedTokenIdx === idx
                      ? 'border-[#38BDF8] bg-[#38BDF8]/15 text-white'
                      : 'border-white/[0.08] bg-[#07090E] text-slate-300 hover:border-white/20'
                  }`}
                >
                  {tm.token}
                </button>
              ))}
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <div className="rounded border border-white/[0.08] bg-[#07090E] p-4">
                <span className="font-mono text-[11px] uppercase text-slate-400">
                  Predictive Entropy (Illustrative)
                </span>
                <p className="mt-1 font-mono text-2xl font-semibold text-white tabular-nums">
                  {tokenMetrics[selectedTokenIdx].entropy.toFixed(2)} <span className="text-xs text-slate-400">bits</span>
                </p>
              </div>
              <div className="rounded border border-white/[0.08] bg-[#07090E] p-4">
                <span className="font-mono text-[11px] uppercase text-slate-400">
                  Residual L2 Norm (Illustrative)
                </span>
                <p className="mt-1 font-mono text-2xl font-semibold text-white tabular-nums">
                  {tokenMetrics[selectedTokenIdx].norm.toFixed(1)}
                </p>
              </div>
              <div className="rounded border border-white/[0.08] bg-[#07090E] p-4">
                <span className="font-mono text-[11px] uppercase text-slate-400">
                  Top-1 Token Probability (Illustrative)
                </span>
                <p className="mt-1 font-mono text-2xl font-semibold text-[#38BDF8] tabular-nums">
                  {(tokenMetrics[selectedTokenIdx].topProb * 100).toFixed(0)}%
                </p>
              </div>
            </div>
          </div>
        )}

        {mode === 'hidden-states' && (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h4 className="font-display text-sm font-semibold text-white">
                Illustrative Hidden-State Comparison: Pretrained Base vs. Post-Trained Checkpoint
              </h4>
              <span className="font-mono text-xs text-slate-400">
                Cosine Similarity Trajectory
              </span>
            </div>

            <div className="overflow-x-auto rounded border border-white/[0.06] bg-[#07090E] p-4">
              <svg viewBox="0 0 640 180" className="h-auto w-full min-w-[460px]">
                <line x1="40" y1="20" x2="620" y2="20" stroke="rgba(255,255,255,0.06)" />
                <line x1="40" y1="80" x2="620" y2="80" stroke="rgba(255,255,255,0.06)" />
                <line x1="40" y1="140" x2="620" y2="140" stroke="rgba(255,255,255,0.06)" />
                <text x="8" y="24" fill="#64748B" fontSize="10" fontFamily="IBM Plex Mono">1.00</text>
                <text x="8" y="84" fill="#64748B" fontSize="10" fontFamily="IBM Plex Mono">0.85</text>
                <text x="8" y="144" fill="#64748B" fontSize="10" fontFamily="IBM Plex Mono">0.70</text>

                {/* Base vs SFT illustrative curve */}
                <polyline
                  fill="none"
                  stroke="#38BDF8"
                  strokeWidth="2"
                  points="45,26 120,30 195,38 270,48 345,62 420,84 495,108 570,122 615,128"
                />
                {/* Teacher vs Student distillation illustrative curve */}
                <polyline
                  fill="none"
                  stroke="#818CF8"
                  strokeWidth="2"
                  strokeDasharray="5 4"
                  points="45,40 120,46 195,55 270,64 345,76 420,92 495,98 570,104 615,108"
                />

                <text x="45" y="168" fill="#64748B" fontSize="10" fontFamily="IBM Plex Mono">Layer 01</text>
                <text x="315" y="168" fill="#64748B" fontSize="10" fontFamily="IBM Plex Mono">Middle Layers</text>
                <text x="565" y="168" fill="#64748B" fontSize="10" fontFamily="IBM Plex Mono">Final Layer</text>
              </svg>
            </div>
            <div className="flex flex-wrap gap-6 text-xs text-slate-400">
              <span className="inline-flex items-center gap-2">
                <span className="h-0.5 w-5 bg-[#38BDF8]" />
                Solid: Base vs. Post-Trained Checkpoint (Illustrative)
              </span>
              <span className="inline-flex items-center gap-2">
                <span className="h-0.5 w-5 border-t-2 border-dashed border-[#818CF8]" />
                Dashed: Teacher vs. Distilled Student Alignment (Illustrative)
              </span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

"use client";

import { useState } from "react";

type NavSection = "build" | "data" | "train" | "evaluate" | "deploy" | "agents";

interface NodeData {
  id: string;
  type: string;
  x: number;
  y: number;
  width: number;
  headerColor: string;
  headerText: string;
  icon: string;
}

const NODES: NodeData[] = [
  { id: "input", type: "Input Tokens", x: 40, y: 180, width: 200, headerColor: "#16a34a", headerText: "#4ade80", icon: "📄" },
  { id: "embed", type: "Embedding (Positional)", x: 260, y: 160, width: 210, headerColor: "#7c3aed", headerText: "#a78bfa", icon: "🔢" },
  { id: "attn", type: "Multi-Head Attention", x: 490, y: 80, width: 260, headerColor: "#8b5cf6", headerText: "#c4b5fd", icon: "🎧" },
  { id: "ff", type: "Feed Forward", x: 780, y: 120, width: 200, headerColor: "#3b82f6", headerText: "#93c5fd", icon: "⚡" },
  { id: "norm", type: "Layer Norm", x: 780, y: 320, width: 200, headerColor: "#10b981", headerText: "#6ee7b7", icon: "📊" },
  { id: "output", type: "Model Output", x: 1020, y: 180, width: 200, headerColor: "#dc2626", headerText: "#fca5a5", icon: "📤" },
];

export default function Dashboard() {
  const [activeSection, setActiveSection] = useState<NavSection>("build");
  const [selectedNode, setSelectedNode] = useState<string>("Multi-Head Attention");
  const [zoom, setZoom] = useState(100);

  const navItems: { id: NavSection; label: string }[] = [
    { id: "build", label: "Build" },
    { id: "data", label: "Data" },
    { id: "train", label: "Train" },
    { id: "evaluate", label: "Evaluate" },
    { id: "deploy", label: "Deploy" },
    { id: "agents", label: "Agents" },
  ];

  return (
    <div className="flex flex-col h-screen bg-[#0d0d12] text-[#e8e8f0] select-none">
      {/* Top Navigation */}
      <header className="flex items-center px-4 h-12 bg-[#14141c] border-b border-[#2a2a38] gap-4 shrink-0">
        <div className="flex items-center gap-2 font-semibold text-[15px]">
          <span className="text-lg">🧠</span>
          <span>ThinkNet</span>
        </div>

        <nav className="flex gap-0.5 flex-1 ml-4">
          {navItems.map((item) => (
            <button
              key={item.id}
              onClick={() => setActiveSection(item.id)}
              className={`px-4 py-1.5 rounded-md text-sm font-medium transition-all ${
                activeSection === item.id
                  ? "text-white bg-[rgba(124,92,252,0.18)] border-b-2 border-[#7c5cfc]"
                  : "text-[#a0a0b0] hover:text-white hover:bg-white/5"
              }`}
            >
              {item.label}
            </button>
          ))}
        </nav>

        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5 px-3 py-1.5 bg-[#1a1a24] border border-[#2a2a38] rounded-md text-xs cursor-pointer">
            <span className="text-[#a0a0b0]">▣</span>
            <span>Transformer-XL / Draft v2</span>
            <svg width="10" height="10" viewBox="0 0 12 12" className="opacity-60">
              <path d="M3 4.5L6 7.5L9 4.5" stroke="currentColor" fill="none" strokeWidth="1.5" />
            </svg>
          </div>
          <button className="w-8 h-8 rounded-md hover:bg-white/8 text-[#a0a0b0] hover:text-white text-sm">🌙</button>
          <button className="w-8 h-8 rounded-md hover:bg-white/8 text-[#a0a0b0] hover:text-white text-sm">⚙️</button>
          <button className="w-8 h-8 rounded-md hover:bg-white/8 text-[#a0a0b0] hover:text-white text-sm">👤</button>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        {/* Left Sidebar */}
        <aside className="w-12 bg-[#14141c] border-r border-[#2a2a38] flex flex-col items-center py-3 gap-1 shrink-0">
          {["🚀", "➕", "📦", "🔗", "🔧"].map((icon, i) => (
            <button
              key={i}
              className={`w-9 h-9 rounded-lg text-base transition-colors flex items-center justify-center ${
                i === 0
                  ? "bg-[rgba(124,92,252,0.2)] text-[#7c5cfc]"
                  : "text-[#a0a0b0] hover:bg-[rgba(124,92,252,0.15)] hover:text-[#7c5cfc]"
              }`}
            >
              {icon}
            </button>
          ))}
          <div className="flex-1" />
          <button className="w-9 h-9 rounded-lg text-[#a0a0b0] hover:bg-white/5 text-sm">⊞</button>
          <button className="w-9 h-9 rounded-lg text-[#a0a0b0] hover:bg-white/5 text-sm">☰</button>
        </aside>

        {/* Main Canvas */}
        <main
          className="flex-1 relative overflow-hidden"
          style={{
            backgroundImage: "radial-gradient(circle at 1px 1px, #2a2a38 1px, transparent 0)",
            backgroundSize: "24px 24px",
            backgroundColor: "#0f0f16",
          }}
        >
          {/* Toolbar */}
          <div className="absolute top-3 left-3 right-3 flex items-center gap-2 z-20 pointer-events-none">
            <div className="pointer-events-auto flex items-center gap-1.5 bg-[#1a1a24]/90 backdrop-blur border border-[#2a2a38] rounded-md px-3 py-1.5 text-xs">
              <span className="opacity-60">◀</span>
              <span>Models / GPT-Small / Main Architecture</span>
              <span className="w-1.5 h-1.5 bg-[#22c55e] rounded-full shadow-[0_0_6px_#22c55e] ml-1" />
            </div>
            <div className="pointer-events-auto flex items-center gap-1.5 bg-[#1a1a24]/90 backdrop-blur border border-[#2a2a38] rounded-md px-3 py-1.5 text-xs">
              <span className="opacity-70">▣</span>
              <span>Template: Tiny Transformer</span>
              <svg width="10" height="10" viewBox="0 0 12 12" className="opacity-60">
                <path d="M3 4.5L6 7.5L9 4.5" stroke="currentColor" fill="none" strokeWidth="1.5" />
              </svg>
            </div>
            <div className="pointer-events-auto flex items-center gap-1 bg-[#1a1a24]/90 backdrop-blur border border-[#2a2a38] rounded-md px-1.5 py-1 text-xs ml-auto">
              <button onClick={() => setZoom((z) => Math.max(50, z - 10))} className="w-6 h-6 hover:bg-white/10 rounded flex items-center justify-center">−</button>
              <span className="w-10 text-center">{zoom}%</span>
              <button onClick={() => setZoom((z) => Math.min(200, z + 10))} className="w-6 h-6 hover:bg-white/10 rounded flex items-center justify-center">+</button>
            </div>
            <button className="pointer-events-auto bg-[#7c5cfc] hover:bg-[#6d4de6] text-white px-3 py-1.5 rounded-md text-xs font-medium flex items-center gap-1.5 ml-2">
              + Add Node <kbd className="bg-white/20 px-1 py-0.5 rounded text-[10px]">Shift+A</kbd>
            </button>
          </div>

          {/* Graph with connections */}
          <div className="absolute inset-0" style={{ transform: `scale(${zoom / 100})`, transformOrigin: "0 0" }}>
            {/* SVG Connections */}
            <svg className="absolute inset-0 w-full h-full pointer-events-none" style={{ zIndex: 1 }}>
              {/* Input → Embedding */}
              <path d="M 240 210 C 260 210, 250 200, 260 190" stroke="#22c55e" strokeWidth="2" fill="none" opacity="0.8" />
              <circle cx="240" cy="210" r="4" fill="#22c55e" />
              <circle cx="260" cy="190" r="4" fill="#22c55e" />

              {/* Embedding → Attention */}
              <path d="M 470 190 C 490 190, 480 160, 490 150" stroke="#a78bfa" strokeWidth="2" fill="none" opacity="0.8" />
              <circle cx="470" cy="190" r="4" fill="#a78bfa" />
              <circle cx="490" cy="150" r="4" fill="#a78bfa" />

              {/* Attention → FF */}
              <path d="M 750 150 C 770 150, 760 160, 780 170" stroke="#22c55e" strokeWidth="2" fill="none" opacity="0.8" />
              <circle cx="750" cy="150" r="4" fill="#22c55e" />
              <circle cx="780" cy="170" r="4" fill="#22c55e" />

              {/* Attention → Norm */}
              <path d="M 750 280 C 770 280, 760 360, 780 370" stroke="#a78bfa" strokeWidth="2" fill="none" opacity="0.7" />
              <circle cx="750" cy="280" r="4" fill="#a78bfa" />
              <circle cx="780" cy="370" r="4" fill="#a78bfa" />

              {/* FF → Output */}
              <path d="M 980 170 C 1000 170, 990 220, 1020 230" stroke="#22c55e" strokeWidth="2" fill="none" opacity="0.8" />
              <circle cx="980" cy="170" r="4" fill="#22c55e" />
              <circle cx="1020" cy="230" r="4" fill="#22c55e" />

              {/* Norm → Output */}
              <path d="M 980 370 C 1000 370, 990 280, 1020 260" stroke="#a78bfa" strokeWidth="2" fill="none" opacity="0.7" />
              <circle cx="980" cy="370" r="4" fill="#a78bfa" />
              <circle cx="1020" cy="260" r="4" fill="#a78bfa" />
            </svg>

            {/* Nodes */}
            {NODES.map((node) => (
              <div
                key={node.id}
                onClick={() => setSelectedNode(node.type)}
                className={`absolute bg-[#1e1e2a] border rounded-xl shadow-xl overflow-hidden cursor-pointer transition-all ${
                  selectedNode === node.type
                    ? "border-[#7c5cfc] shadow-[0_0_0_2px_rgba(124,92,252,0.35),0_8px_32px_rgba(0,0,0,0.5)]"
                    : "border-[#2a2a38] hover:border-[#3a3a48]"
                }`}
                style={{ left: node.x, top: node.y, width: node.width, zIndex: 2 }}
              >
                <div
                  className="px-3 py-2 font-semibold text-[13px] border-b border-[#2a2a38] flex items-center gap-1.5"
                  style={{
                    background: `linear-gradient(90deg, ${node.headerColor}22, transparent)`,
                    color: node.headerText,
                  }}
                >
                  <span className="text-sm">{node.icon}</span>
                  {node.type}
                </div>

                <div className="p-2.5 text-[11px] space-y-1.5">
                  {node.id === "input" && (
                    <>
                      <div className="flex justify-between items-center">
                        <span className="text-[#a0a0b0]">Vocab size</span>
                        <input defaultValue="50,257" className="w-[70px] text-right bg-[#0d0d12] border border-[#2a2a38] rounded px-1.5 py-0.5" />
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-[#a0a0b0]">Sequence length</span>
                        <input defaultValue="1,024" className="w-[70px] text-right bg-[#0d0d12] border border-[#2a2a38] rounded px-1.5 py-0.5" />
                      </div>
                      <div className="text-[#a0a0b0] pt-0.5">Type: Discrete <span className="text-[#22c55e] font-medium ml-1">Tokens →</span></div>
                    </>
                  )}

                  {node.id === "embed" && (
                    <>
                      <div className="flex justify-between items-center">
                        <span className="text-[#a0a0b0]">Dimension</span>
                        <input defaultValue="768" className="w-[70px] text-right bg-[#0d0d12] border border-[#2a2a38] rounded px-1.5 py-0.5" />
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-[#a0a0b0]">Type</span>
                        <span className="bg-[#1a1a24] px-1.5 py-0.5 rounded text-[10px]">Learned positional</span>
                      </div>
                      <div className="text-[#a0a0b0] pt-0.5">Matrix: Wₑ <span className="text-[#22c55e] font-medium ml-1">Tensors →</span></div>
                    </>
                  )}

                  {node.id === "attn" && (
                    <>
                      <div className="flex justify-between items-center">
                        <span className="text-[#a0a0b0]">Heads</span>
                        <input defaultValue="8" className="w-12 text-right bg-[#0d0d12] border border-[#2a2a38] rounded px-1.5 py-0.5" />
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-[#a0a0b0]">Key size</span>
                        <input defaultValue="64" className="w-12 text-right bg-[#0d0d12] border border-[#2a2a38] rounded px-1.5 py-0.5" />
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-[#a0a0b0]">Dropout</span>
                        <input defaultValue="0.10" className="w-12 text-right bg-[#0d0d12] border border-[#2a2a38] rounded px-1.5 py-0.5" />
                      </div>
                      <div className="text-[#a0a0b0] text-[10px] leading-tight mt-1">Advanced Parameters (Masking, FlashAttn)</div>
                      <div className="text-[#a0a0b0] text-[10px] leading-relaxed">Concept: Lets the model focus on important words across the sequence simultaneously.</div>
                      <div className="text-[#a0a0b0] pt-0.5">Softmax Distribution <span className="text-orange-400 font-medium ml-1">Predictions →</span></div>
                    </>
                  )}

                  {node.id === "ff" && (
                    <>
                      <div className="flex justify-between items-center">
                        <span className="text-[#a0a0b0]">Hidden dim</span>
                        <input defaultValue="3,072" className="w-16 text-right bg-[#0d0d12] border border-[#2a2a38] rounded px-1.5 py-0.5" />
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-[#a0a0b0]">Activation</span>
                        <span className="bg-[#1a1a24] px-1.5 py-0.5 rounded text-[10px]">GELU</span>
                      </div>
                      <div className="text-[#a0a0b0] pt-0.5">Expansion: 4x <span className="text-[#22c55e] font-medium ml-1">Tensors →</span></div>
                    </>
                  )}

                  {node.id === "norm" && (
                    <>
                      <div className="flex justify-between items-center">
                        <span className="text-[#a0a0b0]">Epsilon (ε)</span>
                        <input defaultValue="1e-5" className="w-14 text-right bg-[#0d0d12] border border-[#2a2a38] rounded px-1.5 py-0.5" />
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-[#a0a0b0]">Residual flow</span>
                        <span className="bg-[#1a1a24] px-1.5 py-0.5 rounded text-[10px]">Pre-LN (Add)</span>
                      </div>
                      <div className="text-[#a0a0b0] pt-0.5">Stabilized <span className="text-[#22c55e] font-medium ml-1">Tensors →</span></div>
                    </>
                  )}

                  {node.id === "output" && (
                    <>
                      <div className="flex justify-between items-center">
                        <span className="text-[#a0a0b0]">Target</span>
                        <span className="bg-[#1a1a24] px-1.5 py-0.5 rounded text-[10px]">All ▾</span>
                      </div>
                      <div className="text-[10px] text-[#a0a0b0] space-y-0.5 mt-1">
                        <div>Logits Head</div>
                        <div>Aux Loss</div>
                        <div>Hidden States</div>
                        <div>Perplexity</div>
                      </div>
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>
        </main>

        {/* Right Panels */}
        <aside className="w-[300px] bg-[#14141c] border-l border-[#2a2a38] flex flex-col overflow-y-auto shrink-0">
          {/* Project */}
          <div className="border-b border-[#2a2a38]">
            <div className="flex justify-between items-center px-4 py-2.5 font-semibold text-[13px]">
              <div className="flex items-center gap-1.5">
                <span className="text-sm">📁</span> Project
              </div>
              <div className="flex gap-1 text-[#a0a0b0]">
                <button className="hover:text-white text-xs">×</button>
                <button className="hover:text-white text-xs">≡</button>
              </div>
            </div>
            <div className="px-3 pb-2">
              <input
                type="text"
                placeholder="Filter hierarchy..."
                className="w-full bg-[#0d0d12] border border-[#2a2a38] rounded-md px-2.5 py-1.5 text-xs placeholder:text-[#606070]"
              />
            </div>
            <div className="px-3 pb-3 text-xs">
              <div className="flex justify-between items-center text-[#a0a0b0] font-medium py-1.5">
                <span className="flex items-center gap-1">📁 Models</span>
                <span>2</span>
              </div>
              <div className="flex justify-between items-center px-2 py-1 rounded bg-[rgba(124,92,252,0.15)]">
                <span className="flex items-center gap-1.5"><span className="w-1.5 h-1.5 rounded-full bg-[#7c5cfc]" /> GPT-Small</span>
                <span className="bg-[#7c5cfc] text-white text-[10px] px-1.5 py-0.5 rounded-full">Active</span>
              </div>
              <div className="flex justify-between items-center px-2 py-1 rounded hover:bg-white/5">
                <span className="flex items-center gap-1.5"><span className="w-1.5 h-1.5 rounded-full bg-[#606070]" /> Vision-Tiny</span>
                <span className="text-[#a0a0b0]">Draft</span>
              </div>
              <div className="flex items-center gap-1 text-[#a0a0b0] font-medium pt-2 pb-1">
                <span>📁</span> Datasets
              </div>
              <div className="flex justify-between px-2 py-1 hover:bg-white/5 rounded">
                <span className="flex items-center gap-1.5"><span className="w-1.5 h-1.5 rounded-full bg-[#22c55e]" /> OpenWebText-Sample</span>
                <span className="text-[#a0a0b0]">120k</span>
              </div>
              <div className="flex justify-between px-2 py-1 hover:bg-white/5 rounded">
                <span className="flex items-center gap-1.5"><span className="w-1.5 h-1.5 rounded-full bg-[#606070]" /> BookCorpus-Mini</span>
                <span className="text-[#a0a0b0]">45k</span>
              </div>
            </div>
          </div>

          {/* Properties */}
          <div>
            <div className="flex justify-between items-center px-4 py-2.5 font-semibold text-[13px] border-b border-[#2a2a38]">
              <div className="flex items-center gap-1.5">
                <span className="text-sm">⚙️</span> Properties
              </div>
              <span className="text-[11px] text-[#a0a0b0] font-normal">Node #3</span>
            </div>

            <div className="px-4 py-2.5">
              <label className="text-[11px] text-[#a0a0b0] block mb-1">Node Label</label>
              <input value={selectedNode} readOnly className="w-full bg-[#0d0d12] border border-[#2a2a38] rounded px-2.5 py-1.5 text-sm font-medium" />
            </div>

            <div className="px-4 py-2 border-t border-[#2a2a38]">
              <div className="flex justify-between text-[11px] text-[#a0a0b0] mb-2">
                <span className="flex items-center gap-1">▼ Basics</span>
                <span>Primary controls</span>
              </div>
              <div className="space-y-2.5 text-xs">
                <div className="flex justify-between items-center">
                  <span>Number of heads</span>
                  <div className="flex items-center gap-0.5">
                    <button className="w-5 h-5 bg-[#1a1a24] border border-[#2a2a38] rounded text-xs hover:bg-white/10">−</button>
                    <input defaultValue="8" className="w-8 text-center bg-[#0d0d12] border border-[#2a2a38] rounded py-0.5 text-xs" />
                    <button className="w-5 h-5 bg-[#1a1a24] border border-[#2a2a38] rounded text-xs hover:bg-white/10">+</button>
                  </div>
                </div>
                <div className="flex justify-between items-center">
                  <span>Dimension per head</span>
                  <input defaultValue="64" className="w-12 text-right bg-[#0d0d12] border border-[#2a2a38] rounded px-1.5 py-0.5 text-xs" />
                </div>
                <div className="flex justify-between items-center">
                  <span>Dropout rate</span>
                  <div className="flex items-center gap-1.5">
                    <input type="range" min="0" max="1" step="0.01" defaultValue="0.1" className="w-20 accent-[#7c5cfc]" />
                    <span className="text-[11px] w-8">0.10</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="px-4 py-2 border-t border-[#2a2a38]">
              <div className="flex justify-between text-[11px] text-[#a0a0b0]">
                <span className="flex items-center gap-1">▶ Advanced settings</span>
                <span>Rotary / Bias</span>
              </div>
            </div>

            <div className="mx-3 my-2 p-2.5 bg-[rgba(124,92,252,0.06)] border border-[rgba(124,92,252,0.25)] rounded-lg">
              <div className="text-[11px] font-semibold text-[#7c5cfc] mb-1 flex items-center gap-1">
                <span>💡</span> Plain Explanation
              </div>
              <p className="text-[11px] text-[#a0a0b0] leading-relaxed">
                Allows tokens to attend to other tokens in parallel representation subspaces, learning contextual relationships across your sequence.
              </p>
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}

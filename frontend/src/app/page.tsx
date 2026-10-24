"use client";

import { useState } from "react";

type NavSection = "build" | "data" | "train" | "evaluate" | "deploy" | "agents";

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
    <div className="flex flex-col h-screen bg-[#0d0d12] text-[#e8e8f0]">
      {/* Top Navigation */}
      <header className="flex items-center px-4 h-12 bg-[#14141c] border-b border-[#2a2a38] gap-6">
        <div className="flex items-center gap-2 font-semibold text-base">
          <span className="text-xl">🧠</span>
          <span>ThinkNet</span>
        </div>

        <nav className="flex gap-1 flex-1">
          {navItems.map((item) => (
            <button
              key={item.id}
              onClick={() => setActiveSection(item.id)}
              className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                activeSection === item.id
                  ? "text-white bg-[rgba(124,92,252,0.15)] border-b-2 border-[#7c5cfc]"
                  : "text-[#a0a0b0] hover:text-white hover:bg-white/5"
              }`}
            >
              {item.label}
            </button>
          ))}
        </nav>

        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5 px-3 py-1.5 bg-[#1a1a24] border border-[#2a2a38] rounded-md text-sm cursor-pointer">
            <span>Transformer-XL / Draft v2</span>
            <svg width="12" height="12" viewBox="0 0 12 12">
              <path d="M3 4.5L6 7.5L9 4.5" stroke="currentColor" fill="none" />
            </svg>
          </div>
          <button className="w-8 h-8 rounded-md hover:bg-white/8 text-[#a0a0b0] hover:text-white">🌙</button>
          <button className="w-8 h-8 rounded-md hover:bg-white/8 text-[#a0a0b0] hover:text-white">⚙️</button>
          <button className="w-8 h-8 rounded-md hover:bg-white/8 text-[#a0a0b0] hover:text-white">👤</button>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        {/* Left Sidebar */}
        <aside className="w-12 bg-[#14141c] border-r border-[#2a2a38] flex flex-col items-center py-3 gap-2">
          {["🚀", "➕", "📦", "🔗", "🔧"].map((icon, i) => (
            <button
              key={i}
              className={`w-9 h-9 rounded-lg text-lg transition-colors ${
                i === 0
                  ? "bg-[rgba(124,92,252,0.2)] text-[#7c5cfc]"
                  : "text-[#a0a0b0] hover:bg-[rgba(124,92,252,0.2)] hover:text-[#7c5cfc]"
              }`}
            >
              {icon}
            </button>
          ))}
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
          <div className="absolute top-3 left-3 right-3 flex items-center gap-3 z-10">
            <div className="flex items-center gap-1.5 bg-[#1a1a24] border border-[#2a2a38] rounded-md px-3 py-1.5 text-sm">
              <span>Models / GPT-Small / Main Architecture</span>
              <span className="w-2 h-2 bg-[#22c55e] rounded-full shadow-[0_0_8px_#22c55e]" />
            </div>
            <div className="flex items-center gap-1.5 bg-[#1a1a24] border border-[#2a2a38] rounded-md px-3 py-1.5 text-sm">
              <span>Template: Tiny Transformer</span>
              <svg width="12" height="12" viewBox="0 0 12 12">
                <path d="M3 4.5L6 7.5L9 4.5" stroke="currentColor" fill="none" />
              </svg>
            </div>
            <div className="flex items-center gap-2 bg-[#1a1a24] border border-[#2a2a38] rounded-md px-2 py-1 text-sm">
              <button onClick={() => setZoom(Math.max(50, zoom - 10))} className="w-6 h-6 hover:bg-white/10 rounded">-</button>
              <span>{zoom}%</span>
              <button onClick={() => setZoom(Math.min(200, zoom + 10))} className="w-6 h-6 hover:bg-white/10 rounded">+</button>
            </div>
            <button className="ml-auto bg-[#7c5cfc] text-white px-4 py-2 rounded-md font-medium flex items-center gap-2">
              + Add Node <kbd className="bg-white/20 px-1.5 py-0.5 rounded text-xs">Shift+A</kbd>
            </button>
          </div>

          {/* Node Graph */}
          <div
            className="absolute inset-0 origin-top-left"
            style={{ transform: `scale(${zoom / 100})` }}
          >
            {/* Input Tokens */}
            <div
              onClick={() => setSelectedNode("Input Tokens")}
              className={`absolute w-[220px] bg-[#1e1e2a] border rounded-xl shadow-lg overflow-hidden cursor-pointer ${
                selectedNode === "Input Tokens" ? "border-[#7c5cfc] shadow-[0_0_0_2px_rgba(124,92,252,0.3)]" : "border-[#2a2a38]"
              }`}
              style={{ left: 40, top: 180 }}
            >
              <div className="px-3.5 py-2.5 font-semibold text-sm border-b border-[#2a2a38] bg-gradient-to-r from-[#16a34a22] to-transparent text-[#4ade80]">
                Input Tokens
              </div>
              <div className="p-3 text-xs space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-[#a0a0b0]">Vocab size</span>
                  <input defaultValue="50257" className="w-20 text-right bg-[#0d0d12] border border-[#2a2a38] rounded px-2 py-1 text-xs" />
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-[#a0a0b0]">Sequence length</span>
                  <input defaultValue="1024" className="w-20 text-right bg-[#0d0d12] border border-[#2a2a38] rounded px-2 py-1 text-xs" />
                </div>
                <div className="text-[#a0a0b0] text-[11px]">Type: Discrete <span className="text-[#22c55e] font-medium">Tokens →</span></div>
              </div>
            </div>

            {/* Embedding */}
            <div
              onClick={() => setSelectedNode("Embedding (Positional)")}
              className={`absolute w-[220px] bg-[#1e1e2a] border rounded-xl shadow-lg overflow-hidden cursor-pointer ${
                selectedNode === "Embedding (Positional)" ? "border-[#7c5cfc] shadow-[0_0_0_2px_rgba(124,92,252,0.3)]" : "border-[#2a2a38]"
              }`}
              style={{ left: 220, top: 160 }}
            >
              <div className="px-3.5 py-2.5 font-semibold text-sm border-b border-[#2a2a38] bg-gradient-to-r from-[#7c3aed22] to-transparent text-[#a78bfa]">
                Embedding (Positional)
              </div>
              <div className="p-3 text-xs space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-[#a0a0b0]">Dimension</span>
                  <input defaultValue="768" className="w-20 text-right bg-[#0d0d12] border border-[#2a2a38] rounded px-2 py-1 text-xs" />
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-[#a0a0b0]">Type</span>
                  <span className="bg-[#1a1a24] px-2 py-0.5 rounded text-[11px]">Learned positional</span>
                </div>
                <div className="text-[#a0a0b0] text-[11px]">Matrix: Wₑ <span className="text-[#22c55e] font-medium">Tensors →</span></div>
              </div>
            </div>

            {/* Multi-Head Attention */}
            <div
              onClick={() => setSelectedNode("Multi-Head Attention")}
              className={`absolute w-[260px] bg-[#1e1e2a] border rounded-xl shadow-lg overflow-hidden cursor-pointer ${
                selectedNode === "Multi-Head Attention" ? "border-[#7c5cfc] shadow-[0_0_0_2px_rgba(124,92,252,0.3)]" : "border-[#2a2a38]"
              }`}
              style={{ left: 420, top: 100 }}
            >
              <div className="px-3.5 py-2.5 font-semibold text-sm border-b border-[#2a2a38] bg-gradient-to-r from-[#8b5cf622] to-transparent text-[#c4b5fd]">
                Multi-Head Attention
              </div>
              <div className="p-3 text-xs space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-[#a0a0b0]">Heads</span>
                  <input defaultValue="8" className="w-16 text-right bg-[#0d0d12] border border-[#2a2a38] rounded px-2 py-1 text-xs" />
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-[#a0a0b0]">Key size</span>
                  <input defaultValue="64" className="w-16 text-right bg-[#0d0d12] border border-[#2a2a38] rounded px-2 py-1 text-xs" />
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-[#a0a0b0]">Dropout</span>
                  <input defaultValue="0.10" className="w-16 text-right bg-[#0d0d12] border border-[#2a2a38] rounded px-2 py-1 text-xs" />
                </div>
                <div className="text-[#a0a0b0] text-[11px] mt-1">Advanced Parameters (Masking, FlashAttn)</div>
                <div className="text-[#a0a0b0] text-[11px] leading-relaxed">Concept: Lets the model focus on important words across the sequence simultaneously.</div>
                <div className="text-[#a0a0b0] text-[11px]">Softmax Distribution <span className="text-[#22c55e] font-medium">Predictions →</span></div>
              </div>
            </div>
          </div>
        </main>

        {/* Right Panels */}
        <aside className="w-80 bg-[#14141c] border-l border-[#2a2a38] flex flex-col overflow-y-auto">
          {/* Project Panel */}
          <div className="border-b border-[#2a2a38]">
            <div className="flex justify-between items-center px-4 py-3 font-semibold text-sm">
              <span>Project</span>
              <div className="flex gap-1">
                <button className="text-[#a0a0b0]">×</button>
                <button className="text-[#a0a0b0]">≡</button>
              </div>
            </div>
            <div className="px-4 pb-3">
              <input
                type="text"
                placeholder="Filter hierarchy..."
                className="w-full bg-[#0d0d12] border border-[#2a2a38] rounded-md px-3 py-2 text-sm"
              />
            </div>
            <div className="px-4 pb-4 text-sm">
              <div className="flex justify-between text-[#a0a0b0] font-medium my-2">Models <span>2</span></div>
              <div className="flex justify-between items-center px-2 py-1.5 rounded bg-[rgba(124,92,252,0.15)]">
                GPT-Small <span className="bg-[#7c5cfc] text-white text-[11px] px-2 py-0.5 rounded-full">Active</span>
              </div>
              <div className="flex justify-between items-center px-2 py-1.5 rounded hover:bg-white/5">
                Vision-Tiny <span className="text-[#a0a0b0] text-xs">Draft</span>
              </div>
              <div className="text-[#a0a0b0] font-medium mt-3 mb-1">Datasets</div>
              <div className="flex justify-between px-2 py-1.5 hover:bg-white/5 rounded">OpenWebText-Sample <span className="text-[#a0a0b0]">120k</span></div>
              <div className="flex justify-between px-2 py-1.5 hover:bg-white/5 rounded">BookCorpus-Mini <span className="text-[#a0a0b0]">45k</span></div>
            </div>
          </div>

          {/* Properties Panel */}
          <div className="border-b border-[#2a2a38]">
            <div className="flex justify-between items-center px-4 py-3 font-semibold text-sm">
              <span>Properties</span>
              <span className="text-xs text-[#a0a0b0]">Node #3</span>
            </div>
            <div className="px-4 pb-3">
              <label className="text-xs text-[#a0a0b0] block mb-1">Node Label</label>
              <input value={selectedNode} readOnly className="w-full bg-[#0d0d12] border border-[#2a2a38] rounded px-3 py-2 text-sm" />
            </div>
            <div className="px-4 py-3 border-t border-[#2a2a38]">
              <div className="flex justify-between text-xs text-[#a0a0b0] mb-2">
                <span>Basics</span>
                <span>Primary controls</span>
              </div>
              <div className="space-y-3 text-sm">
                <div className="flex justify-between items-center">
                  <span>Number of heads</span>
                  <div className="flex items-center gap-1">
                    <button className="w-6 h-6 bg-[#1a1a24] border border-[#2a2a38] rounded">-</button>
                    <input defaultValue="8" className="w-10 text-center bg-[#0d0d12] border border-[#2a2a38] rounded py-1" />
                    <button className="w-6 h-6 bg-[#1a1a24] border border-[#2a2a38] rounded">+</button>
                  </div>
                </div>
                <div className="flex justify-between items-center">
                  <span>Dimension per head</span>
                  <input defaultValue="64" className="w-16 text-right bg-[#0d0d12] border border-[#2a2a38] rounded px-2 py-1" />
                </div>
                <div className="flex justify-between items-center">
                  <span>Dropout rate</span>
                  <div className="flex items-center gap-2">
                    <input type="range" min="0" max="1" step="0.01" defaultValue="0.1" className="w-24" />
                    <span className="text-xs">0.10</span>
                  </div>
                </div>
              </div>
            </div>
            <div className="px-4 py-3 border-t border-[#2a2a38]">
              <div className="flex justify-between text-xs text-[#a0a0b0]">
                <span>Advanced settings</span>
                <span>Rotary / Bias</span>
              </div>
            </div>
            <div className="m-3 p-3 bg-[rgba(124,92,252,0.05)] border border-[rgba(124,92,252,0.2)] rounded-lg">
              <div className="text-xs font-semibold text-[#7c5cfc] mb-1.5">Plain Explanation</div>
              <p className="text-xs text-[#a0a0b0] leading-relaxed">
                Allows tokens to attend to other tokens in parallel representation subspaces, learning contextual relationships across your sequence.
              </p>
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}

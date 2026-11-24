import { useMemo, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { ArrowRight, ChevronDown, ChevronUp } from 'lucide-react';
import {
  benchmarkDimensions,
  benchmarkRecordedFields,
  developmentPhases,
  engineeringPrinciples,
  researchQuestions,
  trainingMechanisms,
} from '../../data/research/register';
import { getDivisionById } from '../../data/infrastructure/divisions';
import { getFamilyBySlug } from '../../data/environments';
import { ResearchImage } from '../../components/shared/ResearchImage';
import { visualAssets } from '../../data/visualAssets';

type ResearchSection = 'overview' | 'register' | 'training' | 'evaluation' | 'roadmap';

const subTabs: Array<{ id: ResearchSection; label: string; to: string }> = [
  { id: 'overview', label: 'Research Overview', to: '/research' },
  { id: 'register', label: 'Research Register (15)', to: '/research/register' },
  { id: 'training', label: 'Training & Learning Systems', to: '/research/training' },
  { id: 'evaluation', label: 'Evaluation & Benchmarking', to: '/research/evaluation' },
  { id: 'roadmap', label: 'Development & Principles', to: '/research/roadmap' },
];

export function ResearchHubPage({ section = 'overview' }: { section?: ResearchSection }) {
  const location = useLocation();
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [expandedQuestionId, setExpandedQuestionId] = useState<string | null>(null);

  const categories = useMemo(() => {
    const cats = Array.from(new Set(researchQuestions.map((q) => q.category)));
    return ['All', ...cats];
  }, []);

  const filteredQuestions = useMemo(() => {
    if (selectedCategory === 'All') return researchQuestions;
    return researchQuestions.filter((q) => q.category === selectedCategory);
  }, [selectedCategory]);

  return (
    <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
      {/* Header & Sub-Navigation */}
      <header className="border-b border-white/[0.08] pb-8">
        <div className="grid grid-cols-1 gap-8 lg:grid-cols-12 items-stretch">
          <div className="lg:col-span-7 flex flex-col justify-center">
            <p className="font-mono text-xs uppercase tracking-wider text-[#38BDF8]">
              ThinkNet Research Architecture
            </p>
            <h1 className="mt-2 font-display text-3xl font-bold text-white sm:text-4xl text-balance">
              Research Directions, Training Integration &amp; Evaluation
            </h1>
            <p className="mt-3 max-w-3xl text-sm text-slate-300 sm:text-base leading-relaxed">
              Evidence-based investigation distinguishing established techniques, proposed
              hypotheses, training mechanisms, and strict benchmarking standards.
            </p>
          </div>
          <div className="lg:col-span-5 overflow-hidden rounded-lg border border-white/[0.08]">
            <ResearchImage
              src={visualAssets.families['intelligence-research'].src}
              alt={visualAssets.families['intelligence-research'].alt}
              caption="ThinkNet Research Register · Experimental Verification Standards"
              aspectClass="aspect-video lg:h-full"
            />
          </div>
        </div>

        <nav
          aria-label="Research Sections"
          className="mt-6 flex flex-wrap gap-1.5 rounded-lg border border-white/[0.08] bg-[#0B0E17] p-1.5"
        >
          {subTabs.map((tab) => {
            const active =
              tab.to === '/research'
                ? location.pathname === '/research'
                : location.pathname === tab.to;
            return (
              <Link
                key={tab.id}
                to={tab.to}
                className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
                  active
                    ? 'bg-[#3B82F6] text-white'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                {tab.label}
              </Link>
            );
          })}
        </nav>
      </header>

      {/* OVERVIEW SECTION */}
      {section === 'overview' && (
        <div className="pt-10 space-y-12">
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
            <Link
              to="/research/register"
              className="group rounded-lg border border-white/[0.08] bg-[#0B0E17] p-6 hover:border-[#3B82F6]/60"
            >
              <span className="font-mono text-xs text-[#38BDF8]">
                15 Open Research Directions
              </span>
              <h2 className="mt-2 font-display text-xl font-bold text-white group-hover:text-[#38BDF8]">
                The ThinkNet Research Register
              </h2>
              <p className="mt-2 text-sm text-slate-300 leading-relaxed">
                Maintains open scientific questions and hypotheses across data efficiency,
                cross-environment transfer, dynamic depth, KV-cache policies, and distillation. All
                entries are marked as Proposed until experimentally tested.
              </p>
              <span className="mt-4 inline-flex items-center gap-1.5 text-xs font-medium text-[#38BDF8]">
                Open Research Register <ArrowRight className="h-3.5 w-3.5" />
              </span>
            </Link>

            <Link
              to="/research/training"
              className="group rounded-lg border border-white/[0.08] bg-[#0B0E17] p-6 hover:border-[#3B82F6]/60"
            >
              <span className="font-mono text-xs text-[#38BDF8]">
                8 Learning Mechanisms
              </span>
              <h2 className="mt-2 font-display text-xl font-bold text-white group-hover:text-[#38BDF8]">
                Training &amp; Learning Systems
              </h2>
              <p className="mt-2 text-sm text-slate-300 leading-relaxed">
                Connects interactive environment execution to model weight updates via SFT,
                Reinforcement Learning, Verifiable Rewards, Preference Optimization, Distillation,
                Synthetic Data, and Curriculum Learning.
              </p>
              <span className="mt-4 inline-flex items-center gap-1.5 text-xs font-medium text-[#38BDF8]">
                Inspect Training Integration <ArrowRight className="h-3.5 w-3.5" />
              </span>
            </Link>

            <Link
              to="/research/evaluation"
              className="group rounded-lg border border-white/[0.08] bg-[#0B0E17] p-6 hover:border-[#3B82F6]/60"
            >
              <span className="font-mono text-xs text-[#38BDF8]">
                12 Evaluation Dimensions
              </span>
              <h2 className="mt-2 font-display text-xl font-bold text-white group-hover:text-[#38BDF8]">
                Evaluation &amp; Frontier Benchmarking
              </h2>
              <p className="mt-2 text-sm text-slate-300 leading-relaxed">
                Rigorous evaluation methodology under equivalent tools, budgets, and conditions—with
                explicit separation between benchmark metrics and general intelligence.
              </p>
              <span className="mt-4 inline-flex items-center gap-1.5 text-xs font-medium text-[#38BDF8]">
                View Evaluation Standards <ArrowRight className="h-3.5 w-3.5" />
              </span>
            </Link>

            <Link
              to="/research/roadmap"
              className="group rounded-lg border border-white/[0.08] bg-[#0B0E17] p-6 hover:border-[#3B82F6]/60"
            >
              <span className="font-mono text-xs text-[#38BDF8]">
                8 Phases · 10 Principles
              </span>
              <h2 className="mt-2 font-display text-xl font-bold text-white group-hover:text-[#38BDF8]">
                Development Sequence &amp; Engineering Principles
              </h2>
              <p className="mt-2 text-sm text-slate-300 leading-relaxed">
                Systematic multi-phase buildout prioritizing reusable infrastructure from Technical
                Foundation and Environment Engine through Foundation Model Research.
              </p>
              <span className="mt-4 inline-flex items-center gap-1.5 text-xs font-medium text-[#38BDF8]">
                Explore Sequence &amp; Principles <ArrowRight className="h-3.5 w-3.5" />
              </span>
            </Link>
          </div>
        </div>
      )}

      {/* RESEARCH REGISTER (15 QUESTIONS) */}
      {section === 'register' && (
        <div className="pt-10 space-y-8">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <h2 className="font-display text-2xl font-bold text-white">
                Research Register — Open Questions &amp; Hypotheses
              </h2>
              <p className="mt-1 text-sm text-slate-400">
                Every hypothesis must be tested experimentally. No proposed hypothesis is claimed as
                already validated.
              </p>
            </div>

            <div className="flex flex-wrap gap-1 rounded-lg border border-white/[0.08] bg-[#0B0E17] p-1">
              {categories.map((cat) => (
                <button
                  key={cat}
                  type="button"
                  onClick={() => setSelectedCategory(cat)}
                  className={`rounded px-2.5 py-1 text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
                    selectedCategory === cat
                      ? 'bg-[#3B82F6] text-white'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4">
            {filteredQuestions.map((rq) => {
              const expanded = expandedQuestionId === rq.id;
              return (
                <article
                  key={rq.id}
                  id={rq.id}
                  className="scroll-mt-24 rounded-lg border border-white/[0.08] bg-[#0B0E17] p-6"
                >
                  <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                    <div className="space-y-2 max-w-4xl">
                      <div className="flex flex-wrap items-center gap-2 text-xs text-slate-400">
                        <span className="font-mono text-[#38BDF8]">Question {rq.number}</span>
                        <span aria-hidden="true">·</span>
                        <span>{rq.category}</span>
                        <span aria-hidden="true">·</span>
                        <span className="font-mono text-amber-400">Status: {rq.status}</span>
                      </div>
                      <h3 className="font-display text-lg font-semibold text-white">
                        {rq.question}
                      </h3>
                      <p className="text-sm text-slate-300 leading-relaxed">{rq.objective}</p>
                    </div>

                    <button
                      type="button"
                      onClick={() => setExpandedQuestionId(expanded ? null : rq.id)}
                      className="inline-flex items-center gap-1.5 rounded border border-white/[0.1] bg-[#07090E] px-3 py-1.5 text-xs text-slate-300 hover:border-white/30 hover:text-white whitespace-nowrap shrink-0"
                    >
                      <span>{expanded ? 'Hide Experiment Scaffold' : 'Experiment Scaffold'}</span>
                      {expanded ? (
                        <ChevronUp className="h-3.5 w-3.5" />
                      ) : (
                        <ChevronDown className="h-3.5 w-3.5" />
                      )}
                    </button>
                  </div>

                  <div className="mt-4 rounded border border-white/[0.06] bg-[#07090E] px-4 py-2.5 text-xs text-slate-300">
                    <span className="font-mono text-slate-400 uppercase mr-2">
                      Future Experiment Field:
                    </span>
                    {rq.futureExperimentField}
                  </div>

                  {expanded && (
                    <div className="mt-4 grid grid-cols-1 gap-3 border-t border-white/[0.06] pt-4 sm:grid-cols-2 lg:grid-cols-4 text-xs">
                      {[
                        {
                          title: 'Hypotheses',
                          body: 'Formalized falsifiable hypothesis awaiting Phase 1–6 experimental registration.',
                        },
                        {
                          title: 'Experiments',
                          body: 'Pending controlled runs with logged configurations, compute budgets, and baselines.',
                        },
                        {
                          title: 'Results & Findings',
                          body: 'Empty — no experimental claims recorded prior to empirical execution.',
                        },
                        {
                          title: 'Publications',
                          body: 'Internal technical report and reproducibility artifact slot.',
                        },
                      ].map((slot) => (
                        <div
                          key={slot.title}
                          className="rounded border border-white/[0.06] bg-[#07090E] p-3 space-y-1"
                        >
                          <p className="font-mono text-[#38BDF8]">{slot.title}</p>
                          <p className="text-slate-400 leading-relaxed">{slot.body}</p>
                        </div>
                      ))}
                      <div className="sm:col-span-2 lg:col-span-4 flex flex-wrap gap-2 pt-1">
                        {rq.relatedDivisionIds.map((divId) => {
                          const div = getDivisionById(divId);
                          if (!div) return null;
                          return (
                            <Link
                              key={div.id}
                              to={`/infrastructure/${div.slug}`}
                              className="rounded border border-white/[0.08] bg-[#07090E] px-2.5 py-1 text-slate-300 hover:border-[#3B82F6]"
                            >
                              Division: {div.name}
                            </Link>
                          );
                        })}
                        {rq.relatedFamilySlugs.map((slug) => {
                          const fam = getFamilyBySlug(slug);
                          if (!fam) return null;
                          return (
                            <Link
                              key={fam.id}
                              to={`/environments/${fam.slug}`}
                              className="rounded border border-white/[0.08] bg-[#07090E] px-2.5 py-1 text-slate-300 hover:border-[#3B82F6]"
                            >
                              Family: {fam.shortName}
                            </Link>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </article>
              );
            })}
          </div>
        </div>
      )}

      {/* TRAINING & LEARNING SYSTEMS */}
      {section === 'training' && (
        <div className="pt-10 space-y-10">
          {/* Critical Distinction Callout */}
          <div className="rounded-lg border border-[#38BDF8]/30 bg-[#0B0E17] p-6 space-y-4">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
              <div className="space-y-2">
                <span className="font-mono text-xs uppercase tracking-wider text-[#38BDF8]">
                  Experience vs. Model Weight Updates
                </span>
                <h2 className="font-display text-2xl font-bold text-white">
                  Simply completing tasks does not automatically improve model weights.
                </h2>
              </div>
              <Link
                to="/data-generator"
                className="inline-flex items-center gap-2 rounded-md bg-[#3B82F6] px-4 py-2 text-xs font-medium text-white hover:bg-[#2563EB] whitespace-nowrap shrink-0"
              >
                <span>Open Synthetic Data Generator</span>
                <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </div>
            <p className="text-sm text-slate-300 leading-relaxed max-w-4xl">
              A model&apos;s successful task execution is an <strong className="text-white">experience</strong>.
              It becomes training data only after appropriate selection, validation, formatting,
              and integration into a formal training process.
            </p>

            {/* Pipeline Flow */}
            <div className="grid grid-cols-1 gap-2 pt-2 sm:grid-cols-5">
              {[
                { step: '01', label: 'Environments', desc: 'Interactive task domain' },
                { step: '02', label: 'Task Execution', desc: 'Tool calls & trajectories' },
                { step: '03', label: 'Evaluation', desc: 'Verifiable check & grading' },
                { step: '04', label: 'Validated Trajectories', desc: 'Selection & formatting' },
                { step: '05', label: 'Model Training', desc: 'SFT / RLVR / GRPO / Distillation' },
              ].map((node, idx) => (
                <div key={node.step} className="flex items-stretch gap-2">
                  <div className="flex-1 rounded border border-white/[0.08] bg-[#07090E] p-3">
                    <span className="font-mono text-[11px] text-[#38BDF8]">{node.step}</span>
                    <p className="mt-1 text-xs font-semibold text-white">{node.label}</p>
                    <p className="mt-0.5 text-[11px] text-slate-400">{node.desc}</p>
                  </div>
                  {idx < 4 && (
                    <div
                      aria-hidden="true"
                      className="hidden sm:flex items-center text-slate-600"
                    >
                      <ArrowRight className="h-3.5 w-3.5" />
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* 8 Learning Mechanisms */}
          <div>
            <h2 className="font-display text-2xl font-bold text-white mb-6">
              Eight Training &amp; Learning Integration Mechanisms
            </h2>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              {trainingMechanisms.map((mech) => (
                <div
                  key={mech.id}
                  className="rounded-lg border border-white/[0.08] bg-[#0B0E17] p-6 space-y-3"
                >
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-mono text-[#38BDF8]">Mechanism {mech.number}</span>
                  </div>
                  <h3 className="font-display text-lg font-bold text-white">{mech.name}</h3>
                  <p className="text-sm text-slate-200">{mech.summary}</p>
                  <p className="text-xs text-slate-400 leading-relaxed">
                    {mech.mechanismDetail}
                  </p>
                  {mech.examples && (
                    <div className="rounded border border-white/[0.06] bg-[#07090E] p-3 space-y-1.5">
                      <p className="font-mono text-[11px] uppercase text-slate-400">
                        Verifiable Outcome Examples
                      </p>
                      <ul className="space-y-1 text-xs text-slate-300">
                        {mech.examples.map((ex) => (
                          <li key={ex}>· {ex}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* EVALUATION & BENCHMARKING */}
      {section === 'evaluation' && (
        <div className="pt-10 space-y-12">
          <div className="rounded-lg border border-white/[0.08] bg-[#0B0E17] p-6 space-y-3">
            <span className="font-mono text-xs uppercase tracking-wider text-[#38BDF8]">
              Evaluation Discipline
            </span>
            <h2 className="font-display text-2xl font-bold text-white">
              Benchmarking Against Frontier Intelligence
            </h2>
            <p className="text-sm text-slate-300 leading-relaxed max-w-4xl">
              ThinkNet maintains rigorous evaluation standards using equivalent tools, budgets, and
              conditions wherever possible. We do not confuse benchmark-specific success with
              general intelligence, and no synthetic or fabricated model scores are presented below.
            </p>
          </div>

          {/* 12 Benchmarking Dimensions */}
          <div>
            <h3 className="font-display text-xl font-bold text-white mb-5">
              Twelve Comparison Dimensions
            </h3>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {benchmarkDimensions.map((dim, idx) => (
                <div
                  key={dim.name}
                  className="rounded-lg border border-white/[0.08] bg-[#0B0E17] p-4 space-y-1.5"
                >
                  <span className="font-mono text-xs text-[#38BDF8] tabular-nums">
                    {String(idx + 1).padStart(2, '0')}
                  </span>
                  <h4 className="font-display text-base font-semibold text-white">
                    {dim.name}
                  </h4>
                  <p className="text-xs text-slate-400 leading-relaxed">{dim.focus}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Mandatory Benchmark Telemetry Schema & Empty Research Ledger */}
          <div className="rounded-lg border border-white/[0.08] bg-[#0B0E17] p-6 space-y-5">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h3 className="font-display text-lg font-semibold text-white">
                  Evaluation Ledger Schema (Awaiting Experimental Runs)
                </h3>
                <p className="text-xs text-slate-400 mt-1">
                  Eleven mandatory fields recorded for every ThinkNet benchmark evaluation.
                </p>
              </div>
              <span className="font-mono text-xs text-slate-400">
                0 Recorded Benchmarks (No Fabricated Scores)
              </span>
            </div>

            <div className="flex flex-wrap gap-2">
              {benchmarkRecordedFields.map((field) => (
                <span
                  key={field}
                  className="rounded border border-white/[0.08] bg-[#07090E] px-3 py-1.5 font-mono text-xs text-slate-300"
                >
                  {field}
                </span>
              ))}
            </div>

            <div className="overflow-x-auto rounded border border-white/[0.08] bg-[#07090E]">
              <table className="w-full text-left text-xs">
                <thead className="border-b border-white/[0.08] bg-[#0D111A] font-mono text-slate-400">
                  <tr>
                    <th className="px-4 py-3">Model Version</th>
                    <th className="px-4 py-3">Benchmark Version</th>
                    <th className="px-4 py-3">Difficulty</th>
                    <th className="px-4 py-3">Success Rate</th>
                    <th className="px-4 py-3">Accuracy</th>
                    <th className="px-4 py-3">Tokens / Time</th>
                    <th className="px-4 py-3">Methodology</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td colSpan={7} className="px-4 py-10 text-center text-slate-400">
                      No published benchmark runs are recorded yet. Experimental results will
                      appear here once Phase 1 Evaluation Infrastructure and Phase 4 initial
                      environments complete reproducible baseline evaluations.
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* DEVELOPMENT SEQUENCE & PRINCIPLES */}
      {section === 'roadmap' && (
        <div className="pt-10 space-y-14">
          <div>
            <h2 className="font-display text-2xl font-bold text-white mb-2">
              Eight-Phase Development Sequence
            </h2>
            <p className="text-sm text-slate-400 mb-6">
              ThinkNet is built incrementally, prioritizing reusable infrastructure before
              expanding environment coverage.
            </p>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
              {developmentPhases.map((p) => (
                <div
                  key={p.phase}
                  className="rounded-lg border border-white/[0.08] bg-[#0B0E17] p-5 space-y-3"
                >
                  <span className="font-mono text-xs text-[#38BDF8]">{p.phase}</span>
                  <h3 className="font-display text-base font-bold text-white">{p.title}</h3>
                  <ul className="space-y-1.5 text-xs text-slate-300">
                    {p.items.map((item) => (
                      <li key={item} className="flex items-start gap-2">
                        <span className="mt-1.5 h-1 w-1 rounded-full bg-slate-500 shrink-0" />
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </div>

          <div>
            <h2 className="font-display text-2xl font-bold text-white mb-2">
              Ten Engineering Principles
            </h2>
            <p className="text-sm text-slate-400 mb-6">
              Non-negotiable standards governing architecture, safety, reproducibility, and
              evidence-based research.
            </p>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              {engineeringPrinciples.map((pr) => (
                <div
                  key={pr.number}
                  className="rounded-lg border border-white/[0.08] bg-[#0B0E17] p-5 flex gap-4"
                >
                  <span className="font-mono text-sm font-semibold text-[#38BDF8] tabular-nums">
                    {pr.number}
                  </span>
                  <div>
                    <h3 className="font-display text-base font-semibold text-white">
                      {pr.title}
                    </h3>
                    <p className="mt-1 text-sm text-slate-300 leading-relaxed">
                      {pr.description}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

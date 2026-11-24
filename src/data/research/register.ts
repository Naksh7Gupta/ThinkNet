import {
  DevelopmentPhase,
  EngineeringPrinciple,
  ResearchQuestion,
  TrainingMechanism,
} from '../../types/thinknet';

export const researchQuestions: ResearchQuestion[] = [
  {
    id: 'rq-01',
    number: '01',
    question: 'Can carefully selected training data improve parameter efficiency?',
    category: 'Data & Scaling Efficiency',
    objective:
      'Investigate whether rigorous quality scoring, deduplication, and mixture optimization allow smaller parameter budgets to match broader uncurated corpora.',
    status: 'Proposed',
    futureExperimentField: 'Controlled pretraining mixture ablations across matched FLOP budgets.',
    relatedDivisionIds: ['div-data-eng', 'div-training-infra'],
    relatedFamilySlugs: ['intelligence-research'],
  },
  {
    id: 'rq-02',
    number: '02',
    question: 'Can interactive environments improve coding and reasoning capabilities?',
    category: 'Environment-Driven Learning',
    objective:
      'Compare models trained solely on static datasets against models trained with verified feedback from interactive coding and reasoning episodes.',
    status: 'Proposed',
    futureExperimentField: 'Ablation across static SFT vs. interactive execution-feedback trajectories.',
    relatedDivisionIds: ['div-eval-infra', 'div-post-training'],
    relatedFamilySlugs: ['intelligence-research', 'real-world-engineering'],
  },
  {
    id: 'rq-03',
    number: '03',
    question: 'Can capabilities transfer between different environments?',
    category: 'Capability Transfer',
    objective:
      'Test whether training in one structured environment measurably improves zero-shot or few-shot performance in distinct downstream environments.',
    status: 'Proposed',
    futureExperimentField: 'Cross-environment transfer matrix across Family 01–04 baselines.',
    relatedDivisionIds: ['div-eval-infra', 'div-research-infra'],
    relatedFamilySlugs: ['real-world-engineering', 'agentic-generative'],
  },
  {
    id: 'rq-04',
    number: '04',
    question: 'Can smaller models outperform larger models on carefully selected tasks?',
    category: 'Parameter Efficiency',
    objective:
      'Evaluate targeted distillation, curriculum design, and verifiable-reward post-training on compact models for specialized reasoning and engineering tasks.',
    status: 'Proposed',
    futureExperimentField: 'Equivalent-budget task benchmarks comparing compact specialized models vs. larger baselines.',
    relatedDivisionIds: ['div-post-training', 'div-eval-infra'],
    relatedFamilySlugs: ['intelligence-research', 'low-level-engineering'],
  },
  {
    id: 'rq-05',
    number: '05',
    question: 'Can dynamic-depth architectures improve computational efficiency?',
    category: 'Model Architecture',
    objective:
      'Measure compute-per-token savings and accuracy retention when models adaptively allocate layer depth based on token or task difficulty.',
    status: 'Proposed',
    futureExperimentField: 'LIIO layer-contribution profiling paired with dynamic-depth routing prototypes.',
    relatedDivisionIds: ['div-model-arch', 'div-inference-eng'],
    relatedFamilySlugs: ['low-level-engineering'],
  },
  {
    id: 'rq-06',
    number: '06',
    question: 'Can improved KV-cache policies reduce memory consumption?',
    category: 'Memory & Inference',
    objective:
      'Assess memory footprint reduction and long-context accuracy preservation across PagedAttention, MLA, and selective KV-cache eviction policies.',
    status: 'Proposed',
    futureExperimentField: '100K+ token memory-versus-recall sweeps across inference serving engines.',
    relatedDivisionIds: ['div-inference-eng', 'div-model-arch'],
    relatedFamilySlugs: ['intelligence-research', 'low-level-engineering'],
  },
  {
    id: 'rq-07',
    number: '07',
    question: 'Can specialized agents improve the quality of training experiments?',
    category: 'Agentic Research Systems',
    objective:
      'Evaluate whether coordinated observer and researcher agents reduce training instability, detect regressions faster, and raise experiment throughput.',
    status: 'Proposed',
    futureExperimentField: 'Human-supervised vs. agent-assisted training loop diagnostics comparison.',
    relatedDivisionIds: ['div-research-infra', 'div-training-infra'],
    relatedFamilySlugs: ['agentic-generative'],
  },
  {
    id: 'rq-08',
    number: '08',
    question: 'Can synthetic data improve reasoning without introducing unwanted errors?',
    category: 'Synthetic Data',
    objective:
      'Study verification filters, contamination checks, and reward-gated synthetic generation to prevent model collapse or error amplification.',
    status: 'Proposed',
    futureExperimentField: 'Verifiable vs. unverified synthetic trajectory scaling studies.',
    relatedDivisionIds: ['div-data-eng', 'div-post-training'],
    relatedFamilySlugs: ['intelligence-research'],
  },
  {
    id: 'rq-09',
    number: '09',
    question: 'Can distillation preserve complex capabilities in smaller models?',
    category: 'Knowledge Distillation',
    objective:
      'Compare logit, feature, reasoning, and multi-teacher progressive distillation on multi-step coding, math, and tool-use retention.',
    status: 'Proposed',
    futureExperimentField: 'Student retention benchmarks across progressive distillation schedules.',
    relatedDivisionIds: ['div-post-training', 'div-eval-infra'],
    relatedFamilySlugs: ['intelligence-research', 'agentic-generative'],
  },
  {
    id: 'rq-10',
    number: '10',
    question: 'Can models learn to inspect and optimize their own computational workflows?',
    category: 'Self-Optimization & Kernels',
    objective:
      'Investigate whether training in Inside the Machine episodes enables models to profile and optimize real execution graphs and GPU kernels.',
    status: 'Proposed',
    futureExperimentField: 'Automated Triton/CUDA kernel optimization benchmarks with strict numerical equivalence checks.',
    relatedDivisionIds: ['div-compute-kernel', 'div-inference-eng'],
    relatedFamilySlugs: ['low-level-engineering'],
  },
  {
    id: 'rq-11',
    number: '11',
    question: 'Can long-context training improve practical codebase understanding?',
    category: 'Long-Context Intelligence',
    objective:
      'Test whether dedicated long-context episodes improve multi-file dependency tracing and enterprise debugging over retrieval-only pipelines.',
    status: 'Proposed',
    futureExperimentField: 'Whole-repository comprehension tasks across 100K+ token enterprise codebases.',
    relatedDivisionIds: ['div-training-infra', 'div-eval-infra'],
    relatedFamilySlugs: ['intelligence-research', 'real-world-engineering'],
  },
  {
    id: 'rq-12',
    number: '12',
    question: 'Can multimodal environments improve spatial intelligence?',
    category: 'Spatial & Multimodal Intelligence',
    objective:
      'Measure whether Blender 3D modeling, CAD constraints, and image-to-3D reconstruction improve spatial reasoning benchmarks.',
    status: 'Proposed',
    futureExperimentField: 'Spatial reasoning evaluation before and after Not Just Text series training.',
    relatedDivisionIds: ['div-eval-infra', 'div-data-eng'],
    relatedFamilySlugs: ['real-world-engineering'],
  },
  {
    id: 'rq-13',
    number: '13',
    question: 'Can environment-generated trajectories improve tool-use reliability?',
    category: 'Tool Use & Agents',
    objective:
      'Examine how validated multi-step tool execution and error-recovery trajectories affect function-calling and computer-use reliability.',
    status: 'Proposed',
    futureExperimentField: 'Agent Evaluation Lab reliability and recovery rate benchmarks.',
    relatedDivisionIds: ['div-post-training', 'div-eval-infra'],
    relatedFamilySlugs: ['agentic-generative'],
  },
  {
    id: 'rq-14',
    number: '14',
    question: 'Can automated kernel optimization produce measurable inference improvements?',
    category: 'Compute & Inference',
    objective:
      'Benchmark kernel-level and operator-fusion changes proposed within controlled optimization sandboxes against baseline serving stacks.',
    status: 'Proposed',
    futureExperimentField: 'Latency, throughput, and numerical parity measurements on standardized workloads.',
    relatedDivisionIds: ['div-compute-kernel', 'div-inference-eng'],
    relatedFamilySlugs: ['low-level-engineering'],
  },
  {
    id: 'rq-15',
    number: '15',
    question: 'Can cross-environment training produce transferable capabilities?',
    category: 'Cross-Environment Transfer',
    objective:
      'Evaluate capstone cross-environment tasks such as Build an AI-Powered Robotics Company to quantify capability transfer across domains.',
    status: 'Proposed',
    futureExperimentField: 'Multi-domain transfer studies combining 3D geometry, robotics simulation, and software engineering.',
    relatedDivisionIds: ['div-research-infra', 'div-eval-infra'],
    relatedFamilySlugs: ['real-world-engineering', 'agentic-generative'],
  },
];

export const trainingMechanisms: TrainingMechanism[] = [
  {
    id: 'tm-supervised',
    number: '01',
    name: 'Supervised Learning',
    summary: 'Use demonstrations and validated task trajectories to create supervised examples.',
    mechanismDetail:
      'Successful, evaluator-verified environment trajectories are curated, formatted, and filtered to construct high-signal supervised fine-tuning (SFT) datasets.',
  },
  {
    id: 'tm-rl',
    number: '02',
    name: 'Reinforcement Learning',
    summary: 'Use suitable environments with measurable rewards to investigate reinforcement learning.',
    mechanismDetail:
      'Environments expose structured state transitions and deterministic or rubric-bounded reward signals suitable for policy optimization methods such as GRPO.',
  },
  {
    id: 'tm-verifiable-rewards',
    number: '03',
    name: 'Verifiable Rewards',
    summary: 'Use objectively checkable outcomes wherever possible.',
    mechanismDetail:
      'Prioritizes deterministic verification harnesses (RLVR) over subjective scoring whenever ground-truth execution or formal constraints exist.',
    examples: [
      'Code passes tests.',
      'Mathematical answers satisfy verification.',
      'CAD designs satisfy geometric constraints.',
      'Software workflows reach the expected state.',
    ],
  },
  {
    id: 'tm-preference',
    number: '04',
    name: 'Preference Optimization',
    summary: 'Collect comparisons between different outputs and improve response preferences.',
    mechanismDetail:
      'Pairs contrasting execution trajectories or analytical outputs to construct preference datasets for DPO and reward modeling.',
  },
  {
    id: 'tm-distillation',
    number: '05',
    name: 'Knowledge Distillation',
    summary: 'Transfer useful capabilities from stronger teacher models into smaller student models.',
    mechanismDetail:
      'Applies logit, feature, reasoning, and multi-teacher progressive distillation so compact models retain specialized capabilities.',
  },
  {
    id: 'tm-synthetic-data',
    number: '06',
    name: 'Synthetic Data',
    summary: 'Generate additional training examples using specialized agents and validated workflows.',
    mechanismDetail:
      'Data Research Agents synthesize targeted examples around diagnosed weak categories, subject to contamination checks and quality scoring.',
  },
  {
    id: 'tm-curriculum',
    number: '07',
    name: 'Curriculum Learning',
    summary: 'Gradually increase task complexity based on measured performance.',
    mechanismDetail:
      'The Curriculum Manager schedules progression across Foundation, Intermediate, Advanced, Professional, and Research levels as competence is verified.',
  },
  {
    id: 'tm-experience',
    number: '08',
    name: 'Experience-Based Learning',
    summary: 'Investigate how useful interaction histories and execution trajectories can improve subsequent training.',
    mechanismDetail:
      'Captures structured action-observation-feedback histories to study iterative adaptation without conflating runtime execution with weight updates.',
  },
];

export const benchmarkDimensions: { name: string; focus: string }[] = [
  { name: 'Reasoning', focus: 'Multi-step deductive, analytical, and structured inference' },
  { name: 'Mathematics', focus: 'Arithmetic through formal proofs and competition math' },
  { name: 'Coding', focus: 'Algorithmic synthesis, debugging, and unit-test verification' },
  { name: 'Deep Research', focus: 'Multi-source synthesis, contradiction detection, citation accuracy' },
  { name: 'Long Context', focus: '100K+ token retrieval, consistency, and whole-codebase comprehension' },
  { name: 'Computer Use', focus: 'Multi-step GUI and browser workflows with error recovery' },
  { name: 'Software Engineering', focus: 'Large repository understanding, auditing, and architecture' },
  { name: 'Multimodal Understanding', focus: 'Image, audio, video, 3D, CAD, and physical simulation reasoning' },
  { name: 'Tool Use', focus: 'Function calling, MCP integration, and execution verification' },
  { name: 'Writing', focus: 'Technical documentation, research prose, and structural clarity' },
  { name: 'Reliability', focus: 'Consistency across attempts, low hallucination rate, regression stability' },
  { name: 'Efficiency', focus: 'Token consumption, execution latency, memory footprint, and cost' },
];

export const benchmarkRecordedFields: string[] = [
  'Model version',
  'Benchmark version',
  'Task difficulty',
  'Number of attempts',
  'Success rate',
  'Accuracy',
  'Execution time',
  'Token consumption',
  'Tool usage',
  'Cost',
  'Evaluation methodology',
];

export const developmentPhases: DevelopmentPhase[] = [
  {
    phase: 'Phase 1',
    title: 'Technical Foundation',
    items: [
      'Research documentation',
      'Architecture registry',
      'Experiment tracking',
      'Dataset management',
      'Model loading',
      'Evaluation infrastructure',
      'Compute monitoring',
    ],
  },
  {
    phase: 'Phase 2',
    title: 'Environment Engine',
    items: [
      'Environment registry',
      'Episode registry',
      'Task generation',
      'Execution interfaces',
      'Observation logging',
      'Evaluation',
      'Feedback',
      'Training-data export',
    ],
  },
  {
    phase: 'Phase 3',
    title: 'Agentic Infrastructure',
    items: [
      'Agent orchestration',
      'Specialized agents',
      'Agent communication',
      'Tool integrations',
      'Agent evaluation',
      'Human approval controls',
    ],
  },
  {
    phase: 'Phase 4',
    title: 'Initial Environment Collection',
    items: [
      'Software Engineering',
      'Deep Research',
      'Mathematics',
      'Coding',
      'Computer Use',
      'Kernel Engineering',
    ],
  },
  {
    phase: 'Phase 5',
    title: 'Multimodal Environments',
    items: [
      'Blender',
      '3D',
      'Robotics',
      'Audio',
      'Video',
      'Scientific visualization',
      'Hardware simulation',
    ],
  },
  {
    phase: 'Phase 6',
    title: 'Advanced Training Integration',
    items: ['SFT', 'Distillation', 'RLVR', 'GRPO', 'Curriculum learning', 'Model evaluation'],
  },
  {
    phase: 'Phase 7',
    title: 'Low-Level Optimization',
    items: [
      'Custom kernels',
      'GPU profiling',
      'Compiler optimization',
      'Distributed training',
      'Inference optimization',
    ],
  },
  {
    phase: 'Phase 8',
    title: 'Foundation Model Research',
    items: [
      'Use the infrastructure to support systematic development and improvement of ThinkNet foundation-model research.',
    ],
  },
];

export const engineeringPrinciples: EngineeringPrinciple[] = [
  {
    number: '01',
    title: 'Modular Architecture',
    description: 'Every component has a defined responsibility and reusable interfaces.',
  },
  {
    number: '02',
    title: 'Interoperability',
    description: 'Different environments communicate through standard interfaces.',
  },
  {
    number: '03',
    title: 'Reproducibility',
    description: 'Experiments must be traceable and repeatable.',
  },
  {
    number: '04',
    title: 'Measurable Improvement',
    description: 'Never claim that an optimization works without benchmarking it.',
  },
  {
    number: '05',
    title: 'Model-Agnostic Design',
    description: 'Where practical, support different model architectures and providers.',
  },
  {
    number: '06',
    title: 'Resource Awareness',
    description: 'Training and experiments must consider available compute, memory and cost.',
  },
  {
    number: '07',
    title: 'Safety',
    description:
      'Use sandboxed execution for code, controlled access for computer-use agents, synthetic data for sensitive enterprise tasks and human approval for consequential actions.',
  },
  {
    number: '08',
    title: 'Evidence-Based Research',
    description: 'Distinguish established techniques, hypotheses, experimental findings and unverified claims.',
  },
  {
    number: '09',
    title: 'Reusable Infrastructure',
    description: 'Build systems that support many environments rather than one-off implementations.',
  },
  {
    number: '10',
    title: 'Scientific Documentation',
    description: 'Record decisions, failures, results and lessons.',
  },
];

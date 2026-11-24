import { DifficultyLevel, EngineComponent } from '../../types/thinknet';

export const engineHierarchy = [
  {
    step: '01',
    name: 'ENVIRONMENT',
    definition: 'A complete learning domain.',
    detail: 'Defines domain boundaries, simulation software, tool interfaces, and verification constraints.',
  },
  {
    step: '02',
    name: 'EPISODES',
    definition: 'A focused learning experience designed to develop a particular capability.',
    detail: 'Can contain hundreds or thousands of different tasks organized by progressive difficulty.',
  },
  {
    step: '03',
    name: 'TASKS',
    definition: 'An individual assignment within an episode.',
    detail: 'Generated or drawn from the Task Library and calibrated to the model’s current skill profile.',
  },
  {
    step: '04',
    name: 'EVALUATION',
    definition: 'Measures the quality of execution.',
    detail: 'Applies deterministic test harnesses, geometric/physical checks, or structured rubrics.',
  },
  {
    step: '05',
    name: 'FEEDBACK',
    definition: 'Identifies mistakes and provides information for improvement.',
    detail: 'Drives adaptive follow-up task generation and exports validated trajectories for training.',
  },
];

export const universalEngineComponents: EngineComponent[] = [
  {
    number: '01',
    id: 'comp-identity',
    name: 'Episode Identity',
    layer: 'Definition',
    description: 'Canonical metadata, unique identifiers, family/series mapping, and capability taxonomy.',
  },
  {
    number: '02',
    id: 'comp-objectives',
    name: 'Learning Objectives',
    layer: 'Definition',
    description: 'Explicit capability targets and expected competencies each episode is designed to build.',
  },
  {
    number: '03',
    id: 'comp-env-def',
    name: 'Environment Definition',
    layer: 'Definition',
    description: 'Sandboxed runtime specification, simulation engine hooks, and state initialization rules.',
  },
  {
    number: '04',
    id: 'comp-tools',
    name: 'Available Tools',
    layer: 'Definition',
    description: 'Scoped APIs, CLI utilities, compilers, CAD/Blender bridges, or MCP tool definitions.',
  },
  {
    number: '05',
    id: 'comp-references',
    name: 'Reference Materials',
    layer: 'Definition',
    description: 'Domain documentation, specifications, validated datasets, and baseline reference artifacts.',
  },
  {
    number: '06',
    id: 'comp-task-lib',
    name: 'Task Library',
    layer: 'Generation',
    description: 'Curated repository of deterministic and open-ended tasks spanning all difficulty levels.',
  },
  {
    number: '07',
    id: 'comp-task-gen',
    name: 'Task Generator',
    layer: 'Generation',
    description: 'Parametric and adaptive generator synthesizing targeted follow-up tasks from observed weaknesses.',
  },
  {
    number: '08',
    id: 'comp-difficulty',
    name: 'Difficulty Progression',
    layer: 'Generation',
    description: 'Five-tier complexity scaling from Foundation through Research, adaptable per environment.',
  },
  {
    number: '09',
    id: 'comp-exec-engine',
    name: 'Execution Engine',
    layer: 'Execution',
    description: 'Isolated, reproducible task runner managing tool calls, timeouts, and resource budgets.',
  },
  {
    number: '10',
    id: 'comp-observation',
    name: 'Observation System',
    layer: 'Execution',
    description: 'Captures complete step-by-step action histories, intermediate outputs, and system telemetry.',
  },
  {
    number: '11',
    id: 'comp-eval-engine',
    name: 'Evaluation Engine',
    layer: 'Measurement',
    description: 'Verifies outcomes against unit tests, formal proofs, physical/geometric rules, or rubrics.',
  },
  {
    number: '12',
    id: 'comp-feedback-engine',
    name: 'Feedback Engine',
    layer: 'Measurement',
    description: 'Diagnoses root-cause errors and produces structured corrective signals for adaptation.',
  },
  {
    number: '13',
    id: 'comp-curriculum',
    name: 'Curriculum Manager',
    layer: 'Integration',
    description: 'Adjusts task selection and difficulty dynamically based on measured capability mastery.',
  },
  {
    number: '14',
    id: 'comp-exporter',
    name: 'Training Data Exporter',
    layer: 'Integration',
    description: 'Formats validated, high-quality trajectories for SFT, DPO, GRPO, RLVR, or distillation.',
  },
  {
    number: '15',
    id: 'comp-benchmark',
    name: 'Benchmark Integration',
    layer: 'Integration',
    description: 'Links episode evaluation outcomes directly into ThinkNet standardized evaluation suites.',
  },
];

export const standardDifficultyLevels: DifficultyLevel[] = [
  {
    level: 1,
    id: 'foundation',
    name: 'Foundation',
    description: 'Basic understanding and simple tasks.',
  },
  {
    level: 2,
    id: 'intermediate',
    name: 'Intermediate',
    description: 'Multi-step assignments and tool interaction.',
  },
  {
    level: 3,
    id: 'advanced',
    name: 'Advanced',
    description: 'Complex tasks requiring planning and deeper understanding.',
  },
  {
    level: 4,
    id: 'professional',
    name: 'Professional',
    description: 'Realistic workflows and substantial projects.',
  },
  {
    level: 5,
    id: 'research',
    name: 'Research',
    description: 'Open-ended problems, experimentation and novel solutions.',
  },
];

export const adaptiveEpisodeLoop = [
  { step: '01', label: 'Task Assignment', detail: 'Model receives a calibrated task.' },
  { step: '02', label: 'Execution Attempt', detail: 'It attempts execution inside the environment.' },
  { step: '03', label: 'Measurement', detail: 'Evaluator measures performance objectively.' },
  { step: '04', label: 'Diagnosis', detail: 'Specific weaknesses and failure modes are identified.' },
  { step: '05', label: 'Targeted Generation', detail: 'Task generator creates targeted follow-up tasks.' },
  { step: '06', label: 'Re-Attempt', detail: 'Model attempts the targeted follow-up tasks.' },
  { step: '07', label: 'Progress Tracking', detail: 'Progress is measured across iterations.' },
];

export const roboticsInterconnectionDomains = [
  'Deep Research',
  'Software Engineering',
  '3D Modelling',
  'Robotics',
  'Mathematics',
  'Computer Use',
  'Documentation',
  'Evaluation',
];

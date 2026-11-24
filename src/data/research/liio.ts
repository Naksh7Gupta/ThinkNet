import { LIIOCapability } from '../../types/thinknet';

export const liioCapabilities: LIIOCapability[] = [
  {
    id: 'liio-01',
    number: '01',
    name: 'Layer Contribution Analyzer',
    category: 'Structural',
    description:
      'Quantifies how individual transformer layers transform residual streams and contribute to final logit predictions.',
    researchFocus:
      'Measure residual-stream deltas, layer-wise information gain, and early-exit or dynamic-depth redundancy.',
    connectedSystems: ['Model Architecture Research', 'Training Infrastructure'],
  },
  {
    id: 'liio-02',
    number: '02',
    name: 'Attention Head Inspector',
    category: 'Attention & MLP',
    description:
      'Examines individual attention heads across layers to isolate induction, retrieval, syntactic, and long-context routing behaviors.',
    researchFocus:
      'Identify specialized heads versus redundant heads across MHA, MQA, GQA, and MLA variants.',
    connectedSystems: ['Model Architecture Research', 'Long-Context Intelligence'],
  },
  {
    id: 'liio-03',
    number: '03',
    name: 'Neuron and MLP Analyzer',
    category: 'Attention & MLP',
    description:
      'Inspects feed-forward and Mixture-of-Experts MLP activations to map sparsity, dead neurons, and feature selectivity.',
    researchFocus:
      'Understand factual storage, nonlinear feature routing, and expert specialization in MoE models.',
    connectedSystems: ['Model Architecture Research', 'Evaluation Infrastructure'],
  },
  {
    id: 'liio-04',
    number: '04',
    name: 'Activation Visualization',
    category: 'Representational',
    description:
      'Renders layer-by-layer activation magnitudes, outlier distributions, and precision-sensitivity profiles across forward passes.',
    researchFocus:
      'Locate activation spikes relevant to FP8/INT8 quantization stability and numerical precision engineering.',
    connectedSystems: ['Inference Engineering', 'Low-Level Model Engineering'],
  },
  {
    id: 'liio-05',
    number: '05',
    name: 'Representation Analysis',
    category: 'Representational',
    description:
      'Measures geometric properties, cosine similarity trajectories, linear separability, and subspace clustering of latent representations.',
    researchFocus:
      'Track how semantic and reasoning concepts form and stabilize across depth and training checkpoints.',
    connectedSystems: ['Research Infrastructure', 'Post-Training & Distillation'],
  },
  {
    id: 'liio-06',
    number: '06',
    name: 'Token-Level Analysis',
    category: 'Representational',
    description:
      'Traces per-token probability evolution, entropy, residual norms, and prediction shifts through every transformer block.',
    researchFocus:
      'Diagnose where reasoning errors, hallucinations, or tool-call formatting failures originate at the token level.',
    connectedSystems: ['Evaluation Infrastructure', 'Training Inspector Agent'],
  },
  {
    id: 'liio-07',
    number: '07',
    name: 'Attention Pattern Inspection',
    category: 'Attention & MLP',
    description:
      'Visualizes query-key attention matrices across short and 100K+ token contexts to inspect retrieval focus and sink behavior.',
    researchFocus:
      'Verify whether long-context models genuinely attend to distant evidence tokens rather than collapsing to recency bias.',
    connectedSystems: ['Long-Context Intelligence', 'KV-Cache Optimization'],
  },
  {
    id: 'liio-08',
    number: '08',
    name: 'Hidden-State Comparison',
    category: 'Experimental',
    description:
      'Compares hidden states between base models, post-trained checkpoints, or teacher-student pairs under identical prompts.',
    researchFocus:
      'Support feature distillation and measure how SFT, DPO, GRPO, or RLVR alter internal representations.',
    connectedSystems: ['Post-Training & Distillation', 'Evaluation Infrastructure'],
  },
  {
    id: 'liio-09',
    number: '09',
    name: 'Model Behaviour Tracking',
    category: 'Experimental',
    description:
      'Records longitudinal trajectories of internal component behavior across training steps, curricula, and architectural iterations.',
    researchFocus:
      'Correlate phase transitions in benchmark capabilities with measurable structural shifts inside the network.',
    connectedSystems: ['Training Infrastructure', 'Model Research Agent'],
  },
  {
    id: 'liio-10',
    number: '10',
    name: 'Architecture Experimentation',
    category: 'Experimental',
    description:
      'Connects interpretability observations directly to architectural interventions (dynamic depth, KV-cache policies, attention variants).',
    researchFocus:
      'Determine whether proposed architectural modifications yield verifiable computational or capability improvements.',
    connectedSystems: ['Model Architecture Research', 'Research Infrastructure'],
  },
];

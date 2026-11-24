import { Episode, EnvironmentSeries } from '../../types/thinknet';

export const family3Series: EnvironmentSeries[] = [
  {
    id: 'series-inside-the-machine',
    slug: 'inside-the-machine',
    code: 'Series',
    name: 'Inside the Machine',
    familyId: 'fam-03',
    familySlug: 'low-level-engineering',
    description:
      'Deep systems and computational machinery curriculum covering GPU kernels, model scripting, memory hierarchies, graph compilation, distributed parallelism, and numerical precision.',
    objective:
      'Teach LLMs how to understand, inspect, optimize and improve the computational machinery behind AI models.',
    episodeIds: [
      'ep-f3-kernel-optimization',
      'ep-f3-model-scripting',
      'ep-f3-memory-architecture',
      'ep-f3-compiler-graph',
      'ep-f3-distributed-model-eng',
      'ep-f3-numerical-precision',
    ],
  },
];

export const family3Episodes: Episode[] = [
  {
    id: 'ep-f3-kernel-optimization',
    slug: 'kernel-optimization',
    number: '01',
    name: 'Kernel Optimization',
    familyId: 'fam-03',
    familySlug: 'low-level-engineering',
    seriesId: 'series-inside-the-machine',
    seriesName: 'Inside the Machine',
    description:
      'Deep mastery of GPU execution models, CUDA and Triton kernel authoring, memory access coalescing, profiling, and rigorous performance benchmarking.',
    objective:
      'Enable models to write, profile, and optimize custom GPU kernels that improve throughput while preserving numerical correctness.',
    learningObjectives: [
      'GPU execution.',
      'CUDA.',
      'Triton.',
      'GPU memory hierarchy.',
      'Parallel computation.',
      'Memory access patterns.',
      'Custom GPU kernels.',
      'Kernel profiling.',
      'Benchmarking.',
    ],
    technicalCapabilities: [
      'Custom CUDA & Triton kernel authoring',
      'Shared-memory tiling and coalesced access optimization',
      'Roofline profiling and correctness verification',
    ],
    expectedCompetencies: [
      'Eliminating memory-bandwidth bottlenecks in model operators',
      'Demonstrating measurable speedups without numerical drift',
    ],
    finalChallenge:
      'Develop an optimized implementation of a model operation and demonstrate measurable performance improvements while preserving numerical correctness.',
    relatedEpisodeIds: ['ep-f3-memory-architecture', 'ep-f3-compiler-graph', 'ep-f3-model-scripting'],
    relatedEnvironmentIds: ['series-inside-the-machine'],
  },
  {
    id: 'ep-f3-model-scripting',
    slug: 'model-scripting-and-engineering',
    number: '02',
    name: 'Model Scripting & Engineering',
    familyId: 'fam-03',
    familySlug: 'low-level-engineering',
    seriesId: 'series-inside-the-machine',
    seriesName: 'Inside the Machine',
    description:
      'Building custom Python, C++, and Triton model operators alongside training utilities, inference pipelines, and low-level debugging harnesses.',
    objective:
      'Equip models to engineer reliable custom execution pipelines across Python, C++, and GPU kernel boundaries.',
    learningObjectives: [
      'Custom Python scripts.',
      'C++ model operations.',
      'Triton scripts.',
      'Training utilities.',
      'Inference utilities.',
      'Model debugging.',
      'Custom execution pipelines.',
    ],
    technicalCapabilities: [
      'Python/C++/Triton operator bindings',
      'Custom training & inference pipeline engineering',
      'Low-level numerical and runtime debugging',
    ],
    expectedCompetencies: [
      'Authoring modular, high-performance model runtime components',
    ],
    relatedEpisodeIds: ['ep-f3-kernel-optimization', 'ep-f2-debug-complex-systems'],
    relatedEnvironmentIds: ['series-inside-the-machine'],
  },
  {
    id: 'ep-f3-memory-architecture',
    slug: 'memory-architecture-mastery',
    number: '03',
    name: 'Memory Architecture Mastery',
    familyId: 'fam-03',
    familySlug: 'low-level-engineering',
    seriesId: 'series-inside-the-machine',
    seriesName: 'Inside the Machine',
    description:
      'Understanding and optimizing RAM and VRAM allocation, activation memory, KV-cache footprints, memory profiling, and fragmentation.',
    objective:
      'Eliminate out-of-memory failures and maximize effective batch/context capacity through disciplined memory engineering.',
    learningObjectives: [
      'RAM and VRAM.',
      'Memory allocation.',
      'Activation memory.',
      'KV-cache.',
      'Memory-efficient execution.',
      'Memory profiling.',
      'Memory fragmentation.',
    ],
    technicalCapabilities: [
      'VRAM & host RAM profiling',
      'Activation checkpointing and KV-cache layout optimization',
      'Allocator fragmentation reduction',
    ],
    expectedCompetencies: [
      'Predicting and minimizing peak memory footprints during training and inference',
    ],
    relatedEpisodeIds: ['ep-f3-kernel-optimization', 'ep-f3-numerical-precision'],
    relatedEnvironmentIds: ['series-inside-the-machine'],
  },
  {
    id: 'ep-f3-compiler-graph',
    slug: 'compiler-and-graph-optimization',
    number: '04',
    name: 'Compiler & Graph Optimization',
    familyId: 'fam-03',
    familySlug: 'low-level-engineering',
    seriesId: 'series-inside-the-machine',
    seriesName: 'Inside the Machine',
    description:
      'Transforming computational graphs via operator fusion, graph compilation, execution scheduling, and compiler-level optimization passes.',
    objective:
      'Reduce kernel launch overhead and intermediate memory traffic through systematic computational graph transformations.',
    learningObjectives: [
      'Computational graphs.',
      'Operator fusion.',
      'Graph compilation.',
      'Execution scheduling.',
      'Compiler optimizations.',
      'Graph transformations.',
    ],
    technicalCapabilities: [
      'IR graph analysis and transformation',
      'Vertical & horizontal operator fusion',
      'Static/dynamic execution scheduling',
    ],
    expectedCompetencies: [
      'Optimizing end-to-end model execution graphs at the compiler level',
    ],
    relatedEpisodeIds: ['ep-f3-kernel-optimization', 'ep-f3-distributed-model-eng'],
    relatedEnvironmentIds: ['series-inside-the-machine'],
  },
  {
    id: 'ep-f3-distributed-model-eng',
    slug: 'distributed-model-engineering',
    number: '05',
    name: 'Distributed Model Engineering',
    familyId: 'fam-03',
    familySlug: 'low-level-engineering',
    seriesId: 'series-inside-the-machine',
    seriesName: 'Inside the Machine',
    description:
      'Scaling model training and inference across multi-GPU and multi-node clusters using data, tensor, and pipeline parallelism.',
    objective:
      'Maximize multi-device scaling efficiency while minimizing collective communication and synchronization overhead.',
    learningObjectives: [
      'Data parallelism.',
      'Tensor parallelism.',
      'Pipeline parallelism.',
      'Communication overhead.',
      'Distributed execution.',
      'Synchronization.',
    ],
    technicalCapabilities: [
      '3D parallelism (DP / TP / PP) topology design',
      'Compute-communication overlap analysis',
      'Collective synchronization profiling',
    ],
    expectedCompetencies: [
      'Designing balanced distributed execution strategies across GPU clusters',
    ],
    relatedEpisodeIds: ['ep-f2-distributed-systems', 'ep-f3-memory-architecture'],
    relatedEnvironmentIds: ['series-inside-the-machine', 'series-real-world-engineering'],
  },
  {
    id: 'ep-f3-numerical-precision',
    slug: 'numerical-precision-engineering',
    number: '06',
    name: 'Numerical Precision Engineering',
    familyId: 'fam-03',
    familySlug: 'low-level-engineering',
    seriesId: 'series-inside-the-machine',
    seriesName: 'Inside the Machine',
    description:
      'Managing FP32, BF16, FP16, FP8, mixed-precision schedules, quantization schemes, and numerical stability trade-offs.',
    objective:
      'Achieve higher throughput and lower memory usage without destabilizing gradients or degrading model quality.',
    learningObjectives: [
      'FP32.',
      'BF16.',
      'FP16.',
      'FP8.',
      'Quantization.',
      'Mixed precision.',
      'Numerical stability.',
      'Precision-performance trade-offs.',
    ],
    technicalCapabilities: [
      'Mixed-precision scaling & accumulation',
      'Post-training & quantization-aware analysis',
      'Overflow/underflow stability diagnostics',
    ],
    expectedCompetencies: [
      'Balancing compute throughput against numerical accuracy across precision formats',
    ],
    relatedEpisodeIds: ['ep-f3-memory-architecture', 'ep-f3-kernel-optimization', 'ep-f1-linear-algebra'],
    relatedEnvironmentIds: ['series-inside-the-machine'],
  },
];

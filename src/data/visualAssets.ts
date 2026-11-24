import { FamilySlug } from '../types/thinknet';

export interface VisualAsset {
  src: string;
  alt: string;
  caption: string;
}

export const visualAssets = {
  heroLab: {
    src: '/src/assets/images/thinknet_hero_lab_1795512507262.jpg',
    alt: 'ThinkNet AI research and compute laboratory with obsidian server racks and blue optical routing',
    caption: 'ThinkNet Compute & Experimentation Environment',
  },
  liioOptics: {
    src: '/src/assets/images/liio_observatory_optics_1795512511189.jpg',
    alt: 'Multi-layer optical tensor interferometer representing LIIO internal model inspection',
    caption: 'LIIO — Internal Computational Inspection Architecture',
  },
  families: {
    'intelligence-research': {
      src: '/src/assets/images/family_intelligence_graph_1795512508374.jpg',
      alt: 'Mathematical topology lattice and sapphire polyhedra representing Family 01 Intelligence and Research',
      caption: 'Family 01 — Intelligence & Research Topology',
    },
    'real-world-engineering': {
      src: '/src/assets/images/family_robotics_cad_1795512508989.jpg',
      alt: 'Precision articulated robotic manipulator and wireframe CAD digital twin representing Family 02',
      caption: 'Family 02 — Real-World Engineering & Digital Twin',
    },
    'low-level-engineering': {
      src: '/src/assets/images/family_silicon_kernel_1795512508592.jpg',
      alt: 'Silicon GPU die and anodized heatsink cross-section representing Family 03 Low-Level Model Engineering',
      caption: 'Family 03 — Silicon Execution & Kernel Machinery',
    },
    'agentic-generative': {
      src: '/src/assets/images/family_agentic_system_1795512509305.jpg',
      alt: 'Radial interconnected autonomous instrument nodes representing Family 04 Agentic and Generative AI',
      caption: 'Family 04 — Coordinated Agentic & Generative Architecture',
    },
  } satisfies Record<FamilySlug, VisualAsset>,
};

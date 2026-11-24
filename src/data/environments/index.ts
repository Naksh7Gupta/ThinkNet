import { EnvironmentFamily, EnvironmentSeries, Episode } from '../../types/thinknet';
import { family1Episodes, family1Series } from './family1';
import { family2Episodes, family2Series } from './family2';
import { family3Episodes, family3Series } from './family3';
import { family4Episodes, family4Series } from './family4';

export const environmentFamilies: EnvironmentFamily[] = [
  {
    id: 'fam-01',
    number: '01',
    slug: 'intelligence-research',
    name: 'Intelligence & Research',
    shortName: 'Intelligence & Research',
    tagline: 'Develop advanced intellectual capabilities.',
    objective:
      'Build deep multi-source research, formal mathematical reasoning, scientific inquiry, natural communication, structured writing, and reliable long-context intelligence.',
    description:
      'Encompasses Deep Research, Mathematics, Science, Natural Language, Writing, and Long-Context Intelligence environments designed to test genuine reasoning rather than surface pattern matching.',
    seriesIds: family1Series.map((s) => s.id),
    accentColor: '#3B82F6',
  },
  {
    id: 'fam-02',
    number: '02',
    slug: 'real-world-engineering',
    name: 'Real-World Engineering & Not Just Text',
    shortName: 'Real-World Engineering',
    tagline: 'Develop capabilities beyond ordinary language interaction.',
    objective:
      'Extend intelligence into enterprise software systems, simulations, physical domains, CAD, 3D modeling, hardware, biology, audio, video, and cross-environment robotics transfer.',
    description:
      'Divided into Real-World Engineering (Enterprise Software, Complex Software, Enterprise Systems, Complex Software Ecosystems) and Not Just Text (25 multimodal, spatial, scientific, and engineering episodes plus the Cross-Environment Robotics Company challenge).',
    seriesIds: family2Series.map((s) => s.id),
    accentColor: '#38BDF8',
  },
  {
    id: 'fam-03',
    number: '03',
    slug: 'low-level-engineering',
    name: 'Low-Level Model Engineering',
    shortName: 'Low-Level Model Engineering',
    tagline: 'Understand, inspect, optimize and improve computational machinery.',
    objective:
      'Teach LLMs how to inspect, write, profile, and optimize GPU kernels, memory hierarchies, compiler graphs, distributed execution, and numerical precision.',
    description:
      'Built around the Inside the Machine series covering CUDA/Triton kernel optimization, C++/Python model scripting, VRAM/KV-cache architecture, operator fusion, distributed parallelism, and numerical precision engineering.',
    seriesIds: family3Series.map((s) => s.id),
    accentColor: '#60A5FA',
  },
  {
    id: 'fam-04',
    number: '04',
    slug: 'agentic-generative',
    name: 'Agentic & Generative AI',
    shortName: 'Agentic & Generative AI',
    tagline: 'Build, operate, coordinate and develop intelligent AI systems.',
    objective:
      'Train models across autonomous planning, tool use, computer use, generative media synthesis, multi-agent communication, and simulated AI company operations.',
    description:
      'Organized into three series under From Generation to Autonomy: Agentic AI (01–10), Generative AI (11–18), and Advanced Agentic Research (19–25) plus the Special Episode: Build Your Own AI Company.',
    seriesIds: family4Series.map((s) => s.id),
    accentColor: '#818CF8',
  },
];

export const allSeries: EnvironmentSeries[] = [
  ...family1Series,
  ...family2Series,
  ...family3Series,
  ...family4Series,
];

export const allEpisodes: Episode[] = [
  ...family1Episodes,
  ...family2Episodes,
  ...family3Episodes,
  ...family4Episodes,
];

export function getFamilyBySlug(slug: string): EnvironmentFamily | undefined {
  return environmentFamilies.find((f) => f.slug === slug);
}

export function getSeriesByFamilySlug(slug: string): EnvironmentSeries[] {
  return allSeries.filter((s) => s.familySlug === slug);
}

export function getEpisodesByFamilySlug(slug: string): Episode[] {
  return allEpisodes.filter((e) => e.familySlug === slug);
}

export function getEpisodesBySeriesId(seriesId: string): Episode[] {
  return allEpisodes.filter((e) => e.seriesId === seriesId);
}

export function getEpisodeBySlug(slug: string): Episode | undefined {
  return allEpisodes.find((e) => e.slug === slug);
}

export function getEpisodeById(id: string): Episode | undefined {
  return allEpisodes.find((e) => e.id === id);
}

export function getSeriesById(id: string): EnvironmentSeries | undefined {
  return allSeries.find((s) => s.id === id);
}

export function getFamilyStats(slug: string) {
  const series = getSeriesByFamilySlug(slug);
  const episodes = getEpisodesByFamilySlug(slug);
  return {
    seriesCount: series.length,
    episodeCount: episodes.length,
  };
}

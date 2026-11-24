import { SearchRecord } from '../types/thinknet';
import { environmentFamilies, allSeries, allEpisodes } from './environments';
import { researchDivisions } from './infrastructure/divisions';
import { specializedAgents } from './agents/researchAgents';
import { liioCapabilities } from './research/liio';
import { researchQuestions } from './research/register';

export function buildSearchIndex(): SearchRecord[] {
  const records: SearchRecord[] = [];

  // 1. Environment Families
  for (const fam of environmentFamilies) {
    records.push({
      id: `search-${fam.id}`,
      type: 'Family',
      title: fam.name,
      subtitle: fam.tagline,
      hierarchy: ['Environments', `Family ${fam.number}`, fam.name],
      route: `/environments/${fam.slug}`,
      domain: fam.name,
      keywords: [fam.name, fam.objective, fam.description, `Family ${fam.number}`],
    });
  }

  // 2. Environment Series
  for (const series of allSeries) {
    const fam = environmentFamilies.find((f) => f.id === series.familyId);
    records.push({
      id: `search-${series.id}`,
      type: 'Series',
      title: series.name,
      subtitle: series.description,
      hierarchy: [fam ? fam.shortName : 'Environments', series.code, series.name],
      route: `/environments/${series.familySlug}#${series.slug}`,
      domain: fam?.shortName ?? 'Environments',
      keywords: [series.name, series.description, series.objective ?? '', ...(series.learningObjectives ?? [])],
    });
  }

  // 3. All Episodes
  for (const ep of allEpisodes) {
    const fam = environmentFamilies.find((f) => f.id === ep.familyId);
    records.push({
      id: `search-${ep.id}`,
      type: 'Episode',
      title: ep.name,
      subtitle: ep.objective,
      hierarchy: [
        fam ? fam.shortName : 'Environments',
        ep.parentSeriesName ? `${ep.seriesName} · ${ep.parentSeriesName}` : ep.seriesName,
        ep.name,
      ],
      route: `/episodes/${ep.slug}`,
      domain: fam?.shortName ?? ep.seriesName,
      keywords: [
        ep.name,
        ep.description,
        ep.objective,
        ...ep.learningObjectives,
        ...ep.technicalCapabilities,
        ep.finalChallenge ?? '',
      ],
    });
  }

  // 4. Infrastructure Divisions & Individual Features
  for (const div of researchDivisions) {
    records.push({
      id: `search-${div.id}`,
      type: 'Infrastructure',
      title: div.name,
      subtitle: div.summary,
      hierarchy: ['Infrastructure', `Division ${div.number}`, div.name],
      route: `/infrastructure/${div.slug}`,
      domain: 'Research Infrastructure',
      keywords: [div.name, div.description, ...div.features],
    });

    div.features.forEach((feat, idx) => {
      records.push({
        id: `search-${div.id}-feat-${idx}`,
        type: 'Feature',
        title: feat,
        subtitle: `Technical capability in ${div.name}`,
        hierarchy: ['Infrastructure', div.name, feat],
        route: `/infrastructure/${div.slug}`,
        domain: div.name,
        keywords: [feat, div.name, div.summary],
      });
    });
  }

  // 5. Specialized Agents
  for (const agent of specializedAgents) {
    records.push({
      id: `search-${agent.id}`,
      type: 'Agent',
      title: agent.name,
      subtitle: agent.summary,
      hierarchy: ['Agentic AI', `Agent ${agent.code}`, agent.name],
      route: `/agentic-ai#${agent.slug}`,
      domain: agent.primaryDomain,
      keywords: [agent.name, agent.primaryDomain, ...agent.responsibilities],
    });
  }

  // 6. LIIO Capabilities
  for (const cap of liioCapabilities) {
    records.push({
      id: `search-${cap.id}`,
      type: 'LIIO',
      title: cap.name,
      subtitle: cap.description,
      hierarchy: ['LIIO', cap.category, cap.name],
      route: `/liio#${cap.id}`,
      domain: 'Interpretability & LIIO',
      keywords: [cap.name, cap.description, cap.researchFocus, ...cap.connectedSystems],
    });
  }

  // 7. Research Questions
  for (const rq of researchQuestions) {
    records.push({
      id: `search-${rq.id}`,
      type: 'Research Question',
      title: rq.question,
      subtitle: `${rq.category} · Status: ${rq.status}`,
      hierarchy: ['Research Register', `Question ${rq.number}`, rq.category],
      route: `/research/register#${rq.id}`,
      domain: rq.category,
      keywords: [rq.question, rq.category, rq.objective, rq.futureExperimentField],
    });
  }

  // 8. ThinkNet Data Generator
  records.push({
    id: 'search-data-generator',
    type: 'Infrastructure',
    title: 'ThinkNet Synthetic Data Generator',
    subtitle: 'Generate curriculum-aligned SFT, RLVR, DPO, and Reasoning Distillation samples per episode',
    hierarchy: ['Data Engineering', 'Training Data Exporter', 'ThinkNet Data Generator'],
    route: '/data-generator',
    domain: 'Data Engineering',
    keywords: ['Data Generator', 'Synthetic Data', 'JSONL', 'SFT', 'RLVR', 'DPO', 'Distillation'],
  });

  return records;
}

export const searchIndex: SearchRecord[] = buildSearchIndex();

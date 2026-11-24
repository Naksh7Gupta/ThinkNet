export type FamilySlug =
  | 'intelligence-research'
  | 'real-world-engineering'
  | 'low-level-engineering'
  | 'agentic-generative';

export type DifficultyLevelId =
  | 'foundation'
  | 'intermediate'
  | 'advanced'
  | 'professional'
  | 'research';

export interface DifficultyLevel {
  level: number;
  id: DifficultyLevelId;
  name: string;
  description: string;
}

export interface EnvironmentFamily {
  id: string;
  number: string;
  slug: FamilySlug;
  name: string;
  shortName: string;
  tagline: string;
  objective: string;
  description: string;
  seriesIds: string[];
  accentColor: string;
}

export interface EnvironmentSeries {
  id: string;
  slug: string;
  code: string;
  name: string;
  familyId: string;
  familySlug: FamilySlug;
  parentSeriesName?: string;
  description: string;
  objective?: string;
  researchNote?: string;
  learningObjectives?: string[];
  episodeIds: string[];
}

export interface Episode {
  id: string;
  slug: string;
  number: string;
  name: string;
  familyId: string;
  familySlug: FamilySlug;
  seriesId: string;
  seriesName: string;
  parentSeriesName?: string;
  description: string;
  objective: string;
  learningObjectives: string[];
  technicalCapabilities: string[];
  expectedCompetencies: string[];
  finalChallenge?: string;
  specialNotes?: string[];
  relatedEpisodeIds: string[];
  relatedEnvironmentIds: string[];
  isSpecialEpisode?: boolean;
  isCrossEnvironment?: boolean;
  crossEnvironmentSteps?: string[];
  crossEnvironmentResearchObjective?: string;
  simulatedCompanyRoles?: string[];
  auditMetricsExample?: {
    note: string;
    dimensions: string[];
  };
  inspirationNote?: string;
}

export interface ResearchDivision {
  id: string;
  slug: string;
  number: string;
  name: string;
  summary: string;
  description: string;
  features: string[];
  upstreamIds: string[];
  downstreamIds: string[];
  relatedAgentIds: string[];
}

export interface Agent {
  id: string;
  slug: string;
  code: string;
  name: string;
  primaryDomain: string;
  summary: string;
  responsibilities: string[];
  relatedInfrastructureIds: string[];
  connectedAgentIds: string[];
  autonomyScope: string;
}

export interface AutonomyLevel {
  level: number;
  name: string;
  summary: string;
  permissions: string[];
  safeguards: string[];
}

export interface LoopStage {
  id: string;
  stage: string;
  timing: string;
  actions: string[];
}

export interface LIIOCapability {
  id: string;
  number: string;
  name: string;
  category: 'Structural' | 'Attention & MLP' | 'Representational' | 'Experimental';
  description: string;
  researchFocus: string;
  connectedSystems: string[];
}

export interface ResearchQuestion {
  id: string;
  number: string;
  question: string;
  category: string;
  objective: string;
  status: 'Proposed';
  futureExperimentField: string;
  relatedDivisionIds: string[];
  relatedFamilySlugs: FamilySlug[];
}

export interface EngineComponent {
  number: string;
  id: string;
  name: string;
  layer: 'Definition' | 'Generation' | 'Execution' | 'Measurement' | 'Integration';
  description: string;
}

export interface TrainingMechanism {
  id: string;
  number: string;
  name: string;
  summary: string;
  mechanismDetail: string;
  examples?: string[];
}

export interface DevelopmentPhase {
  phase: string;
  title: string;
  items: string[];
}

export interface EngineeringPrinciple {
  number: string;
  title: string;
  description: string;
}

export type SearchItemType =
  | 'Family'
  | 'Series'
  | 'Episode'
  | 'Infrastructure'
  | 'Feature'
  | 'Agent'
  | 'LIIO'
  | 'Research Question';

export interface SearchRecord {
  id: string;
  type: SearchItemType;
  title: string;
  subtitle: string;
  hierarchy: string[];
  route: string;
  domain: string;
  keywords: string[];
}

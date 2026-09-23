export type ApiErrorBody = {
  error: { code: string; message: string; details?: unknown };
};
export type CareerTarget = { role: string; grade: string };
export type WorkforceScenario = {
  internalCoveragePercent: number;
  percentages: Record<
    "threeMonths" | "sixMonths" | "mobility" | "external",
    number
  >;
  existing: number;
  threeMonths: number;
  sixMonths: number;
  mobility: number;
  external: number;
  needed: number;
  months: number;
};
export type ImportResult = {
  counts: Record<string, number>;
  results: {
    id: string;
    name: string;
    recommendations: number;
    topActivity: string | null;
  }[];
};
export type LearningCatalogEntry = {
  activityId: string;
  unitTypes: string[];
  difficulty: number;
  estimatedMinutes: number;
  skillId: string;
  published?: boolean;
};

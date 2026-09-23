export type Skill = {
  id: string;
  skillCode: string;
  name: string;
  category: string;
};
export type Requirement = {
  role: string;
  grade: string;
  skillId: string;
  requiredLevel: number;
  weight: number;
};
export type SkillGain = { skillId: string; gain: number; maxLevel: number };
export type Activity = {
  id: string;
  eventCode: string;
  name: string;
  type: string;
  category: string;
  description: string;
  hours: number;
  businessPriority: number;
  minTenureMonths: number;
  gains: SkillGain[];
};
export type History = {
  eventId: string;
  status: "COMPLETED" | "SKIPPED" | "DECLINED" | "IN_PROGRESS";
  createdAt: string;
  completedAt: string | null;
};
export type Employee = {
  id: string;
  employeeId: string;
  name: string;
  role: string;
  grade: string;
  department: string;
  tenureMonths: number;
  targetRole: string;
  targetGrade: string;
  skills: { skillId: string; level: number }[];
  history: History[];
};
export type Factors = {
  critical_skill_gap: number;
  next_grade_relevance: number;
  completion_probability: number;
  career_goal_alignment: number;
  activity_skill_gain: number;
  business_priority: number;
  diversity_bonus: number;
  skip_penalty: number;
};
export type Explanation = {
  summary: string;
  reasons: string[];
  impact: string;
  why_not_alternative: string;
  source: "deterministic" | "llm";
};
export type Candidate = {
  activity: Activity;
  score: number;
  factors: Factors;
  before: number;
  after: number;
  changes: { skillId: string; from: number; to: number; required: number }[];
  explanation: Explanation;
};
export type Mission = {
  id: string;
  eventId: string;
  name: string;
  description: string;
  duration: number;
  commitment: number;
  skills: { skillId: string; requiredLevel: number }[];
};
export type CareerView = {
  readiness: number;
  requirements: Requirement[];
  gaps: Requirement[];
  metCount: number;
  criticalGapCount: number;
  candidates: Candidate[];
  recommendations: Candidate[];
  requiredActivityIds: string[];
  relevantActivityIds: string[];
};
export type Snapshot = {
  access?: {
    role: import("@shared/constants/roles").UserRole;
    canEdit: boolean;
    basePath: string;
  };
  career: CareerView;
  careerViews: Record<string, CareerView>;
  requiredAcrossCareers: string[];
  activityCandidates: Candidate[];
  skillDetails: Record<
    string,
    { level: number; required: number; gap: number }
  >;
  missionMatches: Record<string, number>;
  employee: Employee;
  skills: Skill[];
  events: Activity[];
  requirements: Requirement[];
  recommendations: Candidate[];
  routes: {
    role: string;
    grade: string;
    readiness: number;
    gaps: number;
    activities: number;
    gapSkillIds: string[];
  }[];
  missions: Mission[];
};
export type WorkforceEmployee = {
  nearTarget: boolean;
  routeLabel: string;
  id: string;
  name: string;
  role: string;
  grade: string;
  department: string;
  readiness: number;
  engagement: number;
  criticalGaps: number;
  recommendationCount: number;
  completed: number;
  skills: { skillId: string; level: number }[];
};
export type Workforce = {
  employees: WorkforceEmployee[];
  skills: Skill[];
  events: Activity[];
  gaps: {
    skillId: string;
    name: string;
    affected: number;
    critical: number;
    nearTarget: number;
    available: number;
    percent: number;
  }[];
  metrics: {
    nearTarget: number;
    uncovered: number;
    readiness: number;
    coverage: number;
    completion: number;
    critical: number;
  };
  participation: { month: string; completed: number; started: number }[];
};

export type { UserRole } from "@shared/constants/roles";
export type Role = { role: string; grade: string };
export type CareerRequirement = Requirement;
export type ActivityHistory = History;
export type Recommendation = Candidate;
export type RecommendationFactor = keyof Factors;

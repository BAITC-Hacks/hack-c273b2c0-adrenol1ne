import type { Activity, Candidate } from "./types";

export const LEARNING_UNIT_TYPES = [
  "COURSE",
  "VIDEO",
  "ARTICLE",
  "QUIZ",
  "AI_TASK",
  "CASE_STUDY",
  "CODING_TASK",
  "PROJECT",
  "MENTOR_SESSION",
  "ASSESSMENT",
  "CERTIFICATION",
] as const;
export type LearningUnitType = (typeof LEARNING_UNIT_TYPES)[number];
export type LearningUnitStatus =
  | "LOCKED"
  | "AVAILABLE"
  | "IN_PROGRESS"
  | "COMPLETED"
  | "FAILED";
export type QuizQuestionView = {
  id: string;
  text: string;
  answers: string[];
  topic: string;
  skillId: string;
  difficulty: number;
};
export type LearningContent = {
  sections?: { title: string; body: string }[];
  prompt?: string;
  deliverables?: string[];
  syntheticData?: string;
  questions?: QuizQuestionView[];
  basicPractice?: boolean;
  externalUrl?: string;
  providerName?: string;
  courseId?: string;
};
export type AssessmentConfig = {
  questions?: {
    id: string;
    correctAnswer: number;
    explanation: string;
    topic: string;
  }[];
  rubric?: Record<string, number>;
};
export type LearningUnitDefinition = {
  id: string;
  title: string;
  description: string;
  type: LearningUnitType;
  estimatedMinutes: number;
  order: number;
  required: boolean;
  skillId: string;
  difficulty: number;
  content: LearningContent;
  learningObjectives: string[];
  externalUrl?: string;
  providerName?: string;
  externalCourseId?: string;
  completionRequirement?: string;
  masteryPoints: number;
  assessmentConfig?: AssessmentConfig;
  isRemediation?: boolean;
};
export type LearningPathDefinition = {
  title: string;
  description: string;
  skillId: string;
  fromLevel: number;
  toLevel: number;
  audience: string;
  learningObjectives: string[];
  units: LearningUnitDefinition[];
  masteryThreshold: number;
  requiresApproval: boolean;
};
export type AssessmentContext = {
  currentLevel: number;
  targetLevel: number;
  careerTarget: string;
};
export type AssessmentEvaluation = {
  score: number;
  dimensions: Record<string, number>;
  strengths: string[];
  improvements: string[];
  nextTaskSuggestion: string;
  weakTopics: string[];
  source: "deterministic" | "llm";
  correctAnswers?: number;
  totalQuestions?: number;
  questionResults?: {
    id: string;
    correct: boolean;
    correctAnswer: number;
    explanation: string;
  }[];
};
export type LearningProgressInput = {
  unitId: string;
  status: LearningUnitStatus;
  score?: number | null;
};
export type AdaptiveDecision = {
  mode: "ADVANCED" | "NORMAL" | "REMEDIATION";
  skipBasicPractice: boolean;
  weakTopics: string[];
  reviewTopics: string[];
};
export type LearningUnitProgressView = {
  submission: string | null;
  answers: Record<string, number> | null;
  score: number | null;
  feedback: AssessmentEvaluation | null;
  attempts: number;
  masteryPoints: number;
  completedAt: string | null;
  skipped: boolean;
};
export type LearningUnitView = Omit<
  LearningUnitDefinition,
  "assessmentConfig"
> & {
  status: LearningUnitStatus;
  progress: LearningUnitProgressView | null;
  canSkip: boolean;
  rubric?: Record<string, number>;
};
export type SkillEvidenceView = {
  id: string;
  skillId: string;
  skillName: string;
  activityId: string;
  activityName: string;
  unitId: string | null;
  title: string;
  type: string;
  level: number;
  score: number | null;
  confidence: number;
  summary: string;
  verified: boolean;
  createdAt: string;
  verifiedAt: string | null;
};
export type DevelopmentMilestone = {
  changes: { skillId: string; name: string; from: number; to: number }[];
  readinessBefore: number;
  readinessAfter: number;
  evidenceConfidence: number;
  nextRecommendation: Candidate | null;
};
export type ActivityWorkspace = {
  activity: Activity;
  employee: {
    id: string;
    name: string;
    targetRole: string;
    targetGrade: string;
  };
  path: {
    id: string;
    title: string;
    description: string;
    skillId: string;
    skillName: string;
    fromLevel: number;
    toLevel: number;
    audience: string;
    masteryThreshold: number;
    requiresApproval: boolean;
    learningObjectives: string[];
    estimatedMinutes: number;
  };
  enrollment: {
    id: string;
    status: string;
    startedAt: string;
    completedAt: string | null;
    verifiedAt: string | null;
    approvalStatus: "NOT_REQUIRED" | "PENDING" | "APPROVED" | "REJECTED";
    approvalComment: string | null;
    masteryPoints: number;
    progressPercent: number;
    completedUnits: number;
    totalUnits: number;
    remainingMinutes: number;
  } | null;
  units: LearningUnitView[];
  impact: {
    skills: { skillId: string; name: string; from: number; to: number }[];
    readinessBefore: number;
    readinessAfter: number;
  };
  evidence: SkillEvidenceView[];
  milestone: DevelopmentMilestone | null;
  legacyCompleted: boolean;
  canVerify: boolean;
  verificationBlockedReasons: string[];
};
export type LearningUnitAction = {
  unitId: string;
  action: "start" | "complete" | "submit" | "skip";
  submission?: string;
  answers?: Record<string, number>;
};
export type LearningPathBuilderInput = {
  skillId: string;
  fromLevel: number;
  toLevel: number;
  audience: string;
  title?: string;
};
export type LearningPathDraft = LearningPathDefinition & {
  status: "DRAFT";
  generator: "deterministic";
  estimatedMinutes: number;
};
export type DevelopmentPathReport = {
  id: string;
  activityId: string;
  title: string;
  skillId: string;
  skillName: string;
  fromLevel: number;
  toLevel: number;
  audience: string;
  requiresApproval: boolean;
  units: number;
  estimatedMinutes: number;
  employeesStarted: number;
  employeesCompleted: number;
  completionRate: number;
  skillAdvancements: number;
  averageAssessmentScore: number | null;
  averageTimeToMasteryMinutes: number | null;
  dropOffPoint: string | null;
  unitStats: {
    id: string;
    title: string;
    started: number;
    completed: number;
    failed: number;
  }[];
};
export type DevelopmentReport = {
  paths: DevelopmentPathReport[];
  skills: { id: string; name: string }[];
  approvals: {
    enrollmentId: string;
    employeeId: string;
    employeeName: string;
    activityId: string;
    activityName: string;
    masteryPoints: number;
    submittedAt: string;
    projectScore: number | null;
    projectTitle?: string | null;
    projectSubmission?: string | null;
    projectFeedback?: AssessmentEvaluation | null;
  }[];
  metrics: {
    learningPaths: number;
    employeesStarted: number;
    employeesCompleted: number;
    completionRate: number;
    averageAssessmentScore: number | null;
    skillsDeveloped: number;
    averageTimeToMasteryMinutes: number | null;
  };
};

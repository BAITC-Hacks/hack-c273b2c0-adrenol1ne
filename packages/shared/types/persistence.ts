// Storage-neutral records used by repository interfaces. Dates stay server-side.
export type EmployeeRecord = {
  id: string;
  employeeId: string;
  name: string;
  role: string;
  grade: string;
  department: string;
  tenureMonths: number;
  targetRole: string;
  targetGrade: string;
};
export type SkillRecord = {
  id: string;
  skillCode: string;
  name: string;
  category: string;
};
export type EmployeeSkillRecord = {
  employeeId: string;
  skillId: string;
  level: number;
};
export type GradeRequirementRecord = {
  id: string;
  role: string;
  grade: string;
  skillId: string;
  requiredLevel: number;
  weight: number;
};
export type EventRecord = {
  id: string;
  eventCode: string;
  name: string;
  type: string;
  category: string;
  description: string;
  hours: number;
  businessPriority: number;
  minTenureMonths: number;
};
export type EventSkillGainRecord = {
  eventId: string;
  skillId: string;
  gain: number;
  maxLevel: number;
};
export type ActivityHistoryRecord = {
  id: string;
  employeeId: string;
  eventId: string;
  status: string;
  completedAt: Date | null;
  createdAt: Date;
};
export type RecommendationRecord = {
  id: string;
  employeeId: string;
  eventId: string;
  score: number;
  explanation: string;
  fingerprint: string;
  createdAt: Date;
};
export type MissionRecord = {
  id: string;
  eventId: string;
  name: string;
  description: string;
  duration: number;
  commitment: number;
};
export type MissionSkillRecord = {
  missionId: string;
  skillId: string;
  requiredLevel: number;
};
export type LearningPathRecord = {
  id: string;
  eventId: string;
  title: string;
  description: string;
  skillId: string;
  fromLevel: number;
  toLevel: number;
  audience: string;
  learningObjectives: string;
  masteryThreshold: number;
  requiresApproval: boolean;
  createdAt: Date;
};
export type LearningUnitRecord = {
  id: string;
  pathId: string;
  enrollmentId: string | null;
  title: string;
  description: string;
  type: string;
  estimatedMinutes: number;
  order: number;
  required: boolean;
  skillId: string;
  difficulty: number;
  content: string;
  learningObjectives: string;
  completionRequirement: string | null;
  masteryPoints: number;
  assessmentConfig: string | null;
  isRemediation: boolean;
};
export type LearningEnrollmentRecord = {
  id: string;
  employeeId: string;
  pathId: string;
  status: string;
  startedAt: Date;
  completedAt: Date | null;
  verifiedAt: Date | null;
  approvalStatus: string;
  approvalComment: string | null;
  approvedAt: Date | null;
  readinessBefore: number;
  configuredGains: string;
  startingSkills: string;
  milestone: string | null;
};
export type LearningUnitProgressRecord = {
  id: string;
  enrollmentId: string;
  unitId: string;
  status: string;
  submission: string | null;
  answers: string | null;
  score: number | null;
  feedback: string | null;
  attempts: number;
  skipped: boolean;
  startedAt: Date;
  completedAt: Date | null;
};
export type AssessmentResultRecord = {
  id: string;
  enrollmentId: string;
  unitId: string;
  score: number;
  passed: boolean;
  evaluation: string;
  submission: string | null;
  answers: string | null;
  createdAt: Date;
};
export type SkillEvidenceRecord = {
  id: string;
  employeeId: string;
  enrollmentId: string;
  unitId: string | null;
  skillId: string;
  type: string;
  title: string;
  level: number;
  score: number | null;
  confidence: number;
  summary: string;
  verifiedAt: Date | null;
  createdAt: Date;
};
export type ManagerTeamRecord = {
  managerId: string;
  department: string;
};
export type AuditEventRecord = {
  id: string;
  actorId: string;
  actorRole: string;
  action: string;
  entityType: string;
  entityId: string;
  timestamp: Date;
  metadata: string;
};

import type {
  Activity,
  Employee,
  History,
  Mission,
  Requirement,
  Skill,
} from "@shared/types";
import type * as R from "@shared/types/persistence";

export type { Enrollment } from "@shared/types/reporting-base";
import type { Enrollment } from "@shared/types/reporting-base";
export type ReviewEnrollment = Enrollment & {
  path: R.LearningPathRecord & { units: R.LearningUnitRecord[] };
};
export type EvidenceWithContext = R.SkillEvidenceRecord & {
  skill: Skill;
  enrollment: R.LearningEnrollmentRecord & {
    path: R.LearningPathRecord & { event: R.EventRecord };
  };
};
export type { ReportPath } from "@shared/types/reporting";
import type { ReportPath } from "@shared/types/reporting";
type New<T, K extends keyof T> = Pick<T, K> & Partial<Omit<T, K>>;
export type PathInput = Omit<R.LearningPathRecord, "createdAt">;
export type UnitInput = New<
  R.LearningUnitRecord,
  | "id"
  | "pathId"
  | "title"
  | "description"
  | "type"
  | "estimatedMinutes"
  | "order"
  | "required"
  | "skillId"
  | "difficulty"
  | "content"
  | "learningObjectives"
  | "masteryPoints"
>;
export type EnrollmentInput = Pick<
  R.LearningEnrollmentRecord,
  | "employeeId"
  | "pathId"
  | "readinessBefore"
  | "configuredGains"
  | "startingSkills"
  | "approvalStatus"
>;
export type ProgressInput = Partial<
  Omit<R.LearningUnitProgressRecord, "id" | "enrollmentId" | "unitId">
>;
export type AssessmentInput = Omit<
  R.AssessmentResultRecord,
  "id" | "createdAt"
>;
export type EvidenceInput = New<
  R.SkillEvidenceRecord,
  | "employeeId"
  | "enrollmentId"
  | "skillId"
  | "type"
  | "title"
  | "level"
  | "confidence"
  | "summary"
>;
export type HistoryInput = {
  employeeId: string;
  eventId: string;
  status: History["status"];
  completedAt?: Date | null;
  createdAt?: Date;
};

export interface EmployeeRepository {
  getById(id: string): Promise<Employee | null>;
  getByExternalId(id: string): Promise<Employee | null>;
  list(departments?: string[]): Promise<Employee[]>;
  updateTarget(id: string, role: string, grade: string): Promise<void>;
  updateSkill(id: string, skillId: string, level: number): Promise<void>;
  saveImported(employee: Omit<Employee, "history">): Promise<void>;
}
export interface SkillRepository {
  list(): Promise<Skill[]>;
  getById(id: string): Promise<Skill | null>;
  save(skill: Skill): Promise<void>;
}
export interface ActivityRepository {
  list(): Promise<Activity[]>;
  listWithPaths(): Promise<
    (Activity & { learningPath: R.LearningPathRecord | null })[]
  >;
  getById(id: string): Promise<Activity | null>;
  save(activity: Activity): Promise<void>;
  create(activity: Activity): Promise<void>;
  missions(): Promise<Mission[]>;
}
export interface CareerRepository {
  requirements(): Promise<Requirement[]>;
  saveRequirement(value: Requirement): Promise<void>;
}
export interface HistoryRepository {
  save(value: HistoryInput): Promise<void>;
}
export interface RecommendationRepository {
  get(
    employeeId: string,
    activityId: string,
  ): Promise<R.RecommendationRecord | null>;
  save(
    value: Pick<
      R.RecommendationRecord,
      "employeeId" | "eventId" | "score" | "explanation" | "fingerprint"
    >,
  ): Promise<void>;
  invalidate(employeeId?: string): Promise<void>;
}
export interface LearningRepository {
  pathForActivity(activityId: string): Promise<R.LearningPathRecord | null>;
  createPath(value: PathInput): Promise<R.LearningPathRecord>;
  createUnit(value: UnitInput): Promise<void>;
  getUnit(id: string): Promise<R.LearningUnitRecord | null>;
  units(pathId: string, enrollmentId?: string): Promise<R.LearningUnitRecord[]>;
  enrollment(employeeId: string, pathId: string): Promise<Enrollment | null>;
  enrollmentById(id: string): Promise<Enrollment | null>;
  enrollmentForReview(id: string): Promise<ReviewEnrollment | null>;
  createEnrollment(value: EnrollmentInput): Promise<void>;
  updateEnrollment(
    id: string,
    patch: Partial<
      Pick<
        R.LearningEnrollmentRecord,
        | "status"
        | "completedAt"
        | "verifiedAt"
        | "milestone"
        | "approvalStatus"
        | "approvalComment"
        | "approvedAt"
      >
    >,
  ): Promise<void>;
  saveProgress(
    enrollmentId: string,
    unitId: string,
    value: ProgressInput,
  ): Promise<void>;
  addAssessment(value: AssessmentInput): Promise<void>;
  catalog(): Promise<
    (R.LearningPathRecord & { units: R.LearningUnitRecord[] })[]
  >;
  report(departments?: string[]): Promise<ReportPath[]>;
}
export interface EvidenceRepository {
  forEmployee(id: string): Promise<EvidenceWithContext[]>;
  forEnrollment(id: string): Promise<R.SkillEvidenceRecord[]>;
  mentorValidation(enrollmentId: string): Promise<R.SkillEvidenceRecord | null>;
  saveUnit(value: EvidenceInput & { unitId: string }): Promise<void>;
  add(value: EvidenceInput): Promise<void>;
  verifySkill(
    enrollmentId: string,
    skillId: string,
    level: number,
    verifiedAt: Date,
  ): Promise<void>;
}
export interface ManagerRepository {
  departments(managerId: string): Promise<string[]>;
  assign(managerId: string, department: string): Promise<void>;
}
export interface AuditRepository {
  append(value: Omit<R.AuditEventRecord, "id" | "timestamp">): Promise<void>;
  list(limit: number): Promise<R.AuditEventRecord[]>;
}
export interface RepositoryContext {
  employees: EmployeeRepository;
  skills: SkillRepository;
  activities: ActivityRepository;
  career: CareerRepository;
  history: HistoryRepository;
  recommendations: RecommendationRepository;
  learning: LearningRepository;
  evidence: EvidenceRepository;
  managers: ManagerRepository;
  audit: AuditRepository;
}
export interface UnitOfWork extends RepositoryContext {
  transaction<T>(
    work: (repositories: RepositoryContext) => Promise<T>,
    options?: { timeout?: number },
  ): Promise<T>;
}

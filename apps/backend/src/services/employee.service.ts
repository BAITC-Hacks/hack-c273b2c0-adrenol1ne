import { repositories } from "@backend/repositories";
import { catalog } from "./catalog.service";
import { RecommendationService } from "./recommendation.service";
import { careerView } from "@domain/career/career";
import { describeSkills } from "@domain/skills/skills";
import { NotFoundError } from "@backend/errors/app-error";
import { AuditService } from "./audit.service";
import type { Employee, Snapshot } from "@shared/types";
export { catalog } from "./catalog.service";
export async function getEmployee(id: string): Promise<Employee> {
  const employee = await repositories.employees.getById(id);
  if (!employee)
    throw new NotFoundError("Employee not found", "EMPLOYEE_NOT_FOUND");
  return employee;
}
export async function snapshot(id: string): Promise<Snapshot> {
  const [employee, data] = await Promise.all([getEmployee(id), catalog()]);
  const targets = Array.from(
    new Set([
      ...data.requirements.map((r) => r.role + "|" + r.grade),
      employee.targetRole + "|" + employee.targetGrade,
    ]),
  );
  const careerViews = Object.fromEntries(
    targets.map((key) => {
      const [role, grade] = key.split("|");
      const twin = { ...employee, targetRole: role, targetGrade: grade };
      const career = careerView(twin, data.requirements),
        candidates = RecommendationService.candidates(twin, data);
      return [
        key,
        {
          ...career,
          candidates,
          recommendations: RecommendationService.calculate(twin, data),
          requiredActivityIds: candidates
            .filter((c) =>
              c.changes.some((g) => g.to > g.from && g.required > g.from),
            )
            .map((c) => c.activity.id),
          relevantActivityIds: data.events
            .filter((e) =>
              e.gains.some((g) =>
                career.requirements.some((r) => r.skillId === g.skillId),
              ),
            )
            .map((e) => e.id),
        },
      ];
    }),
  );
  const current = careerViews[employee.targetRole + "|" + employee.targetGrade];
  await AuditService.record({
    action: "RECOMMENDATION_GENERATED",
    entityType: "Employee",
    entityId: id,
    metadata: {
      activityIds: current.recommendations.map((r) => r.activity.id),
      scores: current.recommendations.map((r) => r.score),
    },
  });
  return {
    employee,
    ...data,
    requiredAcrossCareers: [
      ...new Set(
        Object.values(careerViews).flatMap((v) => v.requiredActivityIds),
      ),
    ],
    recommendations: current.recommendations,
    career: current,
    careerViews,
    activityCandidates: current.candidates,
    skillDetails: describeSkills(employee, current.requirements, data.skills),
    missionMatches: Object.fromEntries(
      data.missions.map((m) => [
        m.id,
        m.skills.filter(
          (s) =>
            (employee.skills.find((e) => e.skillId === s.skillId)?.level ??
              0) >= s.requiredLevel,
        ).length,
      ]),
    ),
    routes: targets
      .filter((key) => !key.endsWith("|Middle"))
      .map((key) => {
        const [role, grade] = key.split("|"),
          view = careerViews[key];
        return {
          role,
          grade,
          readiness: view.readiness,
          gaps: view.gaps.length,
          gapSkillIds: view.gaps.map((r) => r.skillId),
          activities: view.gaps.reduce(
            (sum, r) =>
              sum +
              Math.max(
                0,
                r.requiredLevel -
                  (employee.skills.find((s) => s.skillId === r.skillId)
                    ?.level ?? 0),
              ),
            0,
          ),
        };
      }),
  };
}
export class EmployeeService {
  static dashboard = snapshot;
  static getById = getEmployee;
}

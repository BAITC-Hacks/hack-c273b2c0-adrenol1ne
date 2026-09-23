import type { Employee, Requirement } from "@shared/types";
import { readiness, requirementsFor } from "./readiness";
import { calculateSkillGap } from "@domain/skills/skills";
export function calculateCareerGap(
  employee: Employee,
  requirements: Requirement[],
) {
  return requirementsFor(employee, requirements).filter(
    (r) =>
      calculateSkillGap(
        employee.skills.find((s) => s.skillId === r.skillId)?.level ?? 0,
        r.requiredLevel,
      ) > 0,
  );
}
export function careerView(employee: Employee, requirements: Requirement[]) {
  const target = requirementsFor(employee, requirements),
    gaps = calculateCareerGap(employee, requirements);
  return {
    readiness: readiness(employee, requirements),
    requirements: target,
    gaps,
    metCount: target.length - gaps.length,
    criticalGapCount: gaps.filter(
      (r) =>
        calculateSkillGap(
          employee.skills.find((s) => s.skillId === r.skillId)?.level ?? 0,
          r.requiredLevel,
        ) >= 2,
    ).length,
  };
}
export function simulateTargetRole(
  employee: Employee,
  target: { role: string; grade: string },
  requirements: Requirement[],
) {
  return careerView(
    { ...employee, targetRole: target.role, targetGrade: target.grade },
    requirements,
  );
}

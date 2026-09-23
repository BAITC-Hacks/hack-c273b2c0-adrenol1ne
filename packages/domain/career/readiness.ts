import type { Employee, Requirement } from "@shared/types";
const clamp = (n: number) => Math.min(1, Math.max(0, n));
export function requirementsFor(
  employee: Employee,
  requirements: Requirement[],
) {
  return requirements.filter(
    (r) => r.role === employee.targetRole && r.grade === employee.targetGrade,
  );
}
export function readiness(
  employee: Employee,
  requirements: Requirement[],
  precision = 0,
): number {
  const target = requirementsFor(employee, requirements);
  const total = target.reduce((s, r) => s + r.weight, 0);
  if (!total) return 0;
  const scale = 10 ** precision;
  return (
    Math.round(
      (100 *
        scale *
        target.reduce(
          (s, r) =>
            s +
            r.weight *
              clamp(
                (employee.skills.find((x) => x.skillId === r.skillId)?.level ??
                  0) / r.requiredLevel,
              ),
          0,
        )) /
        total,
    ) / scale
  );
}
export {
  readiness as calculateCareerReadiness,
  requirementsFor as getCareerRequirements,
};

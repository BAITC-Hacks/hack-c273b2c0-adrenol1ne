import type { Activity, Employee, Requirement } from "@shared/types";
import { requirementsFor } from "@domain/career/readiness";
export function generateCandidates(
  employee: Employee,
  events: Activity[],
  requirements: Requirement[],
) {
  const target = requirementsFor(employee, requirements);
  if (!target.length) return [];
  const excluded = new Set(
    employee.history
      .filter((h) => h.status === "COMPLETED" || h.status === "DECLINED")
      .map((h) => h.eventId),
  );
  return events.filter(
    (e) =>
      !excluded.has(e.id) &&
      employee.tenureMonths >= e.minTenureMonths &&
      e.gains.some((g) => {
        const current =
          employee.skills.find((s) => s.skillId === g.skillId)?.level ?? 0;
        return (
          Math.min(5, g.maxLevel, current + g.gain) > current &&
          target.some(
            (r) => r.skillId === g.skillId && r.requiredLevel > current,
          )
        );
      }),
  );
}

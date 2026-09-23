import type { Employee, Activity, Requirement, Factors } from "@shared/types";
import { readiness, requirementsFor } from "@domain/career/readiness";
import { applySkillGains } from "@domain/activities/progression";
const clamp = (n: number) => Math.min(1, Math.max(0, n));
export function calculateFactors(
  employee: Employee,
  activity: Activity,
  events: Activity[],
  requirements: Requirement[],
) {
  const target = requirementsFor(employee, requirements);
  const maxWeight = Math.max(...target.map((r) => r.weight), 1e-6);
  const changes = activity.gains.map((g) => {
    const from =
      employee.skills.find((s) => s.skillId === g.skillId)?.level ?? 0;
    return {
      skillId: g.skillId,
      from,
      to: Math.max(from, Math.min(5, g.maxLevel, from + g.gain)),
      required: target.find((r) => r.skillId === g.skillId)?.requiredLevel ?? 0,
    };
  });
  const relevant = changes.filter((c) => c.to > c.from && c.required > c.from);
  const similar = employee.history.filter((h) => {
    const e = events.find((e) => e.id === h.eventId);
    return (
      e &&
      (e.category === activity.category ||
        e.gains.some((g) =>
          activity.gains.some((a) => a.skillId === g.skillId),
        ))
    );
  });
  const completed = similar.filter((h) => h.status === "COMPLETED").length;
  const skipped = similar.filter((h) => h.status === "SKIPPED").length;
  const declined = similar.filter((h) => h.status === "DECLINED").length;
  const resolved = similar.filter((h) => h.status !== "IN_PROGRESS").length;
  const own = employee.history.find((h) => h.eventId === activity.id);
  const before = readiness(employee, requirements);
  const after = readiness(applySkillGains(employee, activity), requirements);
  const currentRoleExposure = requirements.some(
    (r) =>
      r.role === employee.role &&
      r.grade === employee.grade &&
      activity.gains.some((g) => g.skillId === r.skillId),
  )
    ? 1
    : 0;
  const factors: Factors = {
    critical_skill_gap: clamp(
      relevant.reduce(
        (best, c) =>
          Math.max(
            best,
            ((c.required - c.from) / c.required) *
              (target.find((r) => r.skillId === c.skillId)!.weight /
                maxWeight) *
              2,
          ),
        0,
      ),
    ),
    next_grade_relevance: clamp(
      relevant.reduce(
        (s, c) => s + target.find((r) => r.skillId === c.skillId)!.weight,
        0,
      ) / maxWeight,
    ),
    completion_probability: clamp(
      0.8 * ((completed + 2) / (resolved + 3)) +
        0.1 * Math.min(employee.tenureMonths / 36, 1) +
        0.1 * currentRoleExposure,
    ),
    career_goal_alignment: relevant.length / Math.max(changes.length, 1),
    activity_skill_gain: clamp(
      (readiness(applySkillGains(employee, activity), requirements, 4) -
        readiness(employee, requirements, 4)) /
        15,
    ),
    business_priority: clamp(activity.businessPriority),
    diversity_bonus: similar.length ? 1 / (similar.length + 1) : 1,
    skip_penalty: clamp(
      skipped * 0.04 +
        declined * 0.07 +
        (own?.status === "SKIPPED" ? 0.08 : 0) +
        (own?.status === "DECLINED" ? 0.2 : 0),
    ),
  };

  return {
    target,
    changes,
    relevant,
    completed,
    resolved,
    before,
    after,
    factors,
  };
}

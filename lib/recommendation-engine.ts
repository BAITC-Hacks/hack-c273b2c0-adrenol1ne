import type {
  Activity,
  Candidate,
  Employee,
  Factors,
  Requirement,
  Skill,
} from "./types";

export const WEIGHTS = {
  critical_skill_gap: 0.3,
  next_grade_relevance: 0.2,
  completion_probability: 0.15,
  career_goal_alignment: 0.1,
  activity_skill_gain: 0.1,
  business_priority: 0.1,
  diversity_bonus: 0.05,
} as const;
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
export function applySkillGains(
  employee: Employee,
  activity: Activity,
): Employee {
  const levels = new Map(employee.skills.map((s) => [s.skillId, s.level]));
  for (const gain of activity.gains) {
    const level = levels.get(gain.skillId) ?? 0;
    levels.set(
      gain.skillId,
      Math.max(level, Math.min(5, gain.maxLevel, level + gain.gain)),
    );
  }
  return {
    ...employee,
    skills: Array.from(levels, ([skillId, level]) => ({ skillId, level })),
  };
}
export function scoreActivity(
  employee: Employee,
  activity: Activity,
  events: Activity[],
  requirements: Requirement[],
  skills: Skill[],
): Candidate {
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
  const score = clamp(
    Object.entries(WEIGHTS).reduce(
      (s, [k, w]) => s + w * factors[k as keyof typeof WEIGHTS],
      0,
    ) - factors.skip_penalty,
  );
  const primary = relevant[0] ?? changes[0];
  const skillName =
    skills.find((s) => s.id === primary?.skillId)?.name ?? "Relevant skills";
  const speaking = employee.skills.find(
    (s) => s.skillId === skills.find((s) => s.name === "Public Speaking")?.id,
  );
  const speakingRequired = target.some((r) => r.skillId === speaking?.skillId);
  const speakingSkips = employee.history.filter(
    (h) =>
      h.status === "SKIPPED" &&
      events.find((e) => e.id === h.eventId)?.category === "Communication",
  ).length;
  return {
    activity,
    score: Number(score.toFixed(4)),
    factors,
    before,
    after,
    changes,
    explanation: {
      source: "deterministic",
      summary: `${activity.name} ${relevant.length ? `addresses a requirement for ${employee.targetGrade} ${employee.targetRole}` : "builds breadth beyond your current career target"}.`,
      reasons: [
        primary && primary.required > primary.from
          ? `${skillName} is ${primary.required - primary.from} level${primary.required - primary.from === 1 ? "" : "s"} below the target requirement of ${primary.required}/5.`
          : `This activity builds ${skillName}.`,
        `${completed} of ${resolved} resolved activities in similar areas were completed; a smoothed completion estimate is ${Math.round(factors.completion_probability * 100)}%.`,
        `${relevant.length} target skill${relevant.length === 1 ? "" : "s"} improve, with ${Math.round(factors.next_grade_relevance * 100)}% weighted next-grade relevance.`,
      ],
      impact: `Completing this activity changes career readiness from ${before}% to ${after}%, a ${after - before} percentage-point gain.`,
      why_not_alternative:
        speaking && !speakingRequired
          ? `Public Speaking is ${speaking.level}/5, but it is not a requirement for ${employee.targetGrade} ${employee.targetRole}. ${speakingSkips} similar communication activities were skipped. ${skillName} has a direct relationship to this career target; the lowest skill alone does not determine priority.`
          : `Alternatives are compared using target requirements, attainable skill gains, participation history, tenure and business relevance. This activity scores ${(score * 100).toFixed(1)} out of 100.`,
    },
  };
}
export function rankActivities(
  employee: Employee,
  events: Activity[],
  requirements: Requirement[],
  skills: Skill[],
  limit = 3,
): Candidate[] {
  if (!requirementsFor(employee, requirements).length) return [];
  const excluded = new Set(
    employee.history
      .filter((h) => h.status === "COMPLETED" || h.status === "DECLINED")
      .map((h) => h.eventId),
  );
  return events
    .filter(
      (e) => !excluded.has(e.id) && employee.tenureMonths >= e.minTenureMonths,
    )
    .map((e) => scoreActivity(employee, e, events, requirements, skills))
    .filter((c) => c.changes.some((g) => g.to > g.from && g.required > g.from))
    .sort(
      (a, b) =>
        b.score - a.score ||
        a.activity.hours - b.activity.hours ||
        a.activity.id.localeCompare(b.activity.id),
    )
    .slice(0, limit);
}

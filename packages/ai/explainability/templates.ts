import type { Activity, Employee, Skill, Explanation } from "@shared/types";
import type { calculateFactors } from "@ai/recommendation/factors";
export function explainDeterministically({
  employee,
  activity,
  events,
  skills,
  calculation,
  score,
}: {
  employee: Employee;
  activity: Activity;
  events: Activity[];
  skills: Skill[];
  calculation: ReturnType<typeof calculateFactors>;
  score: number;
}): Explanation {
  const {
    target,
    changes,
    relevant,
    completed,
    resolved,
    before,
    after,
    factors,
  } = calculation;

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
  };
}

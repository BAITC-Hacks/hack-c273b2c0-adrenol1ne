import type { Employee, Workforce } from "@shared/types";
import { readiness, requirementsFor } from "@domain/career/readiness";
export function aggregateWorkforce(
  employees: Employee[],
  data: {
    skills: Workforce["skills"];
    events: Workforce["events"];
    requirements: import("@shared/types").Requirement[];
  },
  recommendationCounts: Record<string, number>,
  now = new Date(),
): Workforce {
  const rows = employees.map((e) => {
    const resolved = e.history.filter((h) => h.status !== "IN_PROGRESS");
    const completed = e.history.filter((h) => h.status === "COMPLETED").length;
    return {
      id: e.id,
      name: e.name,
      role: e.role,
      grade: e.grade,
      department: e.department,
      nearTarget: readiness(e, data.requirements) >= 80,
      routeLabel: e.targetGrade + " " + e.targetRole,
      skills: e.skills,
      readiness: readiness(e, data.requirements),
      engagement: resolved.length
        ? Math.round((completed / resolved.length) * 100)
        : 0,
      completed,
      recommendationCount: recommendationCounts[e.id] ?? 0,
      criticalGaps: requirementsFor(e, data.requirements).filter(
        (r) =>
          r.requiredLevel -
            (e.skills.find((s) => s.skillId === r.skillId)?.level ?? 0) >=
          2,
      ).length,
    };
  });
  const gaps = data.skills
    .map((skill) => {
      let affected = 0,
        critical = 0,
        nearTarget = 0,
        applicable = 0;
      for (const e of employees) {
        const r = requirementsFor(e, data.requirements).find(
          (r) => r.skillId === skill.id,
        );
        if (!r) continue;
        applicable++;
        const gap =
          r.requiredLevel -
          (e.skills.find((s) => s.skillId === skill.id)?.level ?? 0);
        if (gap > 0) affected++;
        if (gap >= 2) critical++;
        if (gap === 1) nearTarget++;
      }
      return {
        skillId: skill.id,
        name: skill.name,
        affected,
        critical,
        nearTarget,
        available: data.events.filter((e) =>
          e.gains.some((g) => g.skillId === skill.id),
        ).length,
        percent: applicable ? Math.round((affected / applicable) * 100) : 0,
      };
    })
    .filter((g) => g.affected > 0)
    .sort((a, b) => b.affected - a.affected);
  const all = employees.flatMap((e) => e.history);
  const resolved = all.filter((h) => h.status !== "IN_PROGRESS");
  const participation = Array.from({ length: 6 }, (_, i) => {
    const d = new Date(now);
    d.setDate(1);
    d.setMonth(d.getMonth() - 5 + i);
    const month = d.toISOString().slice(0, 7);
    return {
      month: d.toLocaleDateString("en", { month: "short" }),
      completed: all.filter((h) => h.completedAt?.startsWith(month)).length,
      started: all.filter((h) => h.createdAt.startsWith(month)).length,
    };
  });
  return {
    employees: rows,
    skills: data.skills,
    events: data.events,
    gaps,
    participation,
    metrics: {
      nearTarget: rows.filter((e) => e.readiness >= 80 && e.readiness < 100)
        .length,
      uncovered: rows.filter((e) => !e.recommendationCount).length,
      readiness: rows.length
        ? Math.round(rows.reduce((s, e) => s + e.readiness, 0) / rows.length)
        : 0,
      coverage: rows.length
        ? Math.round(
            (rows.filter((e) => e.recommendationCount > 0).length /
              rows.length) *
              100,
          )
        : 0,
      completion: resolved.length
        ? Math.round(
            (resolved.filter((h) => h.status === "COMPLETED").length /
              resolved.length) *
              100,
          )
        : 0,
      critical: rows.filter((e) => e.criticalGaps > 0).length,
    },
  };
}

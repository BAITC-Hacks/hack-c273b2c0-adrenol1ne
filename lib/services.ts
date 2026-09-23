import { db } from "./db";
import {
  rankActivities,
  readiness,
  requirementsFor,
} from "./recommendation-engine";
import type { Employee, History, Snapshot, Workforce } from "./types";

export async function catalog() {
  const [skills, events, requirements, missions] = await Promise.all([
    db.skill.findMany(),
    db.event.findMany({ include: { gains: true } }),
    db.gradeRequirement.findMany(),
    db.mission.findMany({ include: { skills: true } }),
  ]);
  return { skills, events, requirements, missions };
}
export async function getEmployee(id: string): Promise<Employee> {
  const employee = await db.employee.findUnique({
    where: { id },
    include: { skills: true, history: { orderBy: { createdAt: "desc" } } },
  });
  if (!employee) throw new Error("Employee not found");
  return {
    ...employee,
    history: employee.history.map((h) => ({
      ...h,
      status: h.status as History["status"],
      createdAt: h.createdAt.toISOString(),
      completedAt: h.completedAt?.toISOString() ?? null,
    })),
  };
}
export async function snapshot(id: string): Promise<Snapshot> {
  const [employee, data] = await Promise.all([getEmployee(id), catalog()]);
  const routes = Array.from(
    new Set(data.requirements.map((r) => `${r.role}|${r.grade}`)),
  )
    .filter((key) => !key.endsWith("|Middle"))
    .map((key) => {
      const [role, grade] = key.split("|");
      const twin = { ...employee, targetRole: role, targetGrade: grade };
      const req = requirementsFor(twin, data.requirements);
      const gaps = req.filter(
        (r) =>
          (employee.skills.find((s) => s.skillId === r.skillId)?.level ?? 0) <
          r.requiredLevel,
      );
      return {
        role,
        grade,
        readiness: readiness(twin, data.requirements),
        gaps: gaps.length,
        activities: gaps.reduce(
          (sum, r) =>
            sum +
            Math.max(
              0,
              r.requiredLevel -
                (employee.skills.find((s) => s.skillId === r.skillId)?.level ??
                  0),
            ),
          0,
        ),
      };
    });
  return {
    employee,
    ...data,
    recommendations: rankActivities(
      employee,
      data.events,
      data.requirements,
      data.skills,
    ),
    routes,
  };
}
export async function recordActivity(
  employeeId: string,
  eventId: string,
  status: History["status"],
) {
  if (status === "COMPLETED")
    throw new Error(
      "Skill advancement requires Activity Workspace assessments and verification.",
    );
  return db.$transaction(async (tx) => {
    const raw = await tx.employee.findUnique({
      where: { id: employeeId },
      include: { skills: true, history: true },
    });
    const event = await tx.event.findUnique({
      where: { id: eventId },
      include: { gains: true },
    });
    if (!raw || !event) throw new Error("Employee or activity not found");
    if (raw.tenureMonths < event.minTenureMonths)
      throw new Error("This activity's tenure requirement is not met.");
    const existing = raw.history.find((h) => h.eventId === eventId);
    if (existing?.status === "COMPLETED")
      return { alreadyCompleted: true, changes: [] };
    const changes: { skillId: string; from: number; to: number }[] = [];
    await tx.activityHistory.upsert({
      where: { employeeId_eventId: { employeeId, eventId } },
      create: {
        employeeId,
        eventId,
        status,
        completedAt: null,
      },
      update: {
        status,
        completedAt: null,
      },
    });
    await tx.recommendation.deleteMany({ where: { employeeId } });
    return { alreadyCompleted: false, changes };
  });
}
export async function workforce(): Promise<Workforce> {
  const [raw, data] = await Promise.all([
    db.employee.findMany({ include: { skills: true, history: true } }),
    catalog(),
  ]);
  const employees: Employee[] = raw.map((e) => ({
    ...e,
    history: e.history.map((h) => ({
      ...h,
      status: h.status as History["status"],
      createdAt: h.createdAt.toISOString(),
      completedAt: h.completedAt?.toISOString() ?? null,
    })),
  }));
  const rows = employees.map((e) => {
    const resolved = e.history.filter((h) => h.status !== "IN_PROGRESS");
    const completed = e.history.filter((h) => h.status === "COMPLETED").length;
    return {
      id: e.id,
      name: e.name,
      role: e.role,
      grade: e.grade,
      department: e.department,
      skills: e.skills,
      readiness: readiness(e, data.requirements),
      engagement: resolved.length
        ? Math.round((completed / resolved.length) * 100)
        : 0,
      completed,
      recommendationCount: rankActivities(
        e,
        data.events,
        data.requirements,
        data.skills,
      ).length,
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
    const d = new Date();
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

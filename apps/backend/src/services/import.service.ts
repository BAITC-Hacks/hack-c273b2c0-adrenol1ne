import { ValidationError } from "@backend/errors/app-error";
import { repositories } from "@backend/repositories";
import { AuditService } from "./audit.service";
import { getEmployee, catalog } from "./employee.service";
import { rankActivities } from "@ai/recommendation";
import { importSchema, type ImportBundle } from "@shared/schemas/import";
export { importSchema } from "@shared/schemas/import";
export { parseImportFiles } from "./import-parser";
export async function importDataset(input: ImportBundle) {
  const bundle = importSchema.parse(input);
  const existing = await Promise.all([
    repositories.skills.list(),
    repositories.employees.list(),
    repositories.activities.list(),
  ]);
  const skills = new Set([...existing[0], ...bundle.skills].map((x) => x.id));
  const employees = new Set(
    [...existing[1], ...bundle.employees].map((x) => x.id),
  );
  const events = new Set([...existing[2], ...bundle.events].map((x) => x.id));
  const missing: string[] = [];
  for (const entry of [
    ...bundle.employees.flatMap((e) => e.skills),
    ...bundle.events.flatMap((e) => e.gains),
    ...bundle.requirements,
  ])
    if (!skills.has(entry.skillId))
      missing.push(`Unknown skill ${entry.skillId}`);
  for (const h of bundle.history) {
    if (!employees.has(h.employeeId))
      missing.push(`Unknown employee ${h.employeeId}`);
    if (!events.has(h.eventId)) missing.push(`Unknown event ${h.eventId}`);
  }
  if (missing.length)
    throw new ValidationError([...new Set(missing)].slice(0, 10).join("; "));
  await repositories.transaction(
    async (tx) => {
      for (const s of bundle.skills) await tx.skills.save(s);
      for (const { gains, ...e } of bundle.events)
        await tx.activities.save({ ...e, gains });
      for (const { skills: levels, ...e } of bundle.employees)
        await tx.employees.saveImported({ ...e, skills: levels });
      for (const r of bundle.requirements) await tx.career.saveRequirement(r);
      for (const h of bundle.history)
        await tx.history.save({
          ...h,
          createdAt: new Date(h.createdAt),
          completedAt: h.completedAt ? new Date(h.completedAt) : null,
        });
      await tx.recommendations.invalidate();
      await AuditService.record(
        {
          action: "DATA_IMPORTED",
          entityType: "Dataset",
          entityId: "workforce",
          metadata: {
            employees: bundle.employees.length,
            skills: bundle.skills.length,
            events: bundle.events.length,
            history: bundle.history.length,
            requirements: bundle.requirements.length,
          },
        },
        tx.audit,
      );
    },
    { timeout: 60000 },
  );
  const data = await catalog();
  const affected =
    bundle.skills.length || bundle.events.length || bundle.requirements.length
      ? Array.from(employees)
      : Array.from(
          new Set([
            ...bundle.employees.map((e) => e.id),
            ...bundle.history.map((h) => h.employeeId),
          ]),
        );
  const results = [];
  for (const id of affected) {
    const e = await getEmployee(id);
    const recs = rankActivities(e, data.events, data.requirements, data.skills);
    results.push({
      id,
      name: e.name,
      recommendations: recs.length,
      topActivity: recs[0]?.activity.name ?? null,
    });
  }
  return {
    counts: {
      employees: bundle.employees.length,
      skills: bundle.skills.length,
      events: bundle.events.length,
      history: bundle.history.length,
      requirements: bundle.requirements.length,
    },
    results,
  };
}

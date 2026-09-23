import { z } from "zod";
import Papa from "papaparse";
import { db } from "./db";
import { getEmployee, catalog } from "./services";
import { rankActivities } from "./recommendation-engine";
const id = z
  .string()
  .trim()
  .min(1)
  .max(80)
  .regex(
    /^[a-zA-Z0-9_-]+$/,
    "IDs can contain letters, numbers, underscores and hyphens",
  );
const text = z.string().trim().min(1).max(200);
const level = z.number().int().min(0).max(5);
const skill = z.object({
  id,
  skillCode: id,
  name: text,
  category: z.enum(["Technical", "People", "Business"]),
});
const employee = z.object({
  id,
  employeeId: id,
  name: text,
  role: text,
  grade: text,
  department: text.default("Imported team"),
  tenureMonths: z.number().int().min(0).max(720),
  targetRole: text,
  targetGrade: text,
  skills: z.array(z.object({ skillId: id, level })).max(100),
});
const event = z.object({
  id,
  eventCode: id,
  name: text,
  type: text,
  category: text,
  description: z.string().max(2000),
  hours: z.number().int().min(1).max(2000),
  businessPriority: z.number().min(0).max(1),
  minTenureMonths: z.number().int().min(0).max(720).default(0),
  gains: z
    .array(
      z.object({
        skillId: id,
        gain: z.number().int().min(1).max(5),
        maxLevel: z.number().int().min(1).max(5),
      }),
    )
    .min(1)
    .max(100),
});
const history = z
  .object({
    employeeId: id,
    eventId: id,
    status: z.enum(["COMPLETED", "SKIPPED", "DECLINED", "IN_PROGRESS"]),
    createdAt: z.string().datetime({ offset: true }),
    completedAt: z.string().datetime({ offset: true }).nullable().optional(),
  })
  .refine(
    (h) => h.status !== "COMPLETED" || !!h.completedAt,
    "Completed history requires completedAt",
  )
  .refine(
    (h) => !h.completedAt || new Date(h.completedAt) >= new Date(h.createdAt),
    "completedAt must be on or after createdAt",
  );
const requirement = z.object({
  role: text,
  grade: text,
  skillId: id,
  requiredLevel: z.number().int().min(1).max(5),
  weight: z.number().positive().max(1),
});
export const importSchema = z.object({
  employees: z.array(employee).max(1000).default([]),
  skills: z.array(skill).max(200).default([]),
  events: z.array(event).max(500).default([]),
  history: z.array(history).max(20000).default([]),
  requirements: z.array(requirement).max(2000).default([]),
});
export type ImportBundle = z.infer<typeof importSchema>;
export function parseImportFiles(
  files: { name: string; content: string }[],
): ImportBundle {
  const bundle: Record<string, unknown[]> = {
    employees: [],
    skills: [],
    events: [],
    history: [],
    requirements: [],
  };
  for (const file of files) {
    if (file.name.endsWith(".csv")) {
      if (file.name !== "activity_history.csv")
        throw new Error("CSV files must be named activity_history.csv");
      const parsed = Papa.parse<Record<string, string>>(file.content, {
        header: true,
        skipEmptyLines: "greedy",
      });
      if (parsed.errors.length)
        throw new Error(`CSV: ${parsed.errors[0].message}`);
      bundle.history.push(
        ...parsed.data.map((r) => ({
          ...r,
          completedAt: r.completedAt || null,
        })),
      );
    } else if (file.name.endsWith(".json")) {
      let data: unknown;
      try {
        data = JSON.parse(file.content);
      } catch {
        throw new Error(`${file.name}: invalid JSON`);
      }
      if (Array.isArray(data)) {
        const key = file.name.replace(".json", "");
        if (!(key in bundle)) throw new Error(`Unsupported file ${file.name}`);
        bundle[key].push(...data);
      } else if (data && typeof data === "object") {
        const object = data as Record<string, unknown>;
        if ("id" in object && "targetRole" in object) {
          bundle.employees.push(object);
          continue;
        }
        if (Object.keys(object).some((key) => !(key in bundle)))
          throw new Error(`${file.name}: unknown dataset property`);
        for (const [key, value] of Object.entries(object)) {
          if (!Array.isArray(value)) throw new Error(`${key} must be an array`);
          bundle[key].push(...value);
        }
      } else
        throw new Error(`${file.name}: expected an array or dataset object`);
    } else throw new Error("Only JSON and CSV files are supported");
  }
  const result = importSchema.safeParse(bundle);
  if (!result.success)
    throw new Error(
      result.error.issues
        .slice(0, 8)
        .map((i) => `${i.path.join(".")}: ${i.message}`)
        .join("; "),
    );
  if (!Object.values(result.data).some((a) => a.length))
    throw new Error("The dataset is empty");
  for (const key of ["employees", "skills", "events"] as const) {
    const ids = result.data[key].map((v) => v.id);
    if (new Set(ids).size !== ids.length)
      throw new Error(`Duplicate IDs in ${key}`);
  }
  for (const e of result.data.employees)
    if (new Set(e.skills.map((s) => s.skillId)).size !== e.skills.length)
      throw new Error(`Duplicate skills for ${e.id}`);
  for (const e of result.data.events)
    if (new Set(e.gains.map((s) => s.skillId)).size !== e.gains.length)
      throw new Error(`Duplicate gains for ${e.id}`);
  return result.data;
}
export async function importDataset(bundle: ImportBundle) {
  const existing = await Promise.all([
    db.skill.findMany({ select: { id: true } }),
    db.employee.findMany({ select: { id: true } }),
    db.event.findMany({ select: { id: true } }),
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
    throw new Error([...new Set(missing)].slice(0, 10).join("; "));
  await db.$transaction(
    async (tx) => {
      for (const s of bundle.skills)
        await tx.skill.upsert({ where: { id: s.id }, create: s, update: s });
      for (const { gains, ...e } of bundle.events)
        await tx.event.upsert({
          where: { id: e.id },
          create: { ...e, gains: { create: gains } },
          update: { ...e, gains: { deleteMany: {}, create: gains } },
        });
      for (const { skills: levels, ...e } of bundle.employees)
        await tx.employee.upsert({
          where: { id: e.id },
          create: { ...e, skills: { create: levels } },
          update: { ...e, skills: { deleteMany: {}, create: levels } },
        });
      for (const r of bundle.requirements)
        await tx.gradeRequirement.upsert({
          where: {
            role_grade_skillId: {
              role: r.role,
              grade: r.grade,
              skillId: r.skillId,
            },
          },
          create: r,
          update: r,
        });
      for (const h of bundle.history)
        await tx.activityHistory.upsert({
          where: {
            employeeId_eventId: {
              employeeId: h.employeeId,
              eventId: h.eventId,
            },
          },
          create: {
            ...h,
            createdAt: new Date(h.createdAt),
            completedAt: h.completedAt ? new Date(h.completedAt) : null,
          },
          update: {
            status: h.status,
            createdAt: new Date(h.createdAt),
            completedAt: h.completedAt ? new Date(h.completedAt) : null,
          },
        });
      await tx.recommendation.deleteMany();
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

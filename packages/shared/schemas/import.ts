import { z } from "zod";
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

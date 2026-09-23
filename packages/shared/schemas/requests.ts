import { z } from "zod";
import { USER_ROLES } from "@shared/constants/roles";
const id = z.string().trim().min(1).max(200);
export const loginSchema = z.object({ role: z.enum(USER_ROLES) }).strict();
export const activityStartSchema = z.object({ activityId: id }).strict();
export const activityStatusSchema = z
  .object({
    eventId: id,
    status: z.enum(["COMPLETED", "IN_PROGRESS", "SKIPPED", "DECLINED"]),
  })
  .strict();
export const targetSchema = z
  .object({
    role: z.string().trim().min(1).max(200),
    grade: z.string().trim().min(1).max(200),
  })
  .strict();
export const scenarioSchema = z
  .object({
    skillId: id,
    needed: z.number().int().min(1).max(10000),
    months: z.number().int().min(3).max(12),
  })
  .strict();
export const builderSchema = z
  .object({
    skillId: id,
    fromLevel: z.number().int().min(0).max(4),
    toLevel: z.number().int().min(1).max(5),
    audience: z.string().trim().min(3).max(200),
    title: z.string().trim().min(3).max(200).optional(),
  })
  .strict();
export const publishSchema = z.object({ draft: z.unknown() }).strict();
export const approvalSchema = z
  .object({
    enrollmentId: id,
    approved: z.boolean(),
    comment: z.string().trim().max(2000).optional(),
  })
  .strict();

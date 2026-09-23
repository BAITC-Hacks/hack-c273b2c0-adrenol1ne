import { z } from "zod";
import { LEARNING_UNIT_TYPES } from "@shared/types/learning";
const safeUrl = z
  .string()
  .url()
  .max(2000)
  .refine(
    (url) => ["http:", "https:"].includes(new URL(url).protocol),
    "Only HTTP(S) content URLs are supported.",
  );
const questionSchema = z
  .object({
    id: z.string().min(1).max(100),
    text: z.string().min(10).max(2000),
    answers: z.array(z.string().min(1).max(1000)).min(2).max(8),
    topic: z.string().min(1).max(200),
    skillId: z.string().min(1).max(120),
    difficulty: z.number().int().min(1).max(5),
  })
  .strict();
const contentSchema = z
  .object({
    sections: z
      .array(
        z
          .object({
            title: z.string().min(1).max(200),
            body: z.string().min(1).max(12000),
          })
          .strict(),
      )
      .max(20)
      .optional(),
    prompt: z.string().max(12000).optional(),
    deliverables: z.array(z.string().max(2000)).max(20).optional(),
    syntheticData: z.string().max(20000).optional(),
    questions: z.array(questionSchema).min(1).max(30).optional(),
    basicPractice: z.boolean().optional(),
    externalUrl: safeUrl.optional(),
    providerName: z.string().max(200).optional(),
    courseId: z.string().max(200).optional(),
  })
  .strict();
const unitSchema = z
  .object({
    id: z.string().min(1).max(200),
    title: z.string().min(1).max(200),
    description: z.string().min(1).max(5000),
    type: z.enum(LEARNING_UNIT_TYPES),
    estimatedMinutes: z.number().int().min(1).max(1440),
    order: z.number().min(0).max(10000),
    required: z.boolean(),
    skillId: z.string().min(1).max(120),
    difficulty: z.number().int().min(1).max(5),
    content: contentSchema,
    learningObjectives: z.array(z.string().min(1).max(1000)).min(1).max(20),
    externalUrl: safeUrl.optional(),
    providerName: z.string().max(200).optional(),
    externalCourseId: z.string().max(200).optional(),
    completionRequirement: z.string().max(3000).optional(),
    masteryPoints: z.number().int().min(0).max(30),
    assessmentConfig: z
      .object({
        questions: z
          .array(
            z
              .object({
                id: z.string().min(1).max(100),
                correctAnswer: z.number().int().min(0).max(7),
                explanation: z.string().min(1).max(3000),
                topic: z.string().min(1).max(200),
              })
              .strict(),
          )
          .min(1)
          .max(30)
          .optional(),
        rubric: z
          .record(z.string().min(1).max(80), z.number().int().min(1).max(100))
          .optional(),
      })
      .strict()
      .optional(),
    isRemediation: z.boolean().optional(),
  })
  .strict();
export const learningPathSchema = z
  .object({
    title: z.string().min(3).max(200),
    description: z.string().min(10).max(5000),
    skillId: z.string().min(1).max(120),
    fromLevel: z.number().int().min(0).max(4),
    toLevel: z.number().int().min(1).max(5),
    audience: z.string().min(3).max(200),
    learningObjectives: z.array(z.string().min(1).max(1000)).min(1).max(20),
    units: z.array(unitSchema).min(4).max(40),
    masteryThreshold: z.number().int().min(70).max(100),
    requiresApproval: z.boolean(),
    status: z.literal("DRAFT").optional(),
    generator: z.literal("deterministic").optional(),
    estimatedMinutes: z.number().int().positive().optional(),
  })
  .strict();
export const actionSchema = z
  .object({
    unitId: z.string().min(1).max(200),
    action: z.enum(["start", "complete", "submit", "skip"]),
    submission: z.string().trim().max(20000).optional(),
    answers: z.record(z.number().int().min(0).max(20)).optional(),
  })
  .strict();

import { z } from "zod";
export const explanationSchema = z
  .object({
    summary: z.string().min(10).max(600),
    reasons: z.array(z.string().min(5).max(400)).min(2).max(5),
    impact: z.string().min(5).max(400),
    why_not_alternative: z.string().min(10).max(900),
  })
  .strict();

export const assessmentOutputSchema = z
  .object({
    score: z.number().int().min(0).max(100),
    dimensions: z.record(z.number().int().min(0)),
    strengths: z.array(z.string().min(1).max(700)).max(8),
    improvements: z.array(z.string().min(1).max(700)).max(8),
    nextTaskSuggestion: z.string().min(1).max(1200),
  })
  .strict();

import { z } from "zod";
import { learningPathSchema } from "@shared/schemas/learning";
import { SYSTEM_DESIGN_RUBRIC } from "@shared/constants/assessment";
import { scored } from "@shared/constants/learning";
import { calculateMastery } from "./mastery";
export const pathSchema = learningPathSchema.superRefine((path, ctx) => {
  const fail = (message: string) =>
    ctx.addIssue({ code: z.ZodIssueCode.custom, message });
  if (path.toLevel <= path.fromLevel)
    fail("Target level must exceed starting level.");
  if (
    new Set(path.units.map((u) => u.id)).size !== path.units.length ||
    new Set(path.units.map((u) => u.order)).size !== path.units.length
  )
    fail("Unit IDs and orders must be unique.");
  if (path.units.some((u) => u.skillId !== path.skillId || u.isRemediation))
    fail(
      "Published draft units must belong to the configured skill and cannot be learner-specific remediation.",
    );
  if (!path.units.some((u) => u.type === "ASSESSMENT" && u.required))
    fail("A required final skill assessment is mandatory.");
  if (
    !path.units.some(
      (u) =>
        ["AI_TASK", "PROJECT", "CODING_TASK"].includes(u.type) && u.required,
    )
  )
    fail("A required applied evidence task is mandatory.");
  for (const unit of path.units) {
    if (scored.has(unit.type) && unit.type !== "QUIZ") {
      if (!unit.content.prompt || unit.content.prompt.length < 20)
        fail("Assessed written tasks require a clear prompt.");
      const rubric = unit.assessmentConfig?.rubric;
      if (
        !rubric ||
        Object.keys(rubric).sort().join("|") !==
          Object.keys(SYSTEM_DESIGN_RUBRIC).sort().join("|") ||
        Object.values(rubric).reduce((n, v) => n + v, 0) !== 100
      )
        fail("Assessed written tasks require an explicit rubric totaling 100.");
    }
    if (unit.type === "QUIZ") {
      const publicQuestions = unit.content.questions ?? [],
        keys = unit.assessmentConfig?.questions ?? [];
      if (
        !publicQuestions.length ||
        keys.length !== publicQuestions.length ||
        new Set(publicQuestions.map((q) => q.id)).size !==
          publicQuestions.length
      )
        fail("Quiz questions require unique IDs and complete answer keys.");
      for (const question of publicQuestions) {
        const key = keys.find((k) => k.id === question.id);
        if (
          !key ||
          key.correctAnswer >= question.answers.length ||
          question.skillId !== path.skillId
        )
          fail("Quiz answer key or skill reference is invalid.");
      }
    }
    if (
      unit.type === "MENTOR_SESSION" &&
      unit.required &&
      !path.requiresApproval
    )
      fail("Required mentor sessions need manager approval.");
  }
  const max = calculateMastery(
    path.units,
    path.units
      .filter((u) => u.required)
      .map((u) => ({ unitId: u.id, status: "COMPLETED", score: 100 })),
    path.requiresApproval,
  );
  if (max < path.masteryThreshold)
    fail("Required units cannot earn the configured mastery threshold.");
});

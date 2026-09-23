import type { LearningUnitDefinition } from "./learning-types";

export type MasteryProgress = {
  unitId: string;
  status: string;
  score?: number | null;
};

export const MASTERY_THRESHOLD = 70;
export const PASS_SCORE = 70;

/** Award each evidence category once; re-opening, retries and duplicate units cannot farm points. */
export function calculateMastery(
  units: LearningUnitDefinition[],
  progress: MasteryProgress[],
  mentorValidated = false,
): number {
  const latest = new Map(progress.map((item) => [item.unitId, item]));
  const categories = {
    content: 0,
    quiz: 0,
    challenge: 0,
    project: 0,
    mentor: 0,
  };
  for (const unit of units) {
    const result = latest.get(unit.id);
    if (!result || result.status !== "COMPLETED" || unit.isRemediation)
      continue;
    const passed =
      typeof result.score === "number" &&
      Number.isFinite(result.score) &&
      result.score >= PASS_SCORE &&
      result.score <= 100;
    const configuredPoints = Number.isFinite(unit.masteryPoints)
      ? Math.max(0, unit.masteryPoints)
      : 0;
    if (["COURSE", "ARTICLE", "VIDEO"].includes(unit.type))
      categories.content = Math.max(
        categories.content,
        Math.min(20, configuredPoints),
      );
    if (unit.type === "QUIZ" && passed)
      categories.quiz = Math.max(
        categories.quiz,
        Math.min(20, configuredPoints),
      );
    if (["AI_TASK", "CODING_TASK"].includes(unit.type) && passed)
      categories.challenge = Math.max(
        categories.challenge,
        Math.min(30, configuredPoints),
      );
    if (["PROJECT", "CERTIFICATION"].includes(unit.type) && passed)
      categories.project = Math.max(
        categories.project,
        Math.min(20, configuredPoints),
      );
  }
  if (mentorValidated) categories.mentor = 10;
  return Object.values(categories).reduce((total, points) => total + points, 0);
}

export function getAdaptiveDecision(score: number, weakTopics: string[] = []) {
  if (!Number.isFinite(score) || score < 0 || score > 100)
    throw new Error("Assessment score must be between 0 and 100.");
  const topics = [
    ...new Set(weakTopics.map((topic) => topic.trim()).filter(Boolean)),
  ].slice(0, 4);
  return {
    mode:
      score >= 85
        ? ("ADVANCED" as const)
        : score >= 70
          ? ("NORMAL" as const)
          : ("REMEDIATION" as const),
    skipBasicPractice: score >= 85,
    weakTopics: topics,
    reviewTopics:
      score < 70
        ? topics.length
          ? topics
          : ["Failure handling", "Caching"]
        : [],
  };
}

/** A reusable guard for services: completion is insufficient without verified mastery. */
export function canAdvanceSkill(input: {
  mastery: number;
  finalScore: number | null;
  requiredUnitsComplete: boolean;
  requiresApproval: boolean;
  approved: boolean;
}) {
  return (
    Number.isFinite(input.mastery) &&
    input.mastery >= MASTERY_THRESHOLD &&
    typeof input.finalScore === "number" &&
    Number.isFinite(input.finalScore) &&
    input.finalScore >= PASS_SCORE &&
    input.finalScore <= 100 &&
    input.requiredUnitsComplete &&
    (!input.requiresApproval || input.approved)
  );
}

/** Never exceed the configured activity cap, even when a path suggests a higher level. */
export function verifiedSkillLevel(
  currentLevel: number,
  gain: number,
  maxLevel: number,
  qualified: boolean,
) {
  if (![currentLevel, gain, maxLevel].every(Number.isFinite))
    throw new Error("Skill levels and gains must be finite numbers.");
  if (!qualified) return currentLevel;
  return Math.max(
    currentLevel,
    Math.min(5, maxLevel, currentLevel + Math.max(0, gain)),
  );
}

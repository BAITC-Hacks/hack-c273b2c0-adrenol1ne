import type {
  LearningUnitDefinition,
  LearningUnitStatus,
} from "@shared/types/learning";
import { scored } from "@shared/constants/learning";
import { calculateMastery } from "./mastery";
type LearningUnitProgress = {
  unitId: string;
  status: string;
  score: number | null;
  skipped: boolean;
};
export const gainFingerprint = (
  gains: { skillId: string; gain: number; maxLevel: number }[],
) =>
  JSON.stringify(
    gains
      .map((g) => ({ skillId: g.skillId, gain: g.gain, maxLevel: g.maxLevel }))
      .sort((a, b) => a.skillId.localeCompare(b.skillId)),
  );
export function calculateStates(
  units: LearningUnitDefinition[],
  progress: LearningUnitProgress[],
  started: boolean,
) {
  const states = new Map<string, LearningUnitStatus>();
  for (const unit of units) {
    const own = progress.find((p) => p.unitId === unit.id);
    if (own) {
      states.set(unit.id, own.status as LearningUnitStatus);
      continue;
    }
    const earlier = units.filter(
      (u) =>
        u.order < unit.order &&
        u.required &&
        !u.isRemediation &&
        u.type !== "MENTOR_SESSION",
    );
    const unlocked =
      started &&
      (unit.isRemediation ||
        earlier.every((u) =>
          progress.some((p) => p.unitId === u.id && p.status === "COMPLETED"),
        ));
    states.set(unit.id, unlocked ? "AVAILABLE" : "LOCKED");
  }
  return states;
}
export function mastery(
  units: LearningUnitDefinition[],
  progress: LearningUnitProgress[],
  approved: boolean,
) {
  return calculateMastery(
    units,
    progress
      .filter((p) => !p.skipped)
      .map((p) => ({
        unitId: p.unitId,
        status: p.status as LearningUnitStatus,
        score: p.score,
      })),
    approved,
  );
}
export function verificationReasons(
  units: LearningUnitDefinition[],
  progress: LearningUnitProgress[],
  points: number,
  threshold: number,
  approvalStatus: string,
) {
  const reasons: string[] = [];
  if (
    units.some(
      (u) =>
        u.required &&
        !progress.some(
          (p) => p.unitId === u.id && p.status === "COMPLETED" && !p.skipped,
        ),
    )
  )
    reasons.push("Complete every required learning and remediation unit.");
  const assessments = units.filter((u) => u.type === "ASSESSMENT");
  if (
    !assessments.length ||
    assessments.some(
      (u) =>
        !progress.some(
          (p) =>
            p.unitId === u.id &&
            p.status === "COMPLETED" &&
            (p.score ?? 0) >= 70,
        ),
    )
  )
    reasons.push("Pass final skill verification with at least 70%.");
  if (
    units.some(
      (u) =>
        scored.has(u.type) &&
        u.required &&
        !progress.some(
          (p) =>
            p.unitId === u.id &&
            p.status === "COMPLETED" &&
            (p.score ?? 0) >= 70,
        ),
    )
  )
    reasons.push("Pass the required evidence assessments with at least 70%.");
  if (points < threshold)
    reasons.push("Earn at least " + threshold + " mastery points.");
  if (approvalStatus === "PENDING")
    reasons.push("Manager or mentor approval is pending.");
  if (approvalStatus === "REJECTED")
    reasons.push(
      "Manager requested changes. Submit a revised project for approval.",
    );
  return reasons;
}

import { describe, expect, it } from "vitest";
import {
  canAdvanceSkill,
  calculateMastery,
  getAdaptiveDecision,
  verifiedSkillLevel,
} from "../lib/learning-engine";
import {
  BANKING_CASES,
  createLearningPath,
  createRemediationUnits,
  generateLearningPath,
  getAdaptiveTask,
} from "../lib/learning-content";
import { LEARNING_UNIT_TYPES } from "../lib/learning-types";
import { seedEvents, seedSkills } from "../lib/seed-data";

const path = () =>
  createLearningPath(
    seedEvents.find((event) => event.id === "EV017")!,
    seedSkills,
  );
const completed = (unitId: string, score?: number) => ({
  unitId,
  status: "COMPLETED",
  score,
});

describe("Evidence-based mastery", () => {
  it("ignores invalid configured mastery points", () => {
    const unit = { ...path().units[0], masteryPoints: Number.NaN };
    expect(calculateMastery([unit], [completed(unit.id)])).toBe(0);
  });

  it("does not award mastery for opening every unit", () => {
    const units = path().units;
    expect(
      calculateMastery(
        units,
        units.map((unit) => ({ unitId: unit.id, status: "IN_PROGRESS" })),
      ),
    ).toBe(0);
  });
  it("separates content consumption from verified skill advancement", () => {
    const units = path().units;
    const points = calculateMastery(units, [
      completed(units[0].id),
      completed(units[1].id),
    ]);
    expect(points).toBe(20);
    expect(
      canAdvanceSkill({
        mastery: points,
        finalScore: null,
        requiredUnitsComplete: false,
        requiresApproval: false,
        approved: false,
      }),
    ).toBe(false);
  });
  it("awards 20 course + 20 quiz + 30 challenge + 20 project with a 100-point cap", () => {
    const units = path().units;
    const progress = units.map((unit) => completed(unit.id, 85));
    expect(calculateMastery(units, progress)).toBe(90);
    expect(calculateMastery(units, progress, true)).toBe(100);
  });
  it("does not award passing evidence points for failed or non-finite scores", () => {
    const units = path().units;
    expect(
      calculateMastery(
        units,
        units.map((unit) => completed(unit.id, 69)),
      ),
    ).toBe(20);
    expect(
      calculateMastery(
        units,
        units.map((unit) => completed(unit.id, Number.NaN)),
      ),
    ).toBe(20);
    expect(
      calculateMastery(
        units,
        units.map((unit) => ({
          unitId: unit.id,
          status: "FAILED",
          score: 100,
        })),
      ),
    ).toBe(0);
  });
  it("caps evidence categories across duplicate units and repeated attempts", () => {
    const units = path().units;
    const copies = [
      ...units,
      ...units.map((unit) => ({
        ...unit,
        id: unit.id + "-copy",
        masteryPoints: 1000,
      })),
    ];
    const progress = copies.flatMap((unit) => [
      completed(unit.id, 95),
      completed(unit.id, 100),
    ]);
    expect(calculateMastery(copies, progress, true)).toBe(100);
  });
  it("uses the latest state instead of old passing scores", () => {
    const unit = path().units[3];
    expect(
      calculateMastery(
        [unit],
        [
          completed(unit.id, 90),
          { unitId: unit.id, status: "FAILED", score: 30 },
        ],
      ),
    ).toBe(0);
  });
  it("never awards points for remediation", () => {
    const unit = path().units[3];
    const review = { ...unit, id: "review", isRemediation: true };
    expect(calculateMastery([review], [completed(review.id, 100)])).toBe(0);
  });
  it("requires final verification and configured mentor approval independently of points", () => {
    const valid = {
      mastery: 90,
      finalScore: 75,
      requiredUnitsComplete: true,
      requiresApproval: false,
      approved: false,
    };
    expect(canAdvanceSkill(valid)).toBe(true);
    expect(canAdvanceSkill({ ...valid, finalScore: 69 })).toBe(false);
    expect(canAdvanceSkill({ ...valid, requiredUnitsComplete: false })).toBe(
      false,
    );
    expect(canAdvanceSkill({ ...valid, requiresApproval: true })).toBe(false);
    expect(
      canAdvanceSkill({ ...valid, requiresApproval: true, approved: true }),
    ).toBe(true);
  });
  it("honors event gain and maximum level, without lowering a pre-existing higher skill", () => {
    expect(verifiedSkillLevel(2, 1, 4, true)).toBe(3);
    expect(verifiedSkillLevel(3, 2, 4, true)).toBe(4);
    expect(verifiedSkillLevel(4, 1, 3, true)).toBe(4);
    expect(verifiedSkillLevel(2, 1, 4, false)).toBe(2);
    expect(verifiedSkillLevel(4, 10, 10, true)).toBe(5);
  });
});

describe("Deterministic adaptive learning", () => {
  it.each([
    [0, "REMEDIATION"],
    [69, "REMEDIATION"],
    [70, "NORMAL"],
    [84, "NORMAL"],
    [85, "ADVANCED"],
    [100, "ADVANCED"],
  ])("uses the published threshold at %s", (score, mode) => {
    const result = getAdaptiveDecision(score as number, [
      "Failure handling",
      "Caching",
    ]);
    expect(result.mode).toBe(mode);
    expect(result.skipBasicPractice).toBe(mode === "ADVANCED");
    expect(result.reviewTopics.length > 0).toBe(mode === "REMEDIATION");
  });
  it("rejects invalid scores and gives deterministic fallback review topics", () => {
    expect(() => getAdaptiveDecision(Number.NaN)).toThrow();
    expect(() => getAdaptiveDecision(101)).toThrow();
    expect(getAdaptiveDecision(50).reviewTopics).toEqual([
      "Failure handling",
      "Caching",
    ]);
  });
  it("creates stable, zero-mastery remediation units from weak topics", () => {
    const unit = path().units[3];
    const reviews = createRemediationUnits(unit, [
      "Failure handling",
      "Caching",
      "Caching",
    ]);
    expect(reviews.map((review) => review.title)).toEqual([
      "Retry & Dead Letter Queues",
      "Caching Strategies Review",
    ]);
    expect(
      reviews.every(
        (review) =>
          review.required && review.isRemediation && review.masteryPoints === 0,
      ),
    ).toBe(true);
    expect(
      createRemediationUnits(unit, ["Failure handling", "Caching"]),
    ).toEqual(reviews);
  });
  it("adapts task difficulty and incorporates the career target", () => {
    const task = (currentLevel: number) =>
      getAdaptiveTask("SK_SYSTEM_DESIGN", {
        currentLevel,
        targetLevel: currentLevel + 1,
        careerTarget: "Senior Backend Engineer",
      }).prompt;
    expect(task(2)).toContain("100,000 users");
    expect(task(3)).toContain("5,000 events");
    expect(task(4)).toContain("multi-region");
    expect(task(2)).toContain("Senior Backend Engineer");
    expect(task(2)).toContain("level 3");
  });
});

describe("Provider-independent learning content", () => {
  it("provides explicit rubrics on every generated written assessment", () => {
    const drafts = ["SK_SYSTEM_DESIGN", "SK_LEADERSHIP"].map((skillId) =>
      generateLearningPath({
        skillId,
        skillName: "Example skill",
        fromLevel: 2,
        toLevel: 3,
        audience: "Banking teams",
      }),
    );
    for (const draft of drafts) {
      for (const unit of draft.units.filter((item) =>
        ["AI_TASK", "CASE_STUDY", "PROJECT", "ASSESSMENT"].includes(item.type),
      )) {
        expect(
          Object.values(unit.assessmentConfig?.rubric ?? {}).reduce(
            (sum, value) => sum + value,
            0,
          ),
        ).toBe(100);
      }
    }
  });

  it("provides the seven-unit 5h30 System Design journey and 15-question quiz", () => {
    const units = path().units;
    expect(units.map((unit) => unit.type)).toEqual([
      "COURSE",
      "ARTICLE",
      "CASE_STUDY",
      "AI_TASK",
      "QUIZ",
      "PROJECT",
      "ASSESSMENT",
    ]);
    expect(units.reduce((sum, unit) => sum + unit.estimatedMinutes, 0)).toBe(
      330,
    );
    expect(units[4].content.questions).toHaveLength(15);
    expect(units[0].content.sections?.length).toBeGreaterThanOrEqual(4);
    expect(units[2].required).toBe(false);
  });
  it("supports all requested learning types", () => {
    expect(LEARNING_UNIT_TYPES).toEqual([
      "COURSE",
      "VIDEO",
      "ARTICLE",
      "QUIZ",
      "AI_TASK",
      "CASE_STUDY",
      "CODING_TASK",
      "PROJECT",
      "MENTOR_SESSION",
      "ASSESSMENT",
      "CERTIFICATION",
    ]);
  });
  it("provides five distinct synthetic banking cases", () => {
    expect(BANKING_CASES.map((item) => item.id)).toEqual([
      "system-design",
      "analytics",
      "security",
      "product",
      "leadership",
    ]);
    expect(
      BANKING_CASES.every((item) => /synthetic/i.test(item.syntheticData)),
    ).toBe(true);
  });
  it("builds reviewable drafts without auto-publishing", () => {
    const draft = generateLearningPath({
      skillId: "SK_LEADERSHIP",
      skillName: "Leadership",
      fromLevel: 2,
      toLevel: 3,
      audience: "Engineering Leads",
    });
    expect(draft.status).toBe("DRAFT");
    expect(draft.generator).toBe("deterministic");
    expect(draft.units[3].content.prompt).toContain("Engineering Leads");
    expect(draft.units[2].content.prompt).toContain("disagreement");
    expect(draft.estimatedMinutes).toBeGreaterThan(0);
    expect(() =>
      generateLearningPath({
        skillId: "SK_LEADERSHIP",
        skillName: "Leadership",
        fromLevel: 3,
        toLevel: 2,
        audience: "Engineering Leads",
      }),
    ).toThrow();
  });
  it("generates a secondary skill path from the supplied gain rather than the activity title", () => {
    const activity = seedEvents.find((event) => event.id === "EV013")!;
    const secondary = createLearningPath(
      {
        ...activity,
        gains: [{ skillId: "SK_SECURITY", gain: 1, maxLevel: 4 }],
      },
      seedSkills,
    );
    expect(secondary.skillId).toBe("SK_SECURITY");
    expect(
      secondary.units.every((unit) => unit.skillId === "SK_SECURITY"),
    ).toBe(true);
    expect(secondary.units[3].content.prompt).toContain("authentication");
  });
});

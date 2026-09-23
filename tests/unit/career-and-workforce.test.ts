import { describe, it, expect } from "vitest";
import { careerView, simulateTargetRole } from "@domain/career/career";
import { describeSkills, calculateSkillGap } from "@domain/skills/skills";
import { aggregateWorkforce } from "@domain/workforce/analytics";
import { scoreFactors } from "@ai/recommendation/scorer";
import {
  createSeedEmployees,
  seedRequirements,
  seedSkills,
} from "@data/fixtures/seed-data";
const base = createSeedEmployees()[0];
describe("Career and skill domain contracts", () => {
  it("preserves the baseline readiness and exposes consistent skill gaps", () => {
    const view = careerView(base, seedRequirements);
    expect(view.readiness).toBe(68);
    const skills = describeSkills(base, view.requirements, seedSkills);
    expect(skills.SK_SYSTEM_DESIGN).toEqual({ level: 2, required: 4, gap: 2 });
    expect(view.criticalGapCount).toBe(2);
    expect(calculateSkillGap(5, 3)).toBe(0);
  });
  it("simulates another target without mutating the employee", () => {
    const original = structuredClone(base);
    const view = simulateTargetRole(
      base,
      { role: "Data Scientist", grade: "Senior" },
      seedRequirements,
    );
    expect(view.requirements.every((r) => r.role === "Data Scientist")).toBe(
      true,
    );
    expect(base).toEqual(original);
  });
  it("keeps the factor scorer deterministic and bounded", () => {
    const factors = {
      critical_skill_gap: 1,
      next_grade_relevance: 1,
      completion_probability: 1,
      career_goal_alignment: 1,
      activity_skill_gain: 1,
      business_priority: 1,
      diversity_bonus: 1,
      skip_penalty: 0,
    };
    expect(scoreFactors(factors)).toBe(1);
    expect(scoreFactors({ ...factors, skip_penalty: 2 })).toBe(0);
  });
});
describe("Workforce aggregation", () => {
  it("aggregates scoped employees without financial ROI or individual ranking", () => {
    const rows = [
      {
        ...base,
        id: "A",
        skills: [{ skillId: "SK_SYSTEM_DESIGN", level: 4 }],
        history: [
          {
            eventId: "X",
            status: "COMPLETED" as const,
            createdAt: "2026-09-01T00:00:00Z",
            completedAt: "2026-09-02T00:00:00Z",
          },
        ],
      },
      {
        ...base,
        id: "B",
        skills: [{ skillId: "SK_SYSTEM_DESIGN", level: 2 }],
        history: [],
      },
    ];
    const result = aggregateWorkforce(
      rows,
      {
        skills: seedSkills,
        events: [],
        requirements: [
          {
            role: base.targetRole,
            grade: base.targetGrade,
            skillId: "SK_SYSTEM_DESIGN",
            requiredLevel: 4,
            weight: 1,
          },
        ],
      },
      { A: 0, B: 1 },
      new Date("2026-09-23T12:00:00Z"),
    );
    expect(result.metrics).toMatchObject({
      readiness: 75,
      coverage: 50,
      completion: 100,
      critical: 1,
      uncovered: 1,
    });
    expect(result.gaps[0]).toMatchObject({
      skillId: "SK_SYSTEM_DESIGN",
      affected: 1,
      critical: 1,
      percent: 50,
    });
    expect(result.participation.at(-1)).toMatchObject({
      completed: 1,
      started: 1,
    });
  });
  it("handles an empty authorized team without NaN or data from elsewhere", () => {
    const result = aggregateWorkforce(
      [],
      { skills: seedSkills, events: [], requirements: seedRequirements },
      {},
    );
    expect(result.metrics).toEqual({
      nearTarget: 0,
      uncovered: 0,
      readiness: 0,
      coverage: 0,
      completion: 0,
      critical: 0,
    });
    expect(result.employees).toEqual([]);
  });
});

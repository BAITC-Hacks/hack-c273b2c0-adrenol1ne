import { describe, expect, it } from "vitest";
import { readiness } from "@domain/career/readiness";
import { applySkillGains } from "@domain/activities/progression";
import { rankActivities, scoreActivity } from "@ai/recommendation";
import {
  createSeedEmployees,
  seedEvents,
  seedRequirements,
  seedSkills,
} from "@data/fixtures/seed-data";
import type { Activity, Employee } from "@shared/types/index";
const aidar = () => createSeedEmployees(new Date("2026-09-23T00:00:00Z"))[0];
const design = seedEvents.find((e) => e.id === "EV017")!;
const speaking = seedEvents.find((e) => e.id === "EV003")!;
const score = (e: Employee, a: Activity) =>
  scoreActivity(e, a, seedEvents, seedRequirements, seedSkills);
describe("Deterministic career recommendations", () => {
  it("recommends System Design rather than the lowest skill", () => {
    const e = aidar();
    expect(
      e.skills.find((s) => s.skillId === "SK_PUBLIC_SPEAKING")!.level,
    ).toBe(1);
    expect(
      rankActivities(e, seedEvents, seedRequirements, seedSkills)[0].activity
        .id,
    ).toBe("EV017");
    expect(score(e, design).score).toBeGreaterThan(score(e, speaking).score);
  });
  it("derives the 68% to 76% demo from the shared requirements formula", () => {
    expect(readiness(aidar(), seedRequirements)).toBe(68);
    expect(readiness(applySkillGains(aidar(), design), seedRequirements)).toBe(
      76,
    );
  });
  it("changes rankings when next-grade requirements change", () => {
    const e = aidar();
    const req = [
      {
        role: e.targetRole,
        grade: e.targetGrade,
        skillId: "SK_PUBLIC_SPEAKING",
        requiredLevel: 5,
        weight: 1,
      },
    ];
    expect(
      rankActivities(
        { ...e, history: [] },
        seedEvents,
        req,
        seedSkills,
      )[0].activity.gains.some((g) => g.skillId === "SK_PUBLIC_SPEAKING"),
    ).toBe(true);
  });
  it("uses successful similar participation as positive evidence", () => {
    expect(
      score(aidar(), design).factors.completion_probability,
    ).toBeGreaterThan(
      score({ ...aidar(), history: [] }, design).factors.completion_probability,
    );
  });
  it("penalizes skipped similar activities", () => {
    const e = aidar();
    const clean = score({ ...e, history: [] }, speaking);
    const skipped = score(e, speaking);
    expect(skipped.factors.skip_penalty).toBeGreaterThan(
      clean.factors.skip_penalty,
    );
    expect(skipped.score).toBeLessThan(clean.score);
  });
  it("excludes declined and completed activities", () => {
    const e = aidar();
    e.history.push({
      eventId: "EV017",
      status: "DECLINED",
      createdAt: new Date().toISOString(),
      completedAt: null,
    });
    const ids = rankActivities(
      e,
      seedEvents,
      seedRequirements,
      seedSkills,
      100,
    ).map((c) => c.activity.id);
    expect(ids).not.toContain("EV017");
    expect(ids).not.toContain("EV006");
    expect(ids).not.toContain("EV007");
  });
  it("values attainable skill gain", () => {
    const enhanced = {
      ...design,
      gains: design.gains.map((g) => ({ ...g, gain: 2 })),
    };
    expect(
      score(aidar(), enhanced).factors.activity_skill_gain,
    ).toBeGreaterThan(score(aidar(), design).factors.activity_skill_gain);
  });
  it("completing an activity raises skills without mutating the input", () => {
    const e = aidar();
    const updated = applySkillGains(e, design);
    expect(
      updated.skills.find((s) => s.skillId === "SK_SYSTEM_DESIGN")!.level,
    ).toBe(3);
    expect(e.skills.find((s) => s.skillId === "SK_SYSTEM_DESIGN")!.level).toBe(
      2,
    );
  });
  it("respects activity ceilings and the global 5-level scale", () => {
    const e = aidar();
    const capped = {
      ...design,
      gains: [{ skillId: "SK_SYSTEM_DESIGN", gain: 5, maxLevel: 4 }],
    };
    expect(
      applySkillGains(e, capped).skills.find(
        (s) => s.skillId === "SK_SYSTEM_DESIGN",
      )!.level,
    ).toBe(4);
  });
  it("never decreases a skill already above an activity ceiling", () => {
    const e = aidar();
    const capped = {
      ...design,
      gains: [{ skillId: "SK_PYTHON", gain: 1, maxLevel: 2 }],
    };
    expect(
      applySkillGains(e, capped).skills.find((s) => s.skillId === "SK_PYTHON")!
        .level,
    ).toBe(4);
  });
  it("recalculates recommendations after completion", () => {
    const e = applySkillGains(aidar(), design);
    e.history.push({
      eventId: design.id,
      status: "COMPLETED",
      createdAt: new Date().toISOString(),
      completedAt: new Date().toISOString(),
    });
    const next = rankActivities(e, seedEvents, seedRequirements, seedSkills);
    expect(next[0].activity.id).not.toBe("EV017");
    expect(next.every((c) => c.before === 76)).toBe(true);
  });
  it("supports unknown employee IDs and names", () => {
    const e = {
      ...aidar(),
      id: "JUDGE-NEW-941",
      employeeId: "EVAL-941",
      name: "Entirely New Profile",
    };
    expect(
      rankActivities(e, seedEvents, seedRequirements, seedSkills)[0].activity
        .id,
    ).toBe("EV017");
  });
  it("does not fabricate recommendations for an unknown target", () => {
    expect(
      rankActivities(
        { ...aidar(), targetRole: "Unknown Role" },
        seedEvents,
        seedRequirements,
        seedSkills,
      ),
    ).toEqual([]);
  });
  it("filters activities with no attainable target gain", () => {
    const capped = {
      ...design,
      gains: [{ skillId: "SK_SYSTEM_DESIGN", gain: 1, maxLevel: 2 }],
    };
    expect(
      rankActivities(aidar(), [capped], seedRequirements, seedSkills),
    ).toEqual([]);
  });
  it("enforces tenure eligibility", () => {
    expect(
      rankActivities(
        aidar(),
        [{ ...design, minTenureMonths: 60 }],
        seedRequirements,
        seedSkills,
      ),
    ).toEqual([]);
  });
  it("keeps all factors in the zero-to-one interval and returns top three", () => {
    const ranked = rankActivities(
      aidar(),
      seedEvents,
      seedRequirements,
      seedSkills,
    );
    expect(ranked).toHaveLength(3);
    for (const c of ranked)
      for (const n of Object.values(c.factors)) {
        expect(n).toBeGreaterThanOrEqual(0);
        expect(n).toBeLessThanOrEqual(1);
      }
  });
  it("includes skipped history in a concrete why-not explanation", () => {
    expect(score(aidar(), design).explanation.why_not_alternative).toContain(
      "3 similar communication activities were skipped",
    );
  });
  it("ranks a 40-event, 60-skill profile with 24 months of history within 500ms", () => {
    const skills = Array.from({ length: 60 }, (_, i) => seedSkills[i % 24]);
    const events = Array.from({ length: 40 }, (_, i) => ({
      ...seedEvents[i % 20],
      id: "BENCH-" + i,
    }));
    const e = aidar();
    e.history = Array.from({ length: 96 }, (_, i) => ({
      ...e.history[i % 5],
      eventId: events[i % 40].id,
    }));
    const start = performance.now();
    rankActivities(e, events, seedRequirements, skills);
    expect(performance.now() - start).toBeLessThan(500);
  });
});

it("accounts for the current role and grade when estimating completion", () => {
  const e = aidar();
  expect(score(e, design).factors.completion_probability).toBeGreaterThan(
    score({ ...e, role: "Unmapped role", grade: "Unmapped grade" }, design)
      .factors.completion_probability,
  );
});
it("does not discard attainable gaps hidden by rounded readiness", () => {
  const e = aidar();
  const requirements = [
    {
      role: e.targetRole,
      grade: e.targetGrade,
      skillId: "SK_PYTHON",
      requiredLevel: 4,
      weight: 1,
    },
    {
      role: e.targetRole,
      grade: e.targetGrade,
      skillId: "SK_SYSTEM_DESIGN",
      requiredLevel: 4,
      weight: 0.001,
    },
  ];
  const ranked = rankActivities(e, [design], requirements, seedSkills);
  expect(ranked).toHaveLength(1);
  expect(ranked[0].factors.activity_skill_gain).toBeGreaterThan(0);
});

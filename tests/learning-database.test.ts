import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { DatabaseSync } from "node:sqlite";
import {
  readFileSync,
  readdirSync,
  mkdtempSync,
  unlinkSync,
  rmdirSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  createSeedEmployees,
  seedEvents,
  seedRequirements,
  seedSkills,
} from "../lib/seed-data";
import type { ActivityWorkspace } from "../lib/learning-types";
let service: typeof import("../lib/learning-service");
let career: typeof import("../lib/services");
let db: (typeof import("../lib/db"))["db"];
const directory = mkdtempSync(join(tmpdir(), "talentos-learning-"));
const databasePath = join(directory, "learning.db");
const solution = [
  "We design for capacity and throughput using a durable queue with partition keys so consumers can scale independently.",
  "Replication provides availability against the SLO; failover uses tested backup procedures with defined RTO and RPO.",
  "The data model schema uses an event index and a transaction outbox in the database, with consistency stated per operation.",
  "Retries use exponential backoff and jitter, stable idempotency keys, timeouts and a dead-letter queue with audited replay.",
  "Metrics track queue age, correlated traces and logs support diagnosis, and alerts have named owners.",
  "TLS encryption, restricted access and authentication protect data. PII redaction, audit records and a retention policy limit exposure.",
  "A fault injection test duplicates events and isolates a provider, then checks the delivery latency target and the absence of duplicate business effects.",
  "Our objective and goal state constraints and resource capacity in a phased rollout plan. We compare alternatives and tradeoffs, list assumptions and validate the chosen option.",
  "The synthetic data and baseline metrics are segmented to distinguish causes and hypotheses. An experiment tests the decision against measured outcomes and a defined threshold.",
  "The accountable owner manages risk, failure, guardrails and rollback, while privacy access and audit records protect responsible handling.",
].join(" ");
async function employee(id: string, level = 2, tenure = 52) {
  const { skills, history: _history, ...base } = createSeedEmployees()[0];
  await db.employee.create({
    data: {
      ...base,
      id,
      employeeId: "EXT_" + id,
      tenureMonths: tenure,
      skills: {
        create: skills.map((s) => ({
          ...s,
          level: s.skillId === "SK_SYSTEM_DESIGN" ? level : s.level,
        })),
      },
    },
  });
}
beforeAll(async () => {
  const sqlite = new DatabaseSync(databasePath),
    migrations = new URL("../prisma/migrations/", import.meta.url);
  for (const entry of readdirSync(migrations, { withFileTypes: true })
    .filter((e) => e.isDirectory())
    .sort((a, b) => a.name.localeCompare(b.name)))
    sqlite.exec(
      readFileSync(new URL(entry.name + "/migration.sql", migrations), "utf8"),
    );
  sqlite.close();
  process.env.DATABASE_URL = "file:" + databasePath.replaceAll("\\", "/");
  delete process.env.OPENAI_API_KEY;
  ({ db } = await import("../lib/db"));
  service = await import("../lib/learning-service");
  career = await import("../lib/services");
  for (const s of seedSkills) await db.skill.create({ data: s });
  for (const r of seedRequirements)
    await db.gradeRequirement.create({ data: r });
  for (const { gains, ...event } of seedEvents)
    await db.event.create({ data: { ...event, gains: { create: gains } } });
  for (const id of [
    "LEARNER",
    "FAILED",
    "PEER",
    "CAP",
    "APPROVAL",
    "MULTI",
    "CHANGED",
    "TENURE",
    "SKIP",
  ])
    await employee(id, id === "CAP" ? 4 : 2, id === "TENURE" ? 0 : 52);
});
afterAll(async () => {
  await db?.$disconnect();
  try {
    unlinkSync(databasePath);
    rmdirSync(directory);
  } catch {
    /*Windows may briefly hold the isolated test database.*/
  }
});
async function completeRequired(employeeId: string, activityId: string) {
  let workspace = await service.startLearningActivity(employeeId, activityId);
  for (let i = 0; i < 60; i++) {
    const unit = workspace.units.find(
      (u) =>
        u.required &&
        u.type !== "MENTOR_SESSION" &&
        u.status !== "COMPLETED" &&
        u.status !== "LOCKED",
    );
    if (!unit) return workspace;
    if (["COURSE", "ARTICLE", "VIDEO"].includes(unit.type)) {
      if (unit.status !== "IN_PROGRESS")
        workspace = await service.updateLearningUnit(employeeId, activityId, {
          unitId: unit.id,
          action: "start",
        });
      workspace = await service.updateLearningUnit(employeeId, activityId, {
        unitId: unit.id,
        action: "complete",
      });
    } else if (unit.type === "QUIZ") {
      const stored = await db.learningUnit.findUniqueOrThrow({
        where: { id: unit.id },
      });
      const config = JSON.parse(stored.assessmentConfig!) as {
        questions: { id: string; correctAnswer: number }[];
      };
      workspace = await service.updateLearningUnit(employeeId, activityId, {
        unitId: unit.id,
        action: "submit",
        answers: Object.fromEntries(
          config.questions.map((q) => [q.id, q.correctAnswer]),
        ),
      });
    } else
      workspace = await service.updateLearningUnit(employeeId, activityId, {
        unitId: unit.id,
        action: "submit",
        submission: solution,
      });
  }
  throw new Error("Learning path did not converge.");
}
async function completeContent(
  employeeId: string,
  workspace: ActivityWorkspace,
) {
  for (const unit of workspace.units.filter(
    (u) =>
      ["COURSE", "ARTICLE", "VIDEO"].includes(u.type) &&
      u.required &&
      !u.isRemediation,
  )) {
    workspace = await service.updateLearningUnit(
      employeeId,
      workspace.activity.id,
      { unitId: unit.id, action: "start" },
    );
    workspace = await service.updateLearningUnit(
      employeeId,
      workspace.activity.id,
      { unitId: unit.id, action: "complete" },
    );
  }
  return workspace;
}
describe("Persisted verified development journeys", () => {
  it("lazily creates useful paths for existing data and never leaks answer keys", async () => {
    const workspace = await service.getActivityWorkspace("LEARNER", "EV017");
    expect(workspace.units).toHaveLength(7);
    expect(workspace.enrollment).toBeNull();
    expect(JSON.stringify(workspace)).not.toContain("correctAnswer");
    expect(JSON.stringify(workspace)).not.toContain("assessmentConfig");
    expect(workspace.impact.readinessBefore).toBe(68);
    expect(workspace.impact.readinessAfter).toBe(76);
    expect(
      workspace.units.find((u) => u.type === "AI_TASK")?.rubric,
    ).toBeDefined();
    await service.ensureLearningPaths();
    expect(await db.learningPath.count()).toBe(seedEvents.length);
  });
  it("opening and consuming content never awards skills; legacy completion is blocked", async () => {
    let workspace = await service.startLearningActivity("LEARNER", "EV017");
    const unit = workspace.units[0];
    await expect(
      service.updateLearningUnit("LEARNER", "EV017", {
        unitId: unit.id,
        action: "complete",
      }),
    ).rejects.toThrow("Start");
    workspace = await service.updateLearningUnit("LEARNER", "EV017", {
      unitId: unit.id,
      action: "start",
    });
    workspace = await service.updateLearningUnit("LEARNER", "EV017", {
      unitId: unit.id,
      action: "complete",
    });
    expect(workspace.enrollment?.masteryPoints).toBe(20);
    expect(workspace.evidence.every((e) => !e.verified)).toBe(true);
    await expect(
      service.verifyLearningActivity("LEARNER", "EV017"),
    ).rejects.toThrow();
    await expect(
      career.recordActivity("LEARNER", "EV017", "COMPLETED"),
    ).rejects.toThrow("Activity Workspace");
    expect(
      (await career.snapshot("LEARNER")).employee.skills.find(
        (s) => s.skillId === "SK_SYSTEM_DESIGN",
      )?.level,
    ).toBe(2);
  });
  it("requires assessed mastery and atomically updates evidence, readiness and recommendations once", async () => {
    const ready = await completeRequired("LEARNER", "EV017");
    expect(ready.canVerify).toBe(true);
    expect(ready.enrollment?.masteryPoints).toBe(90);
    expect(ready.evidence.every((e) => !e.verified)).toBe(true);
    const optional = ready.units.find((u) => u.content.basicPractice)!;
    expect(optional.canSkip).toBe(true);
    await service.updateLearningUnit("LEARNER", "EV017", {
      unitId: optional.id,
      action: "skip",
    });
    await db.recommendation.create({
      data: {
        employeeId: "LEARNER",
        eventId: "EV017",
        score: 1,
        explanation: "stale",
        fingerprint: "stale",
      },
    });
    const result = await service.verifyLearningActivity("LEARNER", "EV017");
    expect(result.milestone?.changes).toEqual([
      { skillId: "SK_SYSTEM_DESIGN", name: "System Design", from: 2, to: 3 },
    ]);
    expect(result.milestone?.readinessBefore).toBe(68);
    expect(result.milestone?.readinessAfter).toBe(76);
    expect(result.milestone?.nextRecommendation?.activity.id).not.toBe("EV017");
    expect(result.evidence.every((e) => e.verified)).toBe(true);
    expect(result.impact.readinessBefore).toBe(76);
    expect(result.impact.readinessAfter).toBe(76);
    expect(
      await db.recommendation.count({ where: { employeeId: "LEARNER" } }),
    ).toBe(0);
    const again = await service.verifyLearningActivity("LEARNER", "EV017");
    expect(again.milestone?.changes).toEqual(result.milestone?.changes);
    expect(
      await db.activityHistory.count({
        where: { employeeId: "LEARNER", eventId: "EV017", status: "COMPLETED" },
      }),
    ).toBe(1);
    expect(
      (await career.snapshot("LEARNER")).routes.find(
        (r) => r.role === "Backend Engineer" && r.grade === "Senior",
      )?.readiness,
    ).toBe(76);
  });
  it("failed assessment creates learner-specific remediation and cannot advance or accept forged scores", async () => {
    let workspace = await completeContent(
      "FAILED",
      await service.startLearningActivity("FAILED", "EV017"),
    );
    const task = workspace.units.find((u) => u.type === "AI_TASK")!;
    workspace = await service.updateLearningUnit("FAILED", "EV017", {
      unitId: task.id,
      action: "submit",
      submission:
        "I would choose a popular tool and deploy it immediately. I have not explained any assumptions or measurements, and this short response provides no tested design.",
    });
    expect(workspace.units.find((u) => u.id === task.id)?.status).toBe(
      "FAILED",
    );
    expect(workspace.units.some((u) => u.isRemediation)).toBe(true);
    expect(
      (await service.getActivityWorkspace("PEER", "EV017")).units.some(
        (u) => u.isRemediation,
      ),
    ).toBe(false);
    await expect(
      service.updateLearningUnit("FAILED", "EV017", {
        unitId: task.id,
        action: "submit",
        submission: solution,
      }),
    ).rejects.toThrow("remediation");
    await service.updateLearningUnit("FAILED", "EV017", {
      unitId: task.id,
      action: "start",
    });
    await expect(
      service.updateLearningUnit("FAILED", "EV017", {
        unitId: task.id,
        action: "submit",
        submission: solution,
      }),
    ).rejects.toThrow("remediation");
    await expect(
      service.updateLearningUnit("FAILED", "EV017", {
        unitId: task.id,
        action: "submit",
        submission: solution,
        score: 100,
      } as never),
    ).rejects.toThrow();
    await expect(
      service.verifyLearningActivity("FAILED", "EV017"),
    ).rejects.toThrow();
    expect(
      (await career.snapshot("FAILED")).employee.skills.find(
        (s) => s.skillId === "SK_SYSTEM_DESIGN",
      )?.level,
    ).toBe(2);
  });
  it("enforces max_level even after a fully qualified path", async () => {
    await completeRequired("CAP", "EV017");
    const result = await service.verifyLearningActivity("CAP", "EV017");
    expect(result.milestone?.changes).toEqual([]);
    expect(
      (await career.snapshot("CAP")).employee.skills.find(
        (s) => s.skillId === "SK_SYSTEM_DESIGN",
      )?.level,
    ).toBe(4);
  });
  it("validates complete drafts, creates no draft event until HR explicitly publishes, and gates 100-point approval", async () => {
    const count = await db.event.count();
    const draft = await service.draftLearningPath({
      skillId: "SK_SYSTEM_DESIGN",
      fromLevel: 2,
      toLevel: 3,
      audience: "Backend engineers",
    });
    expect(await db.event.count()).toBe(count);
    await expect(
      service.saveLearningPath({
        ...draft,
        units: draft.units.filter((u) => u.type !== "ASSESSMENT"),
      }),
    ).rejects.toThrow();
    await expect(
      service.saveLearningPath({
        ...draft,
        units: draft.units.map((u, i) =>
          i === 0 ? { ...u, externalUrl: "javascript:alert(1)" } : u,
        ),
      }),
    ).rejects.toThrow();
    await expect(
      service.saveLearningPath({
        ...draft,
        units: draft.units.map((u) =>
          u.type === "AI_TASK"
            ? { ...u, assessmentConfig: { rubric: { inventedDimension: 100 } } }
            : u,
        ),
      }),
    ).rejects.toThrow();
    const mentor = {
      ...draft.units[0],
      id: "required-mentor",
      title: "Required mentor review",
      order: 3.5,
      type: "MENTOR_SESSION" as const,
      required: true,
      masteryPoints: 0,
    };
    const published = await service.saveLearningPath({
      ...draft,
      units: [...draft.units, mentor],
      requiresApproval: true,
      masteryThreshold: 100,
    });
    const ready = await completeRequired("APPROVAL", published.activityId);
    expect(ready.canVerify).toBe(false);
    await expect(
      service.verifyLearningActivity("APPROVAL", published.activityId),
    ).rejects.toThrow("approval");
    const report = await service.developmentReport();
    expect(
      report.approvals.find((a) => a.enrollmentId === ready.enrollment!.id)
        ?.projectSubmission,
    ).toBe(solution);
    await service.reviewLearningApproval({
      enrollmentId: ready.enrollment!.id,
      approved: true,
      comment: "Simulated review of submitted design.",
    });
    const verified = await service.verifyLearningActivity(
      "APPROVAL",
      published.activityId,
    );
    expect(verified.enrollment?.masteryPoints).toBe(100);
    expect(verified.milestone?.changes[0].to).toBe(3);
    expect(
      verified.evidence.some(
        (e) => e.type === "MENTOR_VALIDATION" && e.verified,
      ),
    ).toBe(true);
  });
  it("requires separately assessed evidence for every configured skill gain", async () => {
    const base = seedEvents.find((e) => e.id === "EV017")!;
    const multi = { ...base, id: "MULTI_EVENT", eventCode: "MULTI_EVENT" };
    await db.event.create({
      data: {
        ...multi,
        gains: {
          create: [
            ...multi.gains,
            { skillId: "SK_CLOUD", gain: 1, maxLevel: 4 },
          ],
        },
      },
    });
    const workspace = await service.startLearningActivity("MULTI", multi.id);
    expect(
      workspace.units.some(
        (u) =>
          u.skillId === "SK_CLOUD" && u.type === "ASSESSMENT" && u.required,
      ),
    ).toBe(true);
    await completeRequired("MULTI", multi.id);
    const result = await service.verifyLearningActivity("MULTI", multi.id);
    expect(result.milestone?.changes.map((c) => c.skillId).sort()).toEqual([
      "SK_CLOUD",
      "SK_SYSTEM_DESIGN",
    ]);
    expect(
      result.evidence
        .filter((e) => e.skillId === "SK_CLOUD")
        .every((e) => e.verified),
    ).toBe(true);
  });
  it("blocks an imported new gain until that skill has its own assessed evidence", async () => {
    const base = seedEvents.find((e) => e.id === "EV017")!;
    await db.event.create({
      data: {
        ...base,
        id: "CHANGED_EVENT",
        eventCode: "CHANGED_EVENT",
        gains: { create: base.gains },
      },
    });
    await completeRequired("CHANGED", "CHANGED_EVENT");
    await db.eventSkillGain.create({
      data: {
        eventId: "CHANGED_EVENT",
        skillId: "SK_CLOUD",
        gain: 1,
        maxLevel: 4,
      },
    });
    await expect(
      service.verifyLearningActivity("CHANGED", "CHANGED_EVENT"),
    ).rejects.toThrow("Configured skill gains changed");
    expect(
      (await career.snapshot("CHANGED")).employee.skills.find(
        (s) => s.skillId === "SK_SYSTEM_DESIGN",
      )?.level,
    ).toBe(2);
    await db.eventSkillGain.delete({
      where: {
        eventId_skillId: { eventId: "CHANGED_EVENT", skillId: "SK_CLOUD" },
      },
    });
    await db.eventSkillGain.update({
      where: {
        eventId_skillId: {
          eventId: "CHANGED_EVENT",
          skillId: "SK_SYSTEM_DESIGN",
        },
      },
      data: { gain: 2 },
    });
    await expect(
      service.verifyLearningActivity("CHANGED", "CHANGED_EVENT"),
    ).rejects.toThrow("Configured skill gains changed");
    expect(
      (await service.getActivityWorkspace("CHANGED", "CHANGED_EVENT"))
        .canVerify,
    ).toBe(false);
  });
  it("skipping optional learning after a high assessment cannot award consumption points", async () => {
    const draft = await service.draftLearningPath({
      skillId: "SK_SYSTEM_DESIGN",
      fromLevel: 2,
      toLevel: 3,
      audience: "Backend engineers",
    });
    const course = draft.units.find((u) => u.type === "COURSE")!;
    const published = await service.saveLearningPath({
      ...draft,
      units: draft.units.map((u) =>
        u.id === course.id
          ? {
              ...u,
              required: false,
              content: { ...u.content, basicPractice: true },
            }
          : u,
      ),
    });
    const ready = await completeRequired("SKIP", published.activityId);
    expect(ready.enrollment?.masteryPoints).toBe(70);
    const optional = ready.units.find((u) => u.type === "COURSE")!;
    const skipped = await service.updateLearningUnit(
      "SKIP",
      published.activityId,
      { unitId: optional.id, action: "skip" },
    );
    expect(skipped.enrollment?.masteryPoints).toBe(70);
  });
  it("enforces tenure and keeps historic completions separate from verified evidence", async () => {
    const base = seedEvents.find((e) => e.id === "EV017")!;
    await db.event.create({
      data: {
        ...base,
        id: "TENURE_EVENT",
        eventCode: "TENURE_EVENT",
        minTenureMonths: 60,
        gains: { create: base.gains },
      },
    });
    await expect(
      service.startLearningActivity("TENURE", "TENURE_EVENT"),
    ).rejects.toThrow("tenure");
    await db.activityHistory.create({
      data: {
        employeeId: "PEER",
        eventId: "EV017",
        status: "COMPLETED",
        completedAt: new Date(),
      },
    });
    const legacy = await service.getActivityWorkspace("PEER", "EV017");
    expect(legacy.legacyCompleted).toBe(true);
    expect(legacy.evidence).toEqual([]);
    await expect(
      service.startLearningActivity("PEER", "EV017"),
    ).rejects.toThrow("Historical");
  });
});

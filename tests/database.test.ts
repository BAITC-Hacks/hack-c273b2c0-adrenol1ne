import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { DatabaseSync } from "node:sqlite";
import { readFileSync, mkdtempSync, unlinkSync, rmdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  createSeedEmployees,
  seedEvents,
  seedRequirements,
  seedSkills,
} from "../lib/seed-data";
import { rankActivities } from "../lib/recommendation-engine";
let services: typeof import("../lib/services");
let importer: typeof import("../lib/import-service");
let db: (typeof import("../lib/db"))["db"];
const directory = mkdtempSync(join(tmpdir(), "talentos-test-"));
const databasePath = join(directory, "integration.db");
beforeAll(async () => {
  const sqlite = new DatabaseSync(databasePath);
  sqlite.exec(
    readFileSync(
      new URL(
        "../prisma/migrations/20260923090838_init/migration.sql",
        import.meta.url,
      ),
      "utf8",
    ),
  );
  sqlite.close();
  process.env.DATABASE_URL = "file:" + databasePath.replaceAll("\\", "/");
  ({ db } = await import("../lib/db"));
  services = await import("../lib/services");
  importer = await import("../lib/import-service");
  for (const s of seedSkills) await db.skill.create({ data: s });
  for (const r of seedRequirements)
    await db.gradeRequirement.create({ data: r });
  for (const { gains, ...event } of seedEvents)
    await db.event.create({ data: { ...event, gains: { create: gains } } });
  const { skills, history, ...employee } = createSeedEmployees()[0];
  await db.employee.create({
    data: {
      ...employee,
      skills: { create: skills },
      history: {
        create: history.map((h) => ({
          ...h,
          createdAt: new Date(h.createdAt),
          completedAt: h.completedAt ? new Date(h.completedAt) : null,
        })),
      },
    },
  });
});
afterAll(async () => {
  await db?.$disconnect();
  try {
    unlinkSync(databasePath);
    rmdirSync(directory);
  } catch {
    /* temporary file may be held briefly on Windows */
  }
});
describe("Persistent career state", () => {
  it("applies completion atomically and is idempotent", async () => {
    const first = await services.recordActivity("EMP001", "EV017", "COMPLETED");
    expect(first.changes).toEqual([
      { skillId: "SK_SYSTEM_DESIGN", from: 2, to: 3 },
    ]);
    const again = await services.recordActivity("EMP001", "EV017", "COMPLETED");
    expect(again.alreadyCompleted).toBe(true);
    const state = await services.snapshot("EMP001");
    expect(
      state.employee.skills.find((s) => s.skillId === "SK_SYSTEM_DESIGN")
        ?.level,
    ).toBe(3);
    expect(state.recommendations[0].before).toBe(76);
    expect(state.recommendations[0].activity.id).not.toBe("EV017");
    expect(
      await db.activityHistory.count({
        where: { employeeId: "EMP001", eventId: "EV017" },
      }),
    ).toBe(1);
  });
  it("imports an unseen employee and computes recommendations", async () => {
    const { history, ...profile } = createSeedEmployees()[0];
    const bundle = importer.parseImportFiles([
      {
        name: "employees.json",
        content: JSON.stringify([
          {
            ...profile,
            id: "UNSEEN_99",
            employeeId: "EXT-99",
            name: "Fresh Evaluation Profile",
          },
        ]),
      },
    ]);
    const output = await importer.importDataset(bundle);
    expect(output.results[0].recommendations).toBeGreaterThan(0);
    const snapshot = await services.snapshot("UNSEEN_99");
    expect(
      rankActivities(
        snapshot.employee,
        snapshot.events,
        snapshot.requirements,
        snapshot.skills,
      )[0].activity.id,
    ).toBe("EV017");
  });
  it("rolls back all import rows when a unique code conflicts", async () => {
    const bundle = importer.parseImportFiles([
      {
        name: "skills.json",
        content: JSON.stringify([
          {
            id: "SK_ATOMIC_OK",
            skillCode: "SK_ATOMIC_OK",
            name: "Atomic Test",
            category: "Technical",
          },
          {
            id: "SK_CONFLICT",
            skillCode: "SK_PYTHON",
            name: "Conflict",
            category: "Technical",
          },
        ]),
      },
    ]);
    await expect(importer.importDataset(bundle)).rejects.toThrow();
    expect(
      await db.skill.findUnique({ where: { id: "SK_ATOMIC_OK" } }),
    ).toBeNull();
  });
  it("rejects unknown references without mutating employee data", async () => {
    const bundle = importer.parseImportFiles([
      {
        name: "employees.json",
        content: JSON.stringify([
          {
            id: "BAD_REF",
            employeeId: "BAD_REF",
            name: "Invalid",
            role: "Backend Engineer",
            grade: "Middle",
            targetRole: "Backend Engineer",
            targetGrade: "Senior",
            tenureMonths: 1,
            skills: [{ skillId: "NONEXISTENT", level: 2 }],
          },
        ]),
      },
    ]);
    await expect(importer.importDataset(bundle)).rejects.toThrow(
      "Unknown skill",
    );
    expect(
      await db.employee.findUnique({ where: { id: "BAD_REF" } }),
    ).toBeNull();
  });
});

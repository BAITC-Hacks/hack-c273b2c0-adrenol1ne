import { afterAll, beforeAll, describe, it, expect, vi } from "vitest";
import { DatabaseSync } from "node:sqlite";
import {
  mkdtempSync,
  readFileSync,
  readdirSync,
  unlinkSync,
  rmdirSync,
} from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import {
  createSeedEmployees,
  seedSkills,
  seedRequirements,
  seedEvents,
} from "@data/fixtures/seed-data";
import type { Session } from "@shared/types/session";
let api: typeof import("@backend/api/router");
let auth: typeof import("@backend/middleware/session");
let db: (typeof import("@data/prisma/client"))["db"];
let repositories: (typeof import("@backend/repositories"))["repositories"];
const directory = mkdtempSync(join(tmpdir(), "talentos-api-")),
  databasePath = join(directory, "test.db");
beforeAll(async () => {
  const sqlite = new DatabaseSync(databasePath),
    migrations = new URL("../../data/prisma/migrations/", import.meta.url);
  for (const entry of readdirSync(migrations, { withFileTypes: true })
    .filter((e) => e.isDirectory())
    .sort((a, b) => a.name.localeCompare(b.name)))
    sqlite.exec(
      readFileSync(new URL(entry.name + "/migration.sql", migrations), "utf8"),
    );
  sqlite.close();
  vi.stubEnv("DATABASE_URL", "file:" + databasePath.replaceAll("\\", "/"));
  vi.stubEnv("SESSION_SECRET", "api-test-secret-with-at-least-32-characters");
  vi.stubEnv("DEMO_LOGIN_ENABLED", "true");
  vi.stubEnv("LLM_API_KEY", "");
  ({ db } = await import("@data/prisma/client"));
  ({ repositories } = await import("@backend/repositories"));
  api = await import("@backend/api/router");
  auth = await import("@backend/middleware/session");
  for (const s of seedSkills) await db.skill.create({ data: s });
  for (const r of seedRequirements)
    await db.gradeRequirement.create({ data: r });
  for (const { gains, ...e } of seedEvents)
    await db.event.create({ data: { ...e, gains: { create: gains } } });
  const { skills, history: _history, ...base } = createSeedEmployees()[0];
  for (const [id, department] of [
    ["EMP001", "Team A"],
    ["OUTSIDE", "Team B"],
  ])
    await db.employee.create({
      data: {
        ...base,
        id,
        department,
        employeeId: id === "EMP001" ? "DEMO-AIDAR" : "OUTSIDE",
        skills: { create: skills },
      },
    });
  await repositories.managers.assign("DEMO-MANAGER", "Team A");
  await (
    await import("@backend/services/learning-content.service")
  ).ensureLearningPaths();
});
afterAll(async () => {
  await db?.$disconnect();
  vi.unstubAllEnvs();
  try {
    unlinkSync(databasePath);
    rmdirSync(directory);
  } catch {
    /* Windows may retain a closed SQLite file briefly. */
  }
});
function session(
  role: Session["role"],
  employeeId: string | null = null,
): Session {
  return {
    role,
    employeeId,
    actorId: employeeId ?? "DEMO-" + role,
    expires: Date.now() + 60000,
  };
}
async function call(
  path: string,
  actor: Session | null,
  method = "GET",
  body?: unknown,
  origin = "http://localhost:3000",
) {
  const headers: Record<string, string> = { host: "localhost:3000", origin };
  if (actor) headers.cookie = "talentos_session=" + auth.signSession(actor);
  if (body !== undefined) headers["content-type"] = "application/json";
  return api.handleApi(
    new Request("http://localhost:3000/api/" + path, {
      method,
      headers,
      ...(body === undefined
        ? {}
        : { body: typeof body === "string" ? body : JSON.stringify(body) }),
    }),
  );
}
describe("API contracts and authorization", () => {
  it("returns a consistent unauthenticated error", async () => {
    const r = await call("employees/EMP001/dashboard", null);
    expect(r.status).toBe(401);
    expect(await r.json()).toEqual({
      error: { code: "UNAUTHENTICATED", message: "Please sign in." },
    });
  });
  it("returns server-calculated dashboard data and auditable deterministic recommendations", async () => {
    const fetcher = vi.spyOn(globalThis, "fetch");
    const r = await call(
      "employees/EMP001/dashboard",
      session("EMPLOYEE", "EMP001"),
    );
    expect(r.status).toBe(200);
    const d = await r.json();
    expect(d.career.readiness).toBe(68);
    expect(d.recommendations[0].activity.id).toBe("EV017");
    expect(d.skillDetails.SK_SYSTEM_DESIGN.gap).toBe(2);
    expect(d.access.canEdit).toBe(true);
    expect(fetcher).not.toHaveBeenCalled();
    fetcher.mockRestore();
    const audit = await db.auditEvent.findFirst({
      where: { actorId: "EMP001", action: "RECOMMENDATION_GENERATED" },
    });
    expect(audit?.actorRole).toBe("EMPLOYEE");
  });
  it("rejects employee access to another profile and HR resources", async () => {
    expect(
      (await call("employees/OUTSIDE/dashboard", session("EMPLOYEE", "EMP001")))
        .status,
    ).toBe(403);
    expect(
      (await call("hr/overview", session("EMPLOYEE", "EMP001"))).status,
    ).toBe(403);
  });
  it("gives managers only their own team and read-only employee context", async () => {
    const actor = session("MANAGER");
    const team = await (await call("manager/team", actor)).json();
    expect(team.workforce.employees.map((e: { id: string }) => e.id)).toEqual([
      "EMP001",
    ]);
    expect((await call("manager/employees/OUTSIDE", actor)).status).toBe(403);
    const own = await (await call("manager/employees/EMP001", actor)).json();
    expect(own.access).toMatchObject({ role: "MANAGER", canEdit: false });
    expect(
      (
        await call("target", actor, "POST", {
          role: "Backend Engineer",
          grade: "Senior",
        })
      ).status,
    ).toBe(403);
  });
  it("prevents managers from accessing organization analytics or importing data", async () => {
    expect((await call("hr/overview", session("MANAGER"))).status).toBe(403);
    expect(
      (await call("hr/import", session("MANAGER"), "POST", {})).status,
    ).toBe(403);
  });
  it("returns structured payload, route and origin errors", async () => {
    const bad = await call("target", session("EMPLOYEE", "EMP001"), "POST", {});
    expect(bad.status).toBe(400);
    expect((await bad.json()).error.code).toBe("VALIDATION_ERROR");
    const malformed = await call(
      "target",
      session("EMPLOYEE", "EMP001"),
      "POST",
      "{",
    );
    expect(malformed.status).toBe(400);
    expect((await call("missing", session("HR"))).status).toBe(404);
    expect(
      (
        await call(
          "learning/start",
          session("EMPLOYEE", "EMP001"),
          "POST",
          { activityId: "EV017" },
          "https://foreign.example",
        )
      ).status,
    ).toBe(403);
  });
  it("starts a journey once and attributes the audit to its employee", async () => {
    for (let i = 0; i < 2; i++)
      expect(
        (
          await call(
            "employees/EMP001/activities/EV017/start",
            session("EMPLOYEE", "EMP001"),
            "POST",
          )
        ).status,
      ).toBe(200);
    expect(
      await db.auditEvent.count({
        where: { action: "ACTIVITY_STARTED", entityId: "EV017" },
      }),
    ).toBe(1);
    const row = await db.auditEvent.findFirst({
      where: { action: "ACTIVITY_STARTED" },
    });
    expect(row).toMatchObject({ actorId: "EMP001", actorRole: "EMPLOYEE" });
  });
  it("rejects skill gain before verified mastery", async () => {
    const before = await db.employeeSkill.findUnique({
      where: {
        employeeId_skillId: {
          employeeId: "EMP001",
          skillId: "SK_SYSTEM_DESIGN",
        },
      },
    });
    const result = await call(
      "employees/EMP001/activities/EV017/complete",
      session("EMPLOYEE", "EMP001"),
      "POST",
    );
    expect(result.status).toBe(400);
    expect((await result.json()).error.code).toBe("BUSINESS_RULE_VIOLATION");
    expect(
      await db.employeeSkill.findUnique({
        where: {
          employeeId_skillId: {
            employeeId: "EMP001",
            skillId: "SK_SYSTEM_DESIGN",
          },
        },
      }),
    ).toEqual(before);
    expect(
      await db.auditEvent.count({ where: { action: "SKILL_UPDATED" } }),
    ).toBe(0);
  });
  it("blocks out-of-team manager validation without persisting a decision", async () => {
    const path = await repositories.learning.pathForActivity("EV018");
    expect(path).not.toBeNull();
    await repositories.learning.createEnrollment({
      employeeId: "OUTSIDE",
      pathId: path!.id,
      readinessBefore: 68,
      configuredGains: "[]",
      startingSkills: "[]",
      approvalStatus: "PENDING",
    });
    const enrollment = await repositories.learning.enrollment(
      "OUTSIDE",
      path!.id,
    );
    const r = await call("manager/validate", session("MANAGER"), "POST", {
      enrollmentId: enrollment!.id,
      approved: true,
    });
    expect(r.status).toBe(403);
    expect(
      (await repositories.learning.enrollment("OUTSIDE", path!.id))
        ?.approvalStatus,
    ).toBe("PENDING");
  });
  it("allows HR access and does not invent a financial learning ROI", async () => {
    const r = await call("hr/learning-roi", session("HR"));
    expect(r.status).toBe(200);
    expect((await r.json()).financialROI).toBeNull();
    expect(
      (await call("employees/OUTSIDE/dashboard", session("HR"))).status,
    ).toBe(200);
  });
  it("creates a manager demo session without accepting caller-supplied scope", async () => {
    expect(
      (await call("login", null, "POST", { role: "MANAGER", actorId: "OTHER" }))
        .status,
    ).toBe(400);
    const r = await call("login", null, "POST", { role: "MANAGER" });
    expect(r.status).toBe(200);
    expect(await r.json()).toEqual({ redirect: "/manager" });
    expect(r.headers.get("set-cookie")).toContain("HttpOnly");
  });
  it("rolls back persistence and audit together", async () => {
    const before = await repositories.employees.getById("EMP001");
    await expect(
      repositories.transaction(async (tx) => {
        await tx.employees.updateSkill("EMP001", "SK_SYSTEM_DESIGN", 5);
        await tx.audit.append({
          actorId: "EMP001",
          actorRole: "EMPLOYEE",
          action: "SKILL_UPDATED",
          entityType: "Employee",
          entityId: "EMP001",
          metadata: "{}",
        });
        throw new Error("Simulated failure");
      }),
    ).rejects.toThrow("Simulated failure");
    expect((await repositories.employees.getById("EMP001"))?.skills).toEqual(
      before?.skills,
    );
    expect(
      await db.auditEvent.count({ where: { action: "SKILL_UPDATED" } }),
    ).toBe(0);
  });
});

import { describe, it, expect } from "vitest";
import {
  authorize,
  authorizeEmployee,
} from "@backend/middleware/authorization";
import { MemoryEmployeeRepository } from "../support/memory-employee-repository";
import { createSeedEmployees } from "@data/fixtures/seed-data";
import type { Session } from "@shared/types/session";
const own = { ...createSeedEmployees()[0], id: "OWN", department: "Team A" };
const peer = { ...own, id: "PEER", employeeId: "PEER", department: "Team B" };
const employees = new MemoryEmployeeRepository([own, peer]);
const managers = {
  departments: async (id: string) => (id === "M1" ? ["Team A"] : []),
  assign: async () => {},
};
const session = (
  role: Session["role"],
  employeeId: string | null = null,
  actorId?: string,
): Session => ({ role, employeeId, actorId, expires: Date.now() + 10000 });
describe("Central role and ownership permissions", () => {
  it("allows an employee to read and change only their own profile", async () => {
    await expect(
      authorizeEmployee(session("EMPLOYEE", "OWN"), "OWN", true, {
        employees,
        managers,
      }),
    ).resolves.toBeUndefined();
    await expect(
      authorizeEmployee(session("EMPLOYEE", "OWN"), "PEER", false, {
        employees,
        managers,
      }),
    ).rejects.toMatchObject({ status: 403 });
  });
  it("restricts managers to persisted team membership and prevents skill edits", async () => {
    await expect(
      authorizeEmployee(session("MANAGER", null, "M1"), "OWN", false, {
        employees,
        managers,
      }),
    ).resolves.toBeUndefined();
    await expect(
      authorizeEmployee(session("MANAGER", null, "M1"), "PEER", false, {
        employees,
        managers,
      }),
    ).rejects.toMatchObject({ status: 403 });
    await expect(
      authorizeEmployee(session("MANAGER", null, "M1"), "OWN", true, {
        employees,
        managers,
      }),
    ).rejects.toMatchObject({ status: 403 });
  });
  it("fails closed for an unassigned manager", async () => {
    await expect(
      authorizeEmployee(session("MANAGER", null, "UNKNOWN"), "OWN", false, {
        employees,
        managers,
      }),
    ).rejects.toMatchObject({ status: 403 });
  });
  it("allows HR reads but reserves employee changes for their owner", async () => {
    await expect(
      authorizeEmployee(session("HR"), "PEER", false, { employees, managers }),
    ).resolves.toBeUndefined();
    await expect(
      authorizeEmployee(session("HR"), "PEER", true, { employees, managers }),
    ).rejects.toMatchObject({ status: 403 });
  });
  it("protects organization analytics, import and audits centrally", () => {
    for (const permission of [
      "workforce:read",
      "data:import",
      "audit:read",
    ] as const) {
      expect(() =>
        authorize(session("MANAGER", null, "M1"), permission),
      ).toThrow();
      expect(() => authorize(session("EMPLOYEE", "OWN"), permission)).toThrow();
      expect(() => authorize(session("HR"), permission)).not.toThrow();
    }
    expect(() => authorize(null, "employee:read")).toThrow();
  });
});

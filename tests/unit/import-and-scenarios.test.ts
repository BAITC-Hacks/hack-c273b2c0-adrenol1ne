import { describe, expect, it } from "vitest";
import { parseImportFiles } from "@backend/services/import.service";
import { simulateWorkforce } from "@domain/workforce/scenario";
import type { WorkforceEmployee } from "@shared/types/index";
const profile = {
  id: "NEW_01",
  employeeId: "NEW_01",
  name: "New Person",
  role: "Backend Engineer",
  grade: "Middle",
  targetRole: "Backend Engineer",
  targetGrade: "Senior",
  tenureMonths: 30,
  skills: [{ skillId: "SK_SYSTEM_DESIGN", level: 2 }],
};
describe("Evaluation data validation", () => {
  it("accepts independent profiles in the documented schema", () =>
    expect(
      parseImportFiles([
        { name: "employees.json", content: JSON.stringify([profile]) },
      ]).employees[0].id,
    ).toBe("NEW_01"));
  it("accepts a single employee object", () =>
    expect(
      parseImportFiles([
        { name: "profile.json", content: JSON.stringify(profile) },
      ]).employees,
    ).toHaveLength(1));
  it("rejects skill levels outside 0–5", () =>
    expect(() =>
      parseImportFiles([
        {
          name: "employees.json",
          content: JSON.stringify([
            { ...profile, skills: [{ skillId: "SK_SYSTEM_DESIGN", level: 9 }] },
          ]),
        },
      ]),
    ).toThrow());
  it("rejects duplicate profile IDs", () =>
    expect(() =>
      parseImportFiles([
        { name: "employees.json", content: JSON.stringify([profile, profile]) },
      ]),
    ).toThrow("Duplicate IDs"));
  it("rejects malformed JSON", () =>
    expect(() =>
      parseImportFiles([{ name: "employees.json", content: "{" }]),
    ).toThrow("invalid JSON"));
  it("rejects an empty dataset", () =>
    expect(() =>
      parseImportFiles([{ name: "employees.json", content: "[]" }]),
    ).toThrow("empty"));
  it("parses CSV with quoted fields and validates completion dates", () => {
    const csv =
      "employeeId,eventId,status,createdAt,completedAt\nNEW_01,EV017,COMPLETED,2026-01-01T00:00:00Z,2026-01-02T00:00:00Z";
    expect(
      parseImportFiles([{ name: "activity_history.csv", content: csv }])
        .history[0].status,
    ).toBe("COMPLETED");
  });
  it("requires completedAt for completed historical records", () => {
    expect(() =>
      parseImportFiles([
        {
          name: "activity_history.csv",
          content:
            "employeeId,eventId,status,createdAt,completedAt\nNEW_01,EV017,COMPLETED,2026-01-01T00:00:00Z,",
        },
      ]),
    ).toThrow("completedAt");
  });
});
describe("Workforce planning", () => {
  const employees = [4, 3, 2, 1].map(
    (level, i) =>
      ({
        id: String(i),
        engagement: 80,
        skills: [{ skillId: "SK_AI", level }],
      }) as WorkforceEmployee,
  );
  it("uses disjoint cohorts without counting existing talent toward an additional goal", () => {
    expect(simulateWorkforce(employees, "SK_AI", 5, 9)).toEqual({
      internalCoveragePercent: 60,
      percentages: {
        threeMonths: 20,
        sixMonths: 20,
        mobility: 20,
        external: 40,
      },
      existing: 1,
      threeMonths: 1,
      sixMonths: 1,
      mobility: 1,
      external: 2,
      needed: 5,
      months: 9,
    });
  });
  it("caps cohorts at the requested headcount", () => {
    const r = simulateWorkforce(employees, "SK_AI", 1, 9);
    expect(r.threeMonths + r.sixMonths + r.mobility + r.external).toBe(1);
  });
  it("respects the planning horizon", () => {
    const r = simulateWorkforce(employees, "SK_AI", 5, 3);
    expect(r.sixMonths).toBe(0);
    expect(r.mobility).toBe(0);
    expect(r.external).toBe(4);
  });
});

import { beforeEach, describe, it, expect, vi } from "vitest";
const store = vi.hoisted(() => ({
  employee: vi.fn(),
  skills: vi.fn(),
  requirements: vi.fn(),
  evidence: vi.fn(),
}));
vi.mock("@backend/repositories", () => ({
  repositories: {
    employees: { getById: store.employee },
    skills: { list: store.skills },
    career: { requirements: store.requirements },
    evidence: { forEmployee: store.evidence },
  },
}));
import { SkillService } from "@backend/services/skill.service";
import {
  createSeedEmployees,
  seedSkills,
  seedRequirements,
} from "@data/fixtures/seed-data";
beforeEach(() => {
  vi.clearAllMocks();
  store.employee.mockResolvedValue(createSeedEmployees()[0]);
  store.skills.mockResolvedValue(seedSkills);
  store.requirements.mockResolvedValue(seedRequirements);
  store.evidence.mockResolvedValue([]);
});
describe("SkillService", () => {
  it("returns server-calculated gaps without claiming evidence for imported skill levels", async () => {
    const profile = await SkillService.profile("EMP001");
    expect(profile.skills.SK_SYSTEM_DESIGN).toEqual({
      level: 2,
      required: 4,
      gap: 2,
    });
    expect(profile.evidence).toEqual([]);
  });
  it("distinguishes a missing employee from a valid employee with no skills", async () => {
    store.employee.mockResolvedValue(null);
    await expect(
      SkillService.getEmployeeSkills("missing"),
    ).rejects.toMatchObject({ status: 404 });
    await expect(SkillService.profile("missing")).rejects.toMatchObject({
      status: 404,
    });
  });
  it("preserves assessment confidence and verification status in the public evidence contract", async () => {
    store.evidence.mockResolvedValue([
      {
        id: "EV1",
        skillId: "SK_SYSTEM_DESIGN",
        skill: { name: "System Design" },
        enrollment: { path: { eventId: "A1", event: { name: "Workshop" } } },
        unitId: "U1",
        title: "Assessment",
        type: "ASSESSMENT",
        level: 2,
        score: 74,
        confidence: 74,
        summary: "Assessed work",
        verifiedAt: null,
        createdAt: new Date("2026-09-01T00:00:00Z"),
      },
    ]);
    expect((await SkillService.evidence("EMP001"))[0]).toMatchObject({
      confidence: 74,
      verified: false,
      score: 74,
      createdAt: "2026-09-01T00:00:00.000Z",
    });
  });
});

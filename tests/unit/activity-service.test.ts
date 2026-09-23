import { beforeEach, describe, it, expect, vi } from "vitest";
const store = vi.hoisted(() => ({
  employee: vi.fn(),
  event: vi.fn(),
  enrollment: vi.fn(),
  transaction: vi.fn(),
  history: vi.fn(),
  audit: vi.fn(),
}));
vi.mock("@backend/repositories", () => ({
  repositories: { transaction: store.transaction },
}));
vi.mock("@backend/services/learning-content.service", () => ({
  ensurePath: vi.fn(async () => ({ id: "PATH", requiresApproval: false })),
}));
vi.mock("@backend/services/learning.service", () => ({
  getActivityWorkspace: vi.fn(async () => ({ activity: { id: "EV017" } })),
}));
import { ActivityService } from "@backend/services/activity.service";
import { createSeedEmployees, seedEvents } from "@data/fixtures/seed-data";
beforeEach(() => {
  vi.clearAllMocks();
  store.employee.mockResolvedValue(createSeedEmployees()[0]);
  store.event.mockResolvedValue(seedEvents.find((e) => e.id === "EV017"));
  store.enrollment.mockResolvedValue({ id: "ENROLLMENT", verifiedAt: null });
  store.transaction.mockImplementation(async (work) =>
    work({
      employees: { getById: store.employee },
      activities: { getById: store.event },
      learning: { enrollment: store.enrollment },
      history: { save: store.history },
      audit: { append: store.audit },
    }),
  );
});
describe("ActivityService lifecycle", () => {
  it("reopening an existing enrollment does not duplicate history or start audit", async () => {
    await expect(
      ActivityService.start("EMP001", "EV017"),
    ).resolves.toMatchObject({ activity: { id: "EV017" } });
    expect(store.history).not.toHaveBeenCalled();
    expect(store.audit).not.toHaveBeenCalled();
  });
  it("rejects an ineligible employee before any mutation", async () => {
    store.employee.mockResolvedValue({
      ...createSeedEmployees()[0],
      tenureMonths: 0,
    });
    store.event.mockResolvedValue({ ...seedEvents[0], minTenureMonths: 12 });
    await expect(ActivityService.start("EMP001", "EV017")).rejects.toThrow(
      "tenure",
    );
    expect(store.enrollment).not.toHaveBeenCalled();
    expect(store.history).not.toHaveBeenCalled();
  });
  it("repeated verification does not award skill gain or repeat completion history", async () => {
    store.enrollment.mockResolvedValue({
      id: "ENROLLMENT",
      verifiedAt: new Date(),
    });
    await ActivityService.complete("EMP001", "EV017");
    expect(store.employee).not.toHaveBeenCalled();
    expect(store.history).not.toHaveBeenCalled();
    expect(store.audit).not.toHaveBeenCalled();
  });
});

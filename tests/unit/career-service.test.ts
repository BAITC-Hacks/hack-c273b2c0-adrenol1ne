import { beforeEach, describe, it, expect, vi } from "vitest";
const store = vi.hoisted(() => ({
  requirements: vi.fn(),
  updateTarget: vi.fn(),
  invalidate: vi.fn(),
  append: vi.fn(),
  transaction: vi.fn(),
}));
vi.mock("@backend/repositories", () => ({
  repositories: {
    career: { requirements: store.requirements },
    transaction: store.transaction,
  },
}));
import { CareerService } from "@backend/services/career.service";
import { withActor } from "@backend/middleware/request-context";
beforeEach(() => {
  vi.clearAllMocks();
  store.requirements.mockResolvedValue([
    { role: "Backend Engineer", grade: "Senior" },
  ]);
  store.transaction.mockImplementation(async (work) =>
    work({
      employees: { updateTarget: store.updateTarget },
      recommendations: { invalidate: store.invalidate },
      audit: { append: store.append },
    }),
  );
});
describe("CareerService target change", () => {
  it("validates the target before opening a transaction", async () => {
    await expect(
      CareerService.setTarget("E1", "Missing", "Senior"),
    ).rejects.toMatchObject({ code: "BUSINESS_RULE_VIOLATION" });
    expect(store.transaction).not.toHaveBeenCalled();
  });
  it("changes the target, invalidates explanations and attributes audit to the caller", async () => {
    await withActor({ id: "E1", role: "EMPLOYEE" }, () =>
      CareerService.setTarget("E1", "Backend Engineer", "Senior"),
    );
    expect(store.updateTarget).toHaveBeenCalledWith(
      "E1",
      "Backend Engineer",
      "Senior",
    );
    expect(store.invalidate).toHaveBeenCalledWith("E1");
    expect(store.append).toHaveBeenCalledWith(
      expect.objectContaining({
        actorId: "E1",
        actorRole: "EMPLOYEE",
        action: "CAREER_TARGET_UPDATED",
        entityId: "E1",
      }),
    );
  });
  it("propagates audit failure so the unit of work can roll back", async () => {
    store.append.mockRejectedValueOnce(new Error("Audit unavailable"));
    await expect(
      CareerService.setTarget("E1", "Backend Engineer", "Senior"),
    ).rejects.toThrow("Audit unavailable");
  });
});

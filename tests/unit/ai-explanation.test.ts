import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
const cache = vi.hoisted(() => ({ findUnique: vi.fn(), upsert: vi.fn() }));
vi.mock("@data/prisma/client", () => ({ db: { recommendation: cache } }));
import { AIExplanationService } from "@backend/services/explanation.service";
import {
  createSeedEmployees,
  seedEvents,
  seedRequirements,
  seedSkills,
} from "@data/fixtures/seed-data";
import { rankActivities } from "@ai/recommendation";
const employee = createSeedEmployees()[0];
const candidate = rankActivities(
  employee,
  seedEvents,
  seedRequirements,
  seedSkills,
)[0];
beforeEach(() => {
  vi.stubEnv("LLM_API_KEY", "");
  cache.findUnique.mockResolvedValue(null);
  cache.upsert.mockResolvedValue({});
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});
describe("Optional AI explanation layer", () => {
  it("works without an API key and never calls a provider", async () => {
    const fetcher = vi.fn();
    vi.stubGlobal("fetch", fetcher);
    expect(
      (await AIExplanationService.explain(employee, candidate)).source,
    ).toBe("deterministic");
    expect(fetcher).not.toHaveBeenCalled();
  });
  it("falls back when a provider returns invalid structured JSON", async () => {
    vi.stubEnv("LLM_API_KEY", "fake-test-key");
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          choices: [
            { message: { content: '{"summary":"too little evidence"}' } },
          ],
        }),
      }),
    );
    expect(
      (await AIExplanationService.explain(employee, candidate)).source,
    ).toBe("deterministic");
  });
  it("rejects numeric claims absent from verified evidence", async () => {
    vi.stubEnv("LLM_API_KEY", "fake-test-key");
    const { source, ...response } = candidate.explanation;
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          choices: [
            {
              message: {
                content: JSON.stringify({
                  ...response,
                  summary: "You have a guaranteed 99.999% chance of promotion.",
                }),
              },
            },
          ],
        }),
      }),
    );
    expect(
      (await AIExplanationService.explain(employee, candidate)).source,
    ).toBe("deterministic");
  });
  it("sends no employee name or ID and preserves deterministic impact and ranking", async () => {
    vi.stubEnv("LLM_API_KEY", "fake-test-key");
    const { source, ...response } = candidate.explanation;
    const fetcher = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        choices: [{ message: { content: JSON.stringify(response) } }],
      }),
    });
    vi.stubGlobal("fetch", fetcher);
    const originalScore = candidate.score;
    const result = await AIExplanationService.explain(employee, candidate);
    expect(result.source).toBe("llm");
    expect(result.impact).toBe(candidate.explanation.impact);
    expect(candidate.score).toBe(originalScore);
    const body = fetcher.mock.calls[0][1].body;
    expect(body).not.toContain(employee.name);
    expect(body).not.toContain(employee.id);
    expect(body).not.toContain(employee.employeeId);
  });
});

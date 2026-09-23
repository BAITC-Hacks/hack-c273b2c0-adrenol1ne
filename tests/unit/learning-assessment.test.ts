import { afterEach, describe, expect, it, vi } from "vitest";
import { createLearningPath } from "@ai/learning/path-generator";
import {
  createQuizDefinition,
  deterministicAssessment,
  evaluateLearningSubmission,
  getPublicQuiz,
  scoreUnitQuiz,
  SYSTEM_DESIGN_RUBRIC,
  validateAssessmentOutput,
} from "@ai/assessment/assessment-service";
import { seedEvents, seedSkills } from "@data/fixtures/seed-data";

const path = () =>
  createLearningPath(
    seedEvents.find((event) => event.id === "EV017")!,
    seedSkills,
  );
const context = {
  currentLevel: 2,
  targetLevel: 3,
  careerTarget: "Senior Backend Engineer",
};
const strongSubmission = [
  "We design for capacity and throughput using a durable queue with partition keys so consumers can scale independently.",
  "Replication provides availability against the SLO; failover uses tested backup procedures with defined RTO and RPO.",
  "The data model schema uses an event index and a transaction outbox in the database, with consistency stated per operation.",
  "Retries use exponential backoff and jitter, stable idempotency keys, timeouts and a dead-letter queue with audited replay.",
  "Metrics track queue age, correlated traces and logs support diagnosis, and alerts have named owners.",
  "TLS encryption, restricted access and authentication protect data. PII redaction, audit records and a retention policy limit exposure.",
  "A fault injection test duplicates events and isolates a provider, then checks the delivery latency target and the absence of duplicate business effects.",
].join(" ");

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("Protected server-side quizzes", () => {
  it("does not expose correct answers or explanations in the public questions", () => {
    const questions = getPublicQuiz();
    expect(questions).toHaveLength(15);
    expect(JSON.stringify(questions)).not.toContain("correctAnswer");
    expect(JSON.stringify(questions)).not.toContain("explanation");
    expect(
      createQuizDefinition("SK_SYSTEM_DESIGN").assessmentConfig.questions,
    ).toHaveLength(15);
  });
  it("scores correct answers and returns explanations only after submission", () => {
    const unit = path().units[4];
    const answers = Object.fromEntries(
      unit.assessmentConfig!.questions!.map((question) => [
        question.id,
        question.correctAnswer,
      ]),
    );
    const result = scoreUnitQuiz(unit, answers);
    expect(result.score).toBe(100);
    expect(result.correctAnswers).toBe(15);
    expect(result.weakTopics).toEqual([]);
    expect(
      result.questionResults?.every(
        (question) => question.correct && question.explanation.length > 0,
      ),
    ).toBe(true);
  });
  it("identifies weak topics and scores the 70% passing boundary correctly", () => {
    const unit = path().units[4];
    const keys = unit.assessmentConfig!.questions!;
    const answerCount = (correct: number) =>
      Object.fromEntries(
        keys.map((key, index) => [
          key.id,
          index < correct ? key.correctAnswer : (key.correctAnswer + 1) % 4,
        ]),
      );
    expect(scoreUnitQuiz(unit, answerCount(10)).score).toBe(67);
    expect(scoreUnitQuiz(unit, answerCount(11)).score).toBe(73);
    expect(scoreUnitQuiz(unit, answerCount(0)).weakTopics).toContain(
      "Failure handling",
    );
  });
  it("rejects partial, unknown, fractional and out-of-range answers", () => {
    const unit = path().units[4];
    const answers = Object.fromEntries(
      unit.assessmentConfig!.questions!.map((question) => [
        question.id,
        question.correctAnswer,
      ]),
    );
    expect(() => scoreUnitQuiz(unit, {})).toThrow("every quiz question");
    expect(() => scoreUnitQuiz(unit, { ...answers, extra: 0 })).toThrow();
    expect(() =>
      scoreUnitQuiz(unit, { ...answers, [unit.content.questions![0].id]: 0.5 }),
    ).toThrow("outside");
    expect(() =>
      scoreUnitQuiz(unit, { ...answers, [unit.content.questions![0].id]: 4 }),
    ).toThrow("outside");
  });
});

describe("Explicit assessment rubric and fallback", () => {
  it("uses the published six-dimension 20/20/20/20/10/10 rubric", () => {
    expect(Object.values(SYSTEM_DESIGN_RUBRIC)).toEqual([
      20, 20, 20, 20, 10, 10,
    ]);
    const result = deterministicAssessment(path().units[3], strongSubmission);
    expect(result.score).toBe(100);
    expect(
      Object.values(result.dimensions).reduce((sum, value) => sum + value, 0),
    ).toBe(result.score);
    expect(result.source).toBe("deterministic");
    expect(result.improvements.join(" ")).toContain("Demo evaluation");
  });
  it("does not pass a short keyword list or an unsupported answer", () => {
    const unit = path().units[3];
    expect(
      deterministicAssessment(
        unit,
        "capacity throughput queue partition scale replication availability failover backup schema index consistency outbox retry idempotency dlq timeout metrics trace log alert encrypt access pii audit",
      ).score,
    ).toBeLessThan(70);
    const weak = deterministicAssessment(
      unit,
      "I would make a nice application that works for every person and I would decide later how to implement its features.",
    );
    expect(weak.score).toBeLessThan(70);
    expect(weak.weakTopics).toContain("Failure handling");
  });
  it("works without an API key and never calls a provider", async () => {
    vi.stubEnv("LLM_API_KEY", "");
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const result = await evaluateLearningSubmission(
      path().units[3],
      { submission: strongSubmission },
      context,
    );
    expect(result.source).toBe("deterministic");
    expect(fetchMock).not.toHaveBeenCalled();
  });
  it("rejects empty or oversized written submissions", async () => {
    vi.stubEnv("LLM_API_KEY", "");
    await expect(
      evaluateLearningSubmission(
        path().units[3],
        { submission: "short" },
        context,
      ),
    ).rejects.toThrow();
    await expect(
      evaluateLearningSubmission(
        path().units[3],
        { submission: "a".repeat(20001) },
        context,
      ),
    ).rejects.toThrow();
  });
  const valid = {
    score: 78,
    dimensions: {
      scalability: 18,
      reliability: 14,
      dataArchitecture: 17,
      failureHandling: 11,
      observability: 10,
      security: 8,
    },
    strengths: ["Explains bounded load and the data model."],
    improvements: ["Specify a safe dead-letter replay procedure."],
    nextTaskSuggestion: "Review failure handling before the project.",
  };
  it("validates score sums, ranges, dimensions and strict output shape", () => {
    expect(validateAssessmentOutput(valid, SYSTEM_DESIGN_RUBRIC).score).toBe(
      78,
    );
    expect(() =>
      validateAssessmentOutput({ ...valid, score: 99 }, SYSTEM_DESIGN_RUBRIC),
    ).toThrow();
    expect(() =>
      validateAssessmentOutput(
        { ...valid, dimensions: { ...valid.dimensions, reliability: 25 } },
        SYSTEM_DESIGN_RUBRIC,
      ),
    ).toThrow();
    expect(() =>
      validateAssessmentOutput(
        { ...valid, dimensions: { invented: 78 } },
        SYSTEM_DESIGN_RUBRIC,
      ),
    ).toThrow();
    expect(() =>
      validateAssessmentOutput(
        { ...valid, rank: "best employee" },
        SYSTEM_DESIGN_RUBRIC,
      ),
    ).toThrow();
    expect(() =>
      validateAssessmentOutput({ ...valid, score: 78.5 }, SYSTEM_DESIGN_RUBRIC),
    ).toThrow();
  });
  it("uses validated LLM feedback without sending employee identity", async () => {
    vi.stubEnv("LLM_API_KEY", "test-key");
    vi.stubEnv("LLM_BASE_URL", "https://example.test/v1");
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        choices: [{ message: { content: JSON.stringify(valid) } }],
      }),
    });
    vi.stubGlobal("fetch", fetchMock);
    const result = await evaluateLearningSubmission(
      path().units[3],
      { submission: strongSubmission },
      context,
    );
    expect(result.source).toBe("llm");
    expect(result.score).toBe(78);
    expect(result.weakTopics).toContain("Failure handling");
    const request = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(JSON.stringify(request)).not.toContain("employeeId");
    expect(JSON.stringify(request)).not.toContain("Aidar");
    expect(fetchMock.mock.calls[0][1].signal).toBeInstanceOf(AbortSignal);
  });
  it.each(["invalid-json", "mismatched-total", "provider-error", "timeout"])(
    "falls back honestly after %s",
    async (failure) => {
      vi.stubEnv("LLM_API_KEY", "test-key");
      const fetchMock =
        failure === "timeout"
          ? vi.fn().mockRejectedValue(new Error("TimeoutError"))
          : vi.fn().mockResolvedValue({
              ok: failure !== "provider-error",
              json: async () => ({
                choices: [
                  {
                    message: {
                      content:
                        failure === "invalid-json"
                          ? "not JSON"
                          : JSON.stringify({ ...valid, score: 100 }),
                    },
                  },
                ],
              }),
            });
      vi.stubGlobal("fetch", fetchMock);
      const result = await evaluateLearningSubmission(
        path().units[3],
        { submission: strongSubmission },
        context,
      );
      expect(result.source).toBe("deterministic");
      expect(result.score).toBe(
        deterministicAssessment(path().units[3], strongSubmission).score,
      );
    },
  );
  it("scores quizzes locally even when an LLM is configured", async () => {
    vi.stubEnv("LLM_API_KEY", "test-key");
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const unit = path().units[4];
    const answers = Object.fromEntries(
      unit.assessmentConfig!.questions!.map((question) => [
        question.id,
        question.correctAnswer,
      ]),
    );
    expect(
      (await evaluateLearningSubmission(unit, { answers }, context)).score,
    ).toBe(100);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

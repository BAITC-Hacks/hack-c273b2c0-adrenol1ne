import { createHash } from "node:crypto";
import { repositories } from "@backend/repositories";
import type { Employee, Candidate, Explanation } from "@shared/types";
import { buildExplanationContext } from "@ai/explainability/context-builder";
import { explainEvidence } from "@ai/explainability/explanation-service";
import { explanationSchema } from "@shared/schemas/ai";
export class AIExplanationService {
  static async explain(
    employee: Employee,
    candidate: Candidate,
  ): Promise<Explanation> {
    const evidence = buildExplanationContext(employee, candidate),
      providerKey = process.env.LLM_API_KEY
        ? process.env.LLM_BASE_URL + "|" + process.env.LLM_MODEL
        : "deterministic";
    const fingerprint = createHash("sha256")
      .update(JSON.stringify({ version: 2, evidence, providerKey }))
      .digest("hex");
    const cached = await repositories.recommendations.get(
      employee.id,
      candidate.activity.id,
    );
    if (
      cached?.fingerprint === fingerprint &&
      Date.now() - cached.createdAt.getTime() < 86400000
    ) {
      try {
        const raw = JSON.parse(cached.explanation);
        const { source, ...body } = raw;
        return {
          ...explanationSchema.parse(body),
          source: source === "llm" ? "llm" : "deterministic",
        };
      } catch {
        /* regenerate corrupt cached content */
      }
    }
    const explanation = await explainEvidence(evidence, candidate.explanation);
    await repositories.recommendations.save({
      employeeId: employee.id,
      eventId: candidate.activity.id,
      score: candidate.score,
      explanation: JSON.stringify(explanation),
      fingerprint,
    });
    return explanation;
  }
}

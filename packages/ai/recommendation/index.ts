import type {
  Activity,
  Candidate,
  Employee,
  Requirement,
  Skill,
} from "@shared/types";
import { calculateFactors } from "./factors";
import { scoreFactors } from "./scorer";
import { generateCandidates } from "./candidates";
import { rankCandidates } from "./ranker";
import { explainDeterministically } from "@ai/explainability/templates";
export { WEIGHTS } from "@shared/constants/recommendation";
export function scoreActivity(
  employee: Employee,
  activity: Activity,
  events: Activity[],
  requirements: Requirement[],
  skills: Skill[],
): Candidate {
  const calculation = calculateFactors(
      employee,
      activity,
      events,
      requirements,
    ),
    score = scoreFactors(calculation.factors);
  return {
    activity,
    score,
    factors: calculation.factors,
    before: calculation.before,
    after: calculation.after,
    changes: calculation.changes,
    explanation: explainDeterministically({
      employee,
      activity,
      events,
      skills,
      calculation,
      score,
    }),
  };
}
export function rankActivities(
  employee: Employee,
  events: Activity[],
  requirements: Requirement[],
  skills: Skill[],
  limit = 3,
): Candidate[] {
  return rankCandidates(
    generateCandidates(employee, events, requirements).map((event) =>
      scoreActivity(employee, event, events, requirements, skills),
    ),
    limit,
  );
}

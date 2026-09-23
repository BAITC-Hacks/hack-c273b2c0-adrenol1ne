import { repositories } from "@backend/repositories";
import { ensureLearningPaths } from "./learning-content.service";
import { aggregateDevelopment } from "@domain/workforce/development";
export async function developmentReport(departments?: string[]) {
  await ensureLearningPaths();
  const [paths, skills] = await Promise.all([
    repositories.learning.report(departments),
    repositories.skills.list(),
  ]);
  return aggregateDevelopment(paths, skills);
}
export async function getLearningCatalog() {
  await ensureLearningPaths();
  const paths = await repositories.learning.catalog();
  return paths.map((p) => ({
    activityId: p.eventId,
    unitTypes: [...new Set(p.units.map((u) => u.type))],
    difficulty: Math.max(1, ...p.units.map((u) => u.difficulty)),
    estimatedMinutes: p.units.reduce((n, u) => n + u.estimatedMinutes, 0),
    skillId: p.skillId,
    published: true,
  }));
}

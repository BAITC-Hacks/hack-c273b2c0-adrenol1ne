import { repositories, type RepositoryContext } from "@backend/repositories";
import { AuditService } from "./audit.service";
import { BusinessRuleError } from "@backend/errors/app-error";
import { randomUUID } from "node:crypto";
import { builderSchema } from "@shared/schemas/requests";
import {
  createLearningPath,
  generateLearningPath,
} from "@ai/learning/path-generator";
import type {
  LearningPathDefinition,
  LearningPathDraft,
  LearningPathBuilderInput,
} from "@shared/types/learning";
import { pathSchema } from "@domain/activities/path-policy";
import { unitData } from "./learning-records";
type Tx = RepositoryContext;
export function fullLearningPath(
  activity: import("@shared/types/index").Activity,
  skills: import("@shared/types/index").Skill[],
): LearningPathDefinition {
  const main = createLearningPath(activity, skills);
  let order = Math.max(...main.units.map((u) => u.order));
  for (const gain of activity.gains.slice(1)) {
    const supplemental = createLearningPath(
      { ...activity, gains: [gain] },
      skills,
    );
    for (const unit of supplemental.units.filter((u) =>
      ["COURSE", "VIDEO", "AI_TASK", "CODING_TASK", "ASSESSMENT"].includes(
        u.type,
      ),
    ))
      main.units.push({
        ...unit,
        id: unit.id + "_" + gain.skillId,
        order: ++order,
        required: true,
      });
  }
  return main;
}
export async function createPath(
  tx: Tx,
  eventId: string,
  definition: LearningPathDefinition,
) {
  const pathId = "LP_" + eventId;
  const path = await tx.learning.createPath({
    id: pathId,
    eventId,
    title: definition.title,
    description: definition.description,
    skillId: definition.skillId,
    fromLevel: definition.fromLevel,
    toLevel: definition.toLevel,
    audience: definition.audience,
    learningObjectives: JSON.stringify(definition.learningObjectives),
    masteryThreshold: Math.max(70, definition.masteryThreshold),
    requiresApproval: definition.requiresApproval,
  });
  for (const [index, unit] of definition.units.entries())
    await tx.learning.createUnit(
      unitData({ ...unit, id: pathId + "_U" + (index + 1) }, path.id),
    );
  return path;
}
export async function ensureLearningPaths() {
  const [events, skills] = await Promise.all([
    repositories.activities.listWithPaths(),
    repositories.skills.list(),
  ]);
  for (const event of events) {
    if (event.learningPath || !event.gains.length) continue;
    await repositories.transaction(
      async (tx) => {
        if (await tx.learning.pathForActivity(event.id)) return;
        await createPath(tx, event.id, fullLearningPath(event, skills));
      },
      { timeout: 20000 },
    );
  }
}
export async function ensurePath(activityId: string) {
  let path = await repositories.learning.pathForActivity(activityId);
  if (path) return path;
  const [event, skills] = await Promise.all([
    repositories.activities.getById(activityId),
    repositories.skills.list(),
  ]);
  if (!event) throw new BusinessRuleError("Activity not found.");
  if (!event.gains.length)
    throw new BusinessRuleError(
      "This activity needs a configured skill gain before a learning path can be published.",
    );
  path = await repositories.transaction(async (tx) => {
    const existing = await tx.learning.pathForActivity(activityId);
    return (
      existing ?? createPath(tx, activityId, fullLearningPath(event, skills))
    );
  });
  return path;
}
export async function draftLearningPath(
  input: LearningPathBuilderInput,
): Promise<LearningPathDraft> {
  const parsed = builderSchema.parse(input);
  if (parsed.toLevel <= parsed.fromLevel)
    throw new BusinessRuleError("Target level must exceed current level.");
  const skill = await repositories.skills.getById(parsed.skillId);
  if (!skill) throw new BusinessRuleError("Skill not found.");
  const draft = generateLearningPath({ ...parsed, skillName: skill.name });
  return {
    ...draft,
    status: "DRAFT",
    generator: "deterministic",
    estimatedMinutes: draft.units.reduce((n, u) => n + u.estimatedMinutes, 0),
  };
}
export async function saveLearningPath(
  raw: unknown,
): Promise<{ activityId: string; pathId: string }> {
  const draft = pathSchema.parse(raw);
  const skill = await repositories.skills.getById(draft.skillId);
  if (!skill) throw new BusinessRuleError("Skill not found.");
  const activityId = "DEV_" + randomUUID().replaceAll("-", "");
  return repositories.transaction(
    async (tx) => {
      await tx.activities.create({
        id: activityId,
        eventCode: activityId,
        name: draft.title,
        type: "Learning Path",
        category: skill.category,
        description: draft.description,
        hours: Math.ceil(
          draft.units.reduce((n, u) => n + u.estimatedMinutes, 0) / 60,
        ),
        businessPriority: 0.7,
        minTenureMonths: 0,
        gains: [
          {
            skillId: draft.skillId,
            gain: draft.toLevel - draft.fromLevel,
            maxLevel: draft.toLevel,
          },
        ],
      });
      const path = await createPath(tx, activityId, draft);
      await tx.recommendations.invalidate();
      await AuditService.record(
        {
          action: "LEARNING_PATH_PUBLISHED",
          entityType: "LearningPath",
          entityId: path.id,
          metadata: { activityId },
        },
        tx.audit,
      );
      return { activityId, pathId: path.id };
    },
    { timeout: 25000 },
  );
}

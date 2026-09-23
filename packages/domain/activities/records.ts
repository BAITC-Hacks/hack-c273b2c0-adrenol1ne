import type { LearningUnitRecord as LearningUnit } from "@shared/types/persistence";
import type { LearningUnitDefinition } from "@shared/types/learning";
export const decodeJson = <T>(value: string | null, fallback: T): T =>
  value ? (JSON.parse(value) as T) : fallback;
export function decodeLearningUnit(unit: LearningUnit): LearningUnitDefinition {
  return {
    id: unit.id,
    title: unit.title,
    description: unit.description,
    type: unit.type as LearningUnitDefinition["type"],
    estimatedMinutes: unit.estimatedMinutes,
    order: unit.order,
    required: unit.required,
    skillId: unit.skillId,
    difficulty: unit.difficulty,
    content: decodeJson(unit.content, {}),
    learningObjectives: decodeJson(unit.learningObjectives, []),
    completionRequirement: unit.completionRequirement ?? undefined,
    masteryPoints: unit.masteryPoints,
    assessmentConfig: decodeJson(unit.assessmentConfig, undefined),
    isRemediation: unit.isRemediation,
  };
}

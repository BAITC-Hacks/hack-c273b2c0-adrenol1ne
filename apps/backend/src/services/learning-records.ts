import type { LearningUnitDefinition } from "@shared/types/learning";
export {
  decodeJson as parse,
  decodeLearningUnit as unitDefinition,
} from "@domain/activities/records";
export function unitData(
  unit: LearningUnitDefinition,
  pathId: string,
  enrollmentId?: string,
) {
  return {
    id: unit.id,
    pathId,
    enrollmentId: enrollmentId ?? null,
    title: unit.title,
    description: unit.description,
    type: unit.type,
    estimatedMinutes: unit.estimatedMinutes,
    order: unit.order,
    required: unit.required,
    skillId: unit.skillId,
    difficulty: unit.difficulty,
    content: JSON.stringify({
      ...unit.content,
      ...(unit.externalUrl ? { externalUrl: unit.externalUrl } : {}),
      ...(unit.providerName ? { providerName: unit.providerName } : {}),
      ...(unit.externalCourseId ? { courseId: unit.externalCourseId } : {}),
    }),
    learningObjectives: JSON.stringify(unit.learningObjectives),
    completionRequirement: unit.completionRequirement ?? null,
    masteryPoints: unit.masteryPoints,
    assessmentConfig: unit.assessmentConfig
      ? JSON.stringify(unit.assessmentConfig)
      : null,
    isRemediation: unit.isRemediation ?? false,
  };
}

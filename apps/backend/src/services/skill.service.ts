import { NotFoundError } from "@backend/errors/app-error";
import { requirementsFor } from "@domain/career/readiness";
import { describeSkills } from "@domain/skills/skills";
import { repositories } from "@backend/repositories";
import type { SkillEvidenceView } from "@shared/types/learning";
export async function getSkillEvidence(
  employeeId: string,
): Promise<SkillEvidenceView[]> {
  const rows = await repositories.evidence.forEmployee(employeeId);
  return rows.map((row) => ({
    id: row.id,
    skillId: row.skillId,
    skillName: row.skill.name,
    activityId: row.enrollment.path.eventId,
    activityName: row.enrollment.path.event.name,
    unitId: row.unitId,
    title: row.title,
    type: row.type,
    level: row.level,
    score: row.score,
    confidence: row.confidence,
    summary: row.summary,
    verified: !!row.verifiedAt,
    createdAt: row.createdAt.toISOString(),
    verifiedAt: row.verifiedAt?.toISOString() ?? null,
  }));
}
export class SkillService {
  static evidence = getSkillEvidence;
  static async profile(id: string) {
    const employee = await repositories.employees.getById(id);
    if (!employee) throw new NotFoundError("Employee not found.");
    const [skills, requirements, evidence] = await Promise.all([
      repositories.skills.list(),
      repositories.career.requirements(),
      getSkillEvidence(id),
    ]);
    return {
      skills: describeSkills(
        employee,
        requirementsFor(employee, requirements),
        skills,
      ),
      evidence,
    };
  }
  static async getEmployeeSkills(id: string) {
    const employee = await repositories.employees.getById(id);
    if (!employee) throw new NotFoundError("Employee not found.");
    return employee.skills;
  }
}

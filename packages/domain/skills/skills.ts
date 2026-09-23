import type { Employee, Requirement, Skill } from "@shared/types";
export function calculateSkillGap(current: number, required: number) {
  return Math.max(0, required - current);
}
export function describeSkills(
  employee: Employee,
  requirements: Requirement[],
  skills: Skill[],
) {
  return Object.fromEntries(
    skills.map((skill) => {
      const level =
          employee.skills.find((s) => s.skillId === skill.id)?.level ?? 0,
        required =
          requirements.find((r) => r.skillId === skill.id)?.requiredLevel ?? 0;
      return [
        skill.id,
        { level, required, gap: calculateSkillGap(level, required) },
      ];
    }),
  );
}

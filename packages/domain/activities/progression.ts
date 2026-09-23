import type { Employee, Activity } from "@shared/types";
export function applySkillGains(
  employee: Employee,
  activity: Activity,
): Employee {
  const levels = new Map(employee.skills.map((s) => [s.skillId, s.level]));
  for (const gain of activity.gains) {
    const level = levels.get(gain.skillId) ?? 0;
    levels.set(
      gain.skillId,
      Math.max(level, Math.min(5, gain.maxLevel, level + gain.gain)),
    );
  }
  return {
    ...employee,
    skills: Array.from(levels, ([skillId, level]) => ({ skillId, level })),
  };
}

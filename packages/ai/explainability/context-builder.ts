import type { Employee, Candidate } from "@shared/types";
export function buildExplanationContext(
  employee: Employee,
  candidate: Candidate,
) {
  const evidence = {
    role: employee.role,
    grade: employee.grade,
    target: `${employee.targetGrade} ${employee.targetRole}`,
    skill_gaps: candidate.changes,
    activity: {
      name: candidate.activity.name,
      type: candidate.activity.type,
    },
    ranking_factors: candidate.factors,
    history_statistics: {
      completed: employee.history.filter((h) => h.status === "COMPLETED")
        .length,
      skipped: employee.history.filter((h) => h.status === "SKIPPED").length,
      declined: employee.history.filter((h) => h.status === "DECLINED").length,
    },
    verified_explanation: candidate.explanation,
  };

  return evidence;
}

import type { DevelopmentReport } from "@shared/types/learning";
import type { ReportPath } from "@shared/types/reporting";
import type { Skill } from "@shared/types";
import { mastery, verificationReasons } from "@domain/activities/verification";
import { decodeLearningUnit, decodeJson } from "@domain/activities/records";
const unitDefinition = decodeLearningUnit,
  parse = decodeJson;
export function aggregateDevelopment(
  paths: ReportPath[],
  skills: Skill[],
): DevelopmentReport {
  const approvals: DevelopmentReport["approvals"] = [];
  const allEnrollments = paths.flatMap((p) => p.enrollments),
    allAssessments = allEnrollments.flatMap((e) => e.assessments);
  const average = (values: number[]) =>
    values.length
      ? Math.round((10 * values.reduce((n, v) => n + v, 0)) / values.length) /
        10
      : null;
  const elapsed = (e: { verifiedAt: Date | null; startedAt: Date }) =>
    e.verifiedAt
      ? Math.max(0, (e.verifiedAt.getTime() - e.startedAt.getTime()) / 60000)
      : 0;
  const reportPaths = paths.map((path) => {
    const base = path.units.filter((u) => !u.enrollmentId);
    const unitStats = base
      .map((u) => ({
        id: u.id,
        title: u.title,
        started: path.enrollments.filter((e) =>
          e.progress.some((p) => p.unitId === u.id),
        ).length,
        completed: path.enrollments.filter((e) =>
          e.progress.some((p) => p.unitId === u.id && p.status === "COMPLETED"),
        ).length,
        failed: path.enrollments.filter((e) =>
          e.progress.some((p) => p.unitId === u.id && p.status === "FAILED"),
        ).length,
      }))
      .map((stat) => ({
        ...stat,
        completionRate: stat.started
          ? Math.round((100 * stat.completed) / stat.started)
          : 0,
      }));
    const blocked = unitStats
      .filter((u) => u.started > u.completed)
      .sort((a, b) => b.started - b.completed - (a.started - a.completed))[0];
    for (const enrollment of path.enrollments) {
      if (enrollment.approvalStatus !== "PENDING" || enrollment.verifiedAt)
        continue;
      const units = path.units
        .filter((u) => !u.enrollmentId || u.enrollmentId === enrollment.id)
        .map(unitDefinition);
      const points = mastery(units, enrollment.progress, false);
      const reasons = verificationReasons(
        units.filter((u) => u.type !== "MENTOR_SESSION"),
        enrollment.progress,
        mastery(units, enrollment.progress, true),
        path.masteryThreshold,
        "NOT_REQUIRED",
      );
      if (!reasons.length)
        approvals.push({
          enrollmentId: enrollment.id,
          employeeId: enrollment.employeeId,
          employeeName: enrollment.employee.name,
          activityId: path.eventId,
          activityName: path.event.name,
          masteryPoints: points,
          submittedAt:
            enrollment.progress
              .filter((p) => p.completedAt)
              .map((p) => p.completedAt!)
              .sort((a, b) => b.getTime() - a.getTime())[0]
              ?.toISOString() ?? enrollment.startedAt.toISOString(),
          projectScore:
            enrollment.progress.find((p) =>
              units.some((u) => u.id === p.unitId && u.type === "PROJECT"),
            )?.score ?? null,
          projectTitle: units.find((u) => u.type === "PROJECT")?.title ?? null,
          projectSubmission:
            enrollment.progress.find((p) =>
              units.some((u) => u.id === p.unitId && u.type === "PROJECT"),
            )?.submission ?? null,
          projectFeedback: parse(
            enrollment.progress.find((p) =>
              units.some((u) => u.id === p.unitId && u.type === "PROJECT"),
            )?.feedback ?? null,
            null,
          ),
        });
    }
    const completed = path.enrollments.filter((e) => !!e.verifiedAt);
    return {
      id: path.id,
      activityId: path.eventId,
      title: path.title,
      skillId: path.skillId,
      skillName: path.skill.name,
      fromLevel: path.fromLevel,
      toLevel: path.toLevel,
      audience: path.audience,
      requiresApproval: path.requiresApproval,
      units: base.length,
      estimatedMinutes: base.reduce((n, u) => n + u.estimatedMinutes, 0),
      employeesStarted: path.enrollments.length,
      employeesCompleted: completed.length,
      completionRate: path.enrollments.length
        ? Math.round((100 * completed.length) / path.enrollments.length)
        : 0,
      skillAdvancements: completed.reduce(
        (n, e) =>
          n +
          parse<{ changes: unknown[] }>(e.milestone, { changes: [] }).changes
            .length,
        0,
      ),
      averageAssessmentScore: average(
        path.enrollments.flatMap((e) => e.assessments.map((a) => a.score)),
      ),
      averageTimeToMasteryMinutes: average(completed.map(elapsed)),
      dropOffPoint: blocked?.title ?? null,
      unitStats,
    };
  });
  const completed = allEnrollments.filter((e) => !!e.verifiedAt);
  return {
    paths: reportPaths,
    skills: skills.map((s) => ({ id: s.id, name: s.name })),
    approvals,
    metrics: {
      learningPaths: paths.length,
      employeesStarted: new Set(allEnrollments.map((e) => e.employeeId)).size,
      employeesCompleted: new Set(completed.map((e) => e.employeeId)).size,
      completionRate: allEnrollments.length
        ? Math.round((100 * completed.length) / allEnrollments.length)
        : 0,
      averageAssessmentScore: average(allAssessments.map((a) => a.score)),
      skillsDeveloped: reportPaths.reduce((n, p) => n + p.skillAdvancements, 0),
      averageTimeToMasteryMinutes: average(completed.map(elapsed)),
    },
  };
}

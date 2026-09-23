import { repositories } from "@backend/repositories";
import { AuditService } from "./audit.service";
import { BusinessRuleError } from "@backend/errors/app-error";
import type { Employee, History } from "@shared/types";
import type { ActivityWorkspace } from "@shared/types/learning";
import { ensurePath } from "./learning-content.service";
import { getActivityWorkspace } from "./learning.service";
import { readiness } from "@domain/career/readiness";
import { applySkillGains } from "@domain/activities/progression";
import {
  gainFingerprint,
  mastery,
  verificationReasons,
} from "@domain/activities/verification";
import { unitDefinition } from "./learning-records";
export async function startLearningActivity(
  employeeId: string,
  activityId: string,
): Promise<ActivityWorkspace> {
  const path = await ensurePath(activityId);
  await repositories.transaction(async (tx) => {
    const employee = await tx.employees.getById(employeeId);
    const event = await tx.activities.getById(activityId);
    if (!employee || !event)
      throw new BusinessRuleError("Employee or activity not found.");
    if (employee.tenureMonths < event.minTenureMonths)
      throw new BusinessRuleError(
        "This activity's tenure requirement is not met.",
      );
    const existing = await tx.learning.enrollment(employeeId, path.id);
    if (existing) return;
    if (
      employee.history.some(
        (h) => h.eventId === activityId && h.status === "COMPLETED",
      )
    )
      throw new BusinessRuleError(
        "Historical completion is preserved; it cannot award a second skill gain.",
      );
    const requirements = await tx.career.requirements();
    await tx.learning.createEnrollment({
      employeeId,
      pathId: path.id,
      readinessBefore: readiness(
        { ...employee, history: [] } as Employee,
        requirements,
      ),
      configuredGains: gainFingerprint(event.gains),
      startingSkills: JSON.stringify(
        employee.skills.map((s) => ({ skillId: s.skillId, level: s.level })),
      ),
      approvalStatus: path.requiresApproval ? "PENDING" : "NOT_REQUIRED",
    });
    await tx.history.save({
      employeeId,
      eventId: activityId,
      status: "IN_PROGRESS",
    });
    await tx.recommendations.invalidate(employeeId);
    await AuditService.record(
      {
        action: "ACTIVITY_STARTED",
        entityType: "Activity",
        entityId: activityId,
        metadata: { employeeId },
      },
      tx.audit,
    );
  });
  return getActivityWorkspace(employeeId, activityId);
}
export async function verifyLearningActivity(
  employeeId: string,
  activityId: string,
): Promise<ActivityWorkspace> {
  const path = await ensurePath(activityId);
  await repositories.transaction(
    async (tx) => {
      const enrollment = await tx.learning.enrollment(employeeId, path.id);
      if (!enrollment)
        throw new BusinessRuleError("Start the learning path first.");
      if (enrollment.verifiedAt) return;
      const raw = await tx.employees.getById(employeeId);
      const event = await tx.activities.getById(activityId);
      if (!raw || !event)
        throw new BusinessRuleError("Employee or activity not found.");
      if (raw.tenureMonths < event.minTenureMonths)
        throw new BusinessRuleError(
          "This activity's tenure requirement is not met.",
        );
      if (
        raw.history.some(
          (h) => h.eventId === activityId && h.status === "COMPLETED",
        )
      )
        throw new BusinessRuleError(
          "A completed activity cannot award another skill gain.",
        );
      if (enrollment.configuredGains !== gainFingerprint(event.gains))
        throw new BusinessRuleError(
          "Configured skill gains changed after enrollment; a reviewed replacement path is required before verification.",
        );
      const rows = await tx.learning.units(path.id, enrollment.id);
      const units = rows.map(unitDefinition);
      const evidence = await tx.evidence.forEnrollment(enrollment.id);
      if (
        event.gains.some(
          (g) =>
            !units.some(
              (u) =>
                u.skillId === g.skillId &&
                u.required &&
                u.type === "ASSESSMENT" &&
                enrollment.progress.some(
                  (p) =>
                    p.unitId === u.id &&
                    p.status === "COMPLETED" &&
                    (p.score ?? 0) >= 70,
                ),
            ) ||
            !units.some(
              (u) =>
                u.skillId === g.skillId &&
                u.required &&
                ["AI_TASK", "CODING_TASK", "PROJECT", "CERTIFICATION"].includes(
                  u.type,
                ) &&
                enrollment.progress.some(
                  (p) =>
                    p.unitId === u.id &&
                    p.status === "COMPLETED" &&
                    (p.score ?? 0) >= 70,
                ) &&
                evidence.some(
                  (e) => e.unitId === u.id && e.skillId === g.skillId,
                ),
            ),
        )
      )
        throw new BusinessRuleError(
          "Every configured skill gain requires its own final assessment and applied skill evidence.",
        );
      const points = mastery(
        units,
        enrollment.progress,
        enrollment.approvalStatus === "APPROVED",
      );
      const reasons = verificationReasons(
        units,
        enrollment.progress,
        points,
        path.masteryThreshold,
        enrollment.approvalStatus,
      );
      if (reasons.length) throw new BusinessRuleError(reasons.join(" "));
      const [requirements, skills] = await Promise.all([
        tx.career.requirements(),
        tx.skills.list(),
      ]);
      const employee = { ...raw, history: [] } as Employee;
      const verifiedEvent = event;
      if (!verifiedEvent.gains.length)
        throw new BusinessRuleError("Path skill gain is no longer configured.");
      const projected = applySkillGains(employee, verifiedEvent);
      const changes = projected.skills
        .filter(
          (s) =>
            s.level !==
            (raw.skills.find((old) => old.skillId === s.skillId)?.level ?? 0),
        )
        .map((s) => ({
          skillId: s.skillId,
          name: skills.find((k) => k.id === s.skillId)?.name ?? s.skillId,
          from: raw.skills.find((old) => old.skillId === s.skillId)?.level ?? 0,
          to: s.level,
        }));
      const now = new Date(),
        scores = enrollment.progress
          .filter((p) => p.score !== null)
          .map((p) => p.score!);
      const confidence = scores.length
        ? Math.round(scores.reduce((n, s) => n + s, 0) / scores.length)
        : 0;
      for (const change of changes)
        await tx.employees.updateSkill(employeeId, change.skillId, change.to);
      for (const gain of verifiedEvent.gains) {
        const level =
          projected.skills.find((s) => s.skillId === gain.skillId)?.level ?? 0;
        await tx.evidence.verifySkill(enrollment.id, gain.skillId, level, now);
      }
      const milestone = {
        changes,
        readinessBefore: readiness(employee, requirements),
        readinessAfter: readiness(projected, requirements),
        evidenceConfidence: confidence,
        nextRecommendation: null,
      };
      await tx.learning.updateEnrollment(enrollment.id, {
        status: "COMPLETED",
        completedAt: now,
        verifiedAt: now,
        milestone: JSON.stringify(milestone),
      });
      await tx.history.save({
        employeeId,
        eventId: activityId,
        status: "COMPLETED",
        completedAt: now,
      });
      await tx.recommendations.invalidate(employeeId);
      await AuditService.record(
        {
          action: "ACTIVITY_COMPLETED",
          entityType: "Activity",
          entityId: activityId,
          metadata: {
            employeeId,
            mastery: points,
            readinessBefore: milestone.readinessBefore,
            readinessAfter: milestone.readinessAfter,
          },
        },
        tx.audit,
      );
      for (const change of changes)
        await AuditService.record(
          {
            action: "SKILL_UPDATED",
            entityType: "Employee",
            entityId: employeeId,
            metadata: {
              skillId: change.skillId,
              from: change.from,
              to: change.to,
              activityId,
            },
          },
          tx.audit,
        );
    },
    { timeout: 25000 },
  );
  return getActivityWorkspace(employeeId, activityId);
}
export async function recordActivity(
  employeeId: string,
  eventId: string,
  status: History["status"],
) {
  if (status === "COMPLETED")
    throw new BusinessRuleError(
      "Skill advancement requires Activity Workspace assessments and verification.",
    );
  return repositories.transaction(async (tx) => {
    const [employee, event] = await Promise.all([
      tx.employees.getById(employeeId),
      tx.activities.getById(eventId),
    ]);
    if (!employee || !event)
      throw new BusinessRuleError("Employee or activity not found");
    if (employee.tenureMonths < event.minTenureMonths)
      throw new BusinessRuleError(
        "This activity\'s tenure requirement is not met.",
      );
    if (
      employee.history.some(
        (h) => h.eventId === eventId && h.status === "COMPLETED",
      )
    )
      return { alreadyCompleted: true, changes: [] };
    await tx.history.save({ employeeId, eventId, status, completedAt: null });
    await tx.recommendations.invalidate(employeeId);
    if (status === "IN_PROGRESS")
      await AuditService.record(
        {
          action: "ACTIVITY_STARTED",
          entityType: "Activity",
          entityId: eventId,
          metadata: { employeeId },
        },
        tx.audit,
      );
    return { alreadyCompleted: false, changes: [] };
  });
}
export class ActivityService {
  static start = startLearningActivity;
  static complete = verifyLearningActivity;
  static record = recordActivity;
}

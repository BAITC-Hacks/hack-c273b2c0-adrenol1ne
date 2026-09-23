import { workforce } from "./hr.service";
import { repositories } from "@backend/repositories";
import { AuditService } from "./audit.service";
import { BusinessRuleError } from "@backend/errors/app-error";
import { approvalSchema } from "@shared/schemas/requests";
import type { DevelopmentReport } from "@shared/types/learning";
import { developmentReport } from "./development.service";
import { mastery, verificationReasons } from "@domain/activities/verification";
import { unitDefinition } from "./learning-records";
export async function reviewLearningApproval(input: {
  enrollmentId: string;
  approved: boolean;
  comment?: string;
}): Promise<DevelopmentReport> {
  const parsed = approvalSchema.parse(input);
  await repositories.transaction(async (tx) => {
    const enrollment = await tx.learning.enrollmentForReview(
      parsed.enrollmentId,
    );
    if (!enrollment) throw new BusinessRuleError("Enrollment not found.");
    if (!enrollment.path.requiresApproval)
      throw new BusinessRuleError(
        "This path does not require manager approval.",
      );
    if (enrollment.verifiedAt)
      throw new BusinessRuleError("This path has already been verified.");
    const units = enrollment.path.units
      .filter((u) => !u.enrollmentId || u.enrollmentId === enrollment.id)
      .map(unitDefinition);
    const reasons = verificationReasons(
      units.filter((u) => u.type !== "MENTOR_SESSION"),
      enrollment.progress,
      mastery(units, enrollment.progress, true),
      enrollment.path.masteryThreshold,
      "NOT_REQUIRED",
    );
    if (reasons.length)
      throw new BusinessRuleError(
        "Review is available after the required assessed work is complete. " +
          reasons.join(" "),
      );
    await tx.learning.updateEnrollment(enrollment.id, {
      approvalStatus: parsed.approved ? "APPROVED" : "REJECTED",
      approvalComment: parsed.comment ?? null,
      approvedAt: parsed.approved ? new Date() : null,
    });
    await AuditService.record(
      {
        action: "MANAGER_VALIDATION",
        entityType: "LearningEnrollment",
        entityId: enrollment.id,
        metadata: {
          employeeId: enrollment.employeeId,
          approved: parsed.approved,
        },
      },
      tx.audit,
    );
    if (parsed.approved) {
      for (const unit of units.filter((u) => u.type === "MENTOR_SESSION"))
        await tx.learning.saveProgress(enrollment.id, unit.id, {
          status: "COMPLETED",
          completedAt: new Date(),
        });
      const existing = await tx.evidence.mentorValidation(enrollment.id);
      if (!existing)
        await tx.evidence.add({
          employeeId: enrollment.employeeId,
          enrollmentId: enrollment.id,
          skillId: enrollment.path.skillId,
          type: "MENTOR_VALIDATION",
          title: "Manager / mentor validation",
          level: enrollment.path.fromLevel,
          confidence: 0,
          summary:
            "Reviewer approval of assessed work. " + (parsed.comment ?? ""),
        });
    }
  });
  return developmentReport();
}
export class ManagerService {
  static async team(managerId: string) {
    const departments = await repositories.managers.departments(managerId);
    const [team, development] = await Promise.all([
      workforce(departments),
      developmentReport(departments),
    ]);
    return { departments, workforce: team, development };
  }
  static review = reviewLearningApproval;
}

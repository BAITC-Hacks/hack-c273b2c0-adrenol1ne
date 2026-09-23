import { repositories } from "@backend/repositories";
import { BusinessRuleError } from "@backend/errors/app-error";
import { snapshot, getEmployee } from "./employee.service";
import { applySkillGains } from "@domain/activities/progression";
import { readiness } from "@domain/career/readiness";
import {
  getAdaptiveTask,
  createRemediationUnits,
} from "@ai/learning/path-generator";
import { evaluateLearningSubmission } from "@ai/assessment/assessment-service";
import { getAdaptiveDecision } from "@domain/activities/mastery";
import {
  gainFingerprint,
  calculateStates,
  mastery,
  verificationReasons,
} from "@domain/activities/verification";
import { consuming, scored } from "@shared/constants/learning";
import { actionSchema } from "@shared/schemas/learning";
import { ensurePath } from "./learning-content.service";
import { getSkillEvidence } from "./skill.service";
import { parse, unitDefinition, unitData } from "./learning-records";
import type {
  ActivityWorkspace,
  AssessmentEvaluation,
  LearningUnitAction,
} from "@shared/types/learning";
export async function getActivityWorkspace(
  employeeId: string,
  activityId: string,
): Promise<ActivityWorkspace> {
  const path = await ensurePath(activityId);
  const [state, enrollment, evidence] = await Promise.all([
    snapshot(employeeId),
    repositories.learning.enrollment(employeeId, path.id),
    getSkillEvidence(employeeId),
  ]);
  const activity = state.events.find((e) => e.id === activityId)!;
  const rows = await repositories.learning.units(path.id, enrollment?.id);
  const definitions = rows.map(unitDefinition),
    progress = enrollment?.progress ?? [];
  const states = calculateStates(definitions, progress, !!enrollment);
  const points = mastery(
    definitions,
    progress,
    enrollment?.approvalStatus === "APPROVED",
  );
  const skipAllowed = progress.some((p) => (p.score ?? 0) >= 85);
  const projected = enrollment?.verifiedAt
    ? state.employee
    : applySkillGains(state.employee, activity);
  const changes = activity.gains.map((g) => ({
    skillId: g.skillId,
    name: state.skills.find((s) => s.id === g.skillId)?.name ?? g.skillId,
    from:
      state.employee.skills.find((s) => s.skillId === g.skillId)?.level ?? 0,
    to: projected.skills.find((s) => s.skillId === g.skillId)?.level ?? 0,
  }));
  const legacyCompleted =
    state.employee.history.some(
      (h) => h.eventId === activityId && h.status === "COMPLETED",
    ) && !enrollment?.verifiedAt;
  const reasons = verificationReasons(
    definitions,
    progress,
    points,
    path.masteryThreshold,
    enrollment?.approvalStatus ?? "NOT_REQUIRED",
  );
  if (!enrollment) reasons.unshift("Start this learning path.");
  if (
    enrollment &&
    !enrollment.verifiedAt &&
    enrollment.configuredGains !== gainFingerprint(activity.gains)
  )
    reasons.unshift(
      "Configured skill gains changed after enrollment; request a reviewed replacement path.",
    );
  if (legacyCompleted)
    reasons.unshift(
      "This is a historical completion; no verified evidence or new skill gain is claimed.",
    );
  if (state.employee.tenureMonths < activity.minTenureMonths)
    reasons.unshift("This activity's tenure requirement is not met.");
  const completed = progress.filter((p) => p.status === "COMPLETED").length;
  const milestone = enrollment?.milestone
    ? parse<ActivityWorkspace["milestone"]>(enrollment.milestone, null)
    : null;
  if (milestone)
    milestone.nextRecommendation = state.recommendations[0] ?? null;
  return {
    masteryRemaining: Math.max(0, path.masteryThreshold - points),
    activity,
    employee: {
      id: state.employee.id,
      name: state.employee.name,
      targetRole: state.employee.targetRole,
      targetGrade: state.employee.targetGrade,
    },
    path: {
      id: path.id,
      title: path.title,
      description: path.description,
      skillId: path.skillId,
      skillName:
        state.skills.find((s) => s.id === path.skillId)?.name ?? path.skillId,
      fromLevel: path.fromLevel,
      toLevel: path.toLevel,
      audience: path.audience,
      masteryThreshold: path.masteryThreshold,
      requiresApproval: path.requiresApproval,
      learningObjectives: parse(path.learningObjectives, []),
      estimatedMinutes: definitions.reduce((n, u) => n + u.estimatedMinutes, 0),
    },
    enrollment: enrollment
      ? {
          id: enrollment.id,
          status: enrollment.status,
          startedAt: enrollment.startedAt.toISOString(),
          completedAt: enrollment.completedAt?.toISOString() ?? null,
          verifiedAt: enrollment.verifiedAt?.toISOString() ?? null,
          approvalStatus: enrollment.approvalStatus as NonNullable<
            ActivityWorkspace["enrollment"]
          >["approvalStatus"],
          approvalComment: enrollment.approvalComment,
          masteryPoints: points,
          progressPercent: definitions.length
            ? Math.round((100 * completed) / definitions.length)
            : 0,
          completedUnits: completed,
          totalUnits: definitions.length,
          remainingMinutes: definitions
            .filter(
              (u) =>
                !progress.some(
                  (p) => p.unitId === u.id && p.status === "COMPLETED",
                ),
            )
            .reduce((n, u) => n + u.estimatedMinutes, 0),
        }
      : null,
    units: definitions.map((unit) => {
      const { assessmentConfig: _privateConfig, ...safe } = unit;
      const p = progress.find((p) => p.unitId === unit.id);
      if (unit.type === "AI_TASK")
        safe.content = {
          ...safe.content,
          ...getAdaptiveTask(unit.skillId, {
            currentLevel:
              state.employee.skills.find((s) => s.skillId === unit.skillId)
                ?.level ?? 0,
            targetLevel:
              changes.find((s) => s.skillId === unit.skillId)?.to ??
              path.toLevel,
            careerTarget:
              state.employee.targetGrade + " " + state.employee.targetRole,
          }),
        };
      return {
        ...safe,
        rubric: unit.assessmentConfig?.rubric,
        status: states.get(unit.id)!,
        canSkip: !!(
          skipAllowed &&
          !unit.required &&
          unit.content.basicPractice
        ),
        progress: p
          ? {
              submission: p.submission,
              answers: parse(p.answers, null),
              score: p.score,
              feedback: parse<AssessmentEvaluation | null>(p.feedback, null),
              attempts: p.attempts,
              masteryPoints:
                p.status === "COMPLETED" && !p.skipped ? unit.masteryPoints : 0,
              completedAt: p.completedAt?.toISOString() ?? null,
              skipped: p.skipped,
            }
          : null,
      };
    }),
    impact: {
      skills: changes,
      readinessBefore: readiness(state.employee, state.requirements),
      readinessAfter: readiness(projected, state.requirements),
    },
    evidence: evidence.filter((e) => e.activityId === activityId),
    milestone,
    legacyCompleted,
    canVerify: !!enrollment && !enrollment.verifiedAt && !reasons.length,
    verificationBlockedReasons: reasons,
  };
}
export async function updateLearningUnit(
  employeeId: string,
  activityId: string,
  raw: LearningUnitAction,
): Promise<ActivityWorkspace> {
  const input = actionSchema.parse(raw);
  const path = await ensurePath(activityId);
  const enrollment = await repositories.learning.enrollment(
    employeeId,
    path.id,
  );
  if (!enrollment)
    throw new BusinessRuleError("Start the learning path first.");
  if (enrollment.verifiedAt)
    return getActivityWorkspace(employeeId, activityId);
  const employee = await getEmployee(employeeId);
  const event = await repositories.activities.getById(activityId);
  if (!event || employee.tenureMonths < event.minTenureMonths)
    throw new BusinessRuleError(
      "This activity's tenure requirement is not met.",
    );
  const rows = await repositories.learning.units(path.id, enrollment.id);
  const units = rows.map(unitDefinition),
    unit = units.find((u) => u.id === input.unitId);
  if (!unit)
    throw new BusinessRuleError(
      "Learning unit not found in this employee's path.",
    );
  const state = calculateStates(units, enrollment.progress, true).get(unit.id)!;
  if (state === "LOCKED")
    throw new BusinessRuleError("Complete the earlier required units first.");
  const previous = enrollment.progress.find((p) => p.unitId === unit.id);
  const revisingProject =
    unit.type === "PROJECT" &&
    enrollment.approvalStatus === "REJECTED" &&
    input.action === "submit";
  if (state === "COMPLETED" && !revisingProject)
    return getActivityWorkspace(employeeId, activityId);
  if (input.action === "complete" && !consuming.has(unit.type))
    throw new BusinessRuleError(
      "This unit requires assessed evidence; opening or marking it complete is insufficient.",
    );
  if (input.action === "complete" && state !== "IN_PROGRESS")
    throw new BusinessRuleError(
      "Start the learning unit before confirming consumption.",
    );
  if (input.action === "submit" && !scored.has(unit.type))
    throw new BusinessRuleError(
      "This unit does not accept self-assessed submissions.",
    );
  if (
    input.action === "skip" &&
    (unit.required ||
      !unit.content.basicPractice ||
      !enrollment.progress.some((p) => (p.score ?? 0) >= 85))
  )
    throw new BusinessRuleError(
      "Only optional basic practice may be skipped after a score of at least 85%.",
    );
  if (
    input.action === "submit" &&
    (previous?.score ?? 100) < 70 &&
    units.some(
      (u) =>
        u.isRemediation &&
        !enrollment.progress.some(
          (p) => p.unitId === u.id && p.status === "COMPLETED",
        ),
    )
  )
    throw new BusinessRuleError(
      "Complete the assigned remediation modules before retrying an assessment.",
    );
  let evaluation: AssessmentEvaluation | null = null;
  if (input.action === "submit") {
    if (
      unit.type !== "QUIZ" &&
      (!input.submission || input.submission.length < 80)
    )
      throw new BusinessRuleError(
        "Provide a written solution of at least 80 characters.",
      );
    const currentLevel =
      employee.skills.find((s) => s.skillId === unit.skillId)?.level ?? 0;
    const gain = event.gains.find((g) => g.skillId === unit.skillId);
    const context = {
      currentLevel,
      targetLevel: gain
        ? Math.max(
            currentLevel,
            Math.min(5, gain.maxLevel, currentLevel + gain.gain),
          )
        : path.toLevel,
      careerTarget: employee.targetGrade + " " + employee.targetRole,
    };
    const evaluationUnit =
      unit.type === "AI_TASK"
        ? {
            ...unit,
            content: {
              ...unit.content,
              ...getAdaptiveTask(unit.skillId, context),
            },
          }
        : unit;
    evaluation = await evaluateLearningSubmission(
      evaluationUnit,
      { submission: input.submission, answers: input.answers },
      context,
    );
  }
  await repositories.transaction(
    async (tx) => {
      const latest = await tx.learning.enrollmentById(enrollment.id);
      if (!latest || latest.verifiedAt)
        throw new BusinessRuleError(
          "This learning path has already been verified.",
        );
      const nowProgress = latest.progress.find((p) => p.unitId === unit.id);
      if ((nowProgress?.attempts ?? 0) !== (previous?.attempts ?? 0))
        throw new BusinessRuleError(
          "Another assessment was saved. Refresh before retrying.",
        );
      const nowState = calculateStates(units, latest.progress, true).get(
        unit.id,
      );
      if (nowState === "LOCKED")
        throw new BusinessRuleError("Complete earlier units first.");
      if (
        input.action === "submit" &&
        (nowProgress?.score ?? 100) < 70 &&
        units.some(
          (u) =>
            u.isRemediation &&
            !latest.progress.some(
              (p) => p.unitId === u.id && p.status === "COMPLETED",
            ),
        )
      )
        throw new BusinessRuleError(
          "Complete the assigned remediation modules before retrying an assessment.",
        );
      if (nowProgress?.status === "COMPLETED" && !revisingProject) return;
      const now = new Date();
      const status =
        input.action === "start"
          ? "IN_PROGRESS"
          : input.action === "submit"
            ? evaluation!.score >= 70
              ? "COMPLETED"
              : "FAILED"
            : "COMPLETED";
      const data = {
        status,
        submission:
          input.action === "submit"
            ? (input.submission ?? null)
            : (nowProgress?.submission ?? null),
        answers:
          input.action === "submit" && input.answers
            ? JSON.stringify(input.answers)
            : (nowProgress?.answers ?? null),
        score: evaluation?.score ?? nowProgress?.score ?? null,
        feedback: evaluation
          ? JSON.stringify(evaluation)
          : (nowProgress?.feedback ?? null),
        attempts: (nowProgress?.attempts ?? 0) + (evaluation ? 1 : 0),
        skipped: input.action === "skip",
        completedAt: status === "COMPLETED" ? now : null,
      };
      await tx.learning.saveProgress(enrollment.id, unit.id, data);
      if (evaluation) {
        await tx.learning.addAssessment({
          enrollmentId: enrollment.id,
          unitId: unit.id,
          score: evaluation.score,
          passed: evaluation.score >= 70,
          evaluation: JSON.stringify(evaluation),
          submission: input.submission ?? null,
          answers: input.answers ? JSON.stringify(input.answers) : null,
        });
        const adaptive = getAdaptiveDecision(
          evaluation.score,
          evaluation.weakTopics,
        );
        if (adaptive.mode === "REMEDIATION") {
          const remediation = createRemediationUnits(
            unit,
            adaptive.reviewTopics,
          );
          for (const [index, extra] of remediation.entries()) {
            const id =
              enrollment.id +
              "_" +
              unit.id +
              "_A" +
              data.attempts +
              "_R" +
              index;
            if (!(await tx.learning.getUnit(id)))
              await tx.learning.createUnit(
                unitData(
                  {
                    ...extra,
                    id,
                    order: unit.order + 0.01 * (index + 1),
                    required: true,
                    isRemediation: true,
                  },
                  path.id,
                  enrollment.id,
                ),
              );
          }
        }
        if (unit.type === "PROJECT" && path.requiresApproval)
          await tx.learning.updateEnrollment(enrollment.id, {
            approvalStatus: "PENDING",
            approvalComment: null,
            approvedAt: null,
          });
      }
      if (
        status === "COMPLETED" &&
        input.action !== "skip" &&
        !unit.isRemediation
      ) {
        const type =
          unit.type === "AI_TASK"
            ? "AI_ASSESSMENT"
            : unit.type === "ARTICLE" || unit.type === "VIDEO"
              ? "COURSE"
              : unit.type === "ASSESSMENT" ||
                  unit.type === "CASE_STUDY" ||
                  unit.type === "CODING_TASK"
                ? "AI_ASSESSMENT"
                : unit.type;
        const summary = evaluation
          ? "Rubric assessment " +
            evaluation.score +
            "%. " +
            evaluation.strengths.slice(0, 2).join(" ")
          : "Learning content consumed. Skill advancement still requires assessed mastery and verification.";
        const evidenceData = {
          type,
          title: unit.title,
          level:
            employee.skills.find((s) => s.skillId === unit.skillId)?.level ?? 0,
          score: evaluation?.score ?? null,
          confidence: evaluation ? Math.round(evaluation.score) : 0,
          summary,
        };
        await tx.evidence.saveUnit({
          employeeId,
          enrollmentId: enrollment.id,
          unitId: unit.id,
          skillId: unit.skillId,
          ...evidenceData,
        });
      }
    },
    { timeout: 25000 },
  );
  return getActivityWorkspace(employeeId, activityId);
}

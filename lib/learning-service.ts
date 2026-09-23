import { randomUUID } from "node:crypto";
import type {
  Prisma,
  LearningUnit,
  LearningUnitProgress,
} from "@prisma/client";
import { z } from "zod";
import { db } from "./db";
import { snapshot, getEmployee } from "./services";
import { applySkillGains, readiness } from "./recommendation-engine";
import {
  createLearningPath,
  generateLearningPath,
  createRemediationUnits,
  getAdaptiveTask,
} from "./learning-content";
import { calculateMastery, getAdaptiveDecision } from "./learning-engine";
import {
  evaluateLearningSubmission,
  SYSTEM_DESIGN_RUBRIC,
} from "./learning-assessment";
import { LEARNING_UNIT_TYPES } from "./learning-types";
import type { Employee } from "./types";
import type {
  ActivityWorkspace,
  AssessmentEvaluation,
  DevelopmentReport,
  LearningPathDefinition,
  LearningPathDraft,
  LearningPathBuilderInput,
  LearningUnitAction,
  LearningUnitDefinition,
  LearningUnitStatus,
  SkillEvidenceView,
} from "./learning-types";

type Tx = Prisma.TransactionClient;
const gainFingerprint = (
  gains: { skillId: string; gain: number; maxLevel: number }[],
) =>
  JSON.stringify(
    gains
      .map((g) => ({ skillId: g.skillId, gain: g.gain, maxLevel: g.maxLevel }))
      .sort((a, b) => a.skillId.localeCompare(b.skillId)),
  );
const consuming = new Set(["COURSE", "ARTICLE", "VIDEO"]);
const scored = new Set([
  "QUIZ",
  "AI_TASK",
  "CASE_STUDY",
  "CODING_TASK",
  "PROJECT",
  "ASSESSMENT",
  "CERTIFICATION",
]);
const parse = <T>(value: string | null, fallback: T): T =>
  value ? (JSON.parse(value) as T) : fallback;
function unitDefinition(unit: LearningUnit): LearningUnitDefinition {
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
    content: parse(unit.content, {}),
    learningObjectives: parse(unit.learningObjectives, []),
    completionRequirement: unit.completionRequirement ?? undefined,
    masteryPoints: unit.masteryPoints,
    assessmentConfig: parse(unit.assessmentConfig, undefined),
    isRemediation: unit.isRemediation,
  };
}
function unitData(
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
function fullLearningPath(
  activity: import("./types").Activity,
  skills: import("./types").Skill[],
): LearningPathDefinition {
  const main = createLearningPath(activity, skills);
  let order = Math.max(...main.units.map((u) => u.order));
  for (const gain of activity.gains.slice(1)) {
    const supplemental = createLearningPath(
      { ...activity, gains: [gain] },
      skills,
    );
    for (const unit of supplemental.units.filter((u) =>
      ["COURSE", "VIDEO", "AI_TASK", "CODING_TASK", "ASSESSMENT"].includes(
        u.type,
      ),
    ))
      main.units.push({
        ...unit,
        id: unit.id + "_" + gain.skillId,
        order: ++order,
        required: true,
      });
  }
  return main;
}
async function createPath(
  tx: Tx,
  eventId: string,
  definition: LearningPathDefinition,
) {
  const pathId = "LP_" + eventId;
  const path = await tx.learningPath.create({
    data: {
      id: pathId,
      eventId,
      title: definition.title,
      description: definition.description,
      skillId: definition.skillId,
      fromLevel: definition.fromLevel,
      toLevel: definition.toLevel,
      audience: definition.audience,
      learningObjectives: JSON.stringify(definition.learningObjectives),
      masteryThreshold: Math.max(70, definition.masteryThreshold),
      requiresApproval: definition.requiresApproval,
    },
  });
  for (const [index, unit] of definition.units.entries())
    await tx.learningUnit.create({
      data: unitData({ ...unit, id: pathId + "_U" + (index + 1) }, path.id),
    });
  return path;
}
export async function ensureLearningPaths() {
  const [events, skills] = await Promise.all([
    db.event.findMany({ include: { gains: true, learningPath: true } }),
    db.skill.findMany(),
  ]);
  for (const event of events) {
    if (event.learningPath || !event.gains.length) continue;
    await db.$transaction(
      async (tx) => {
        if (await tx.learningPath.findUnique({ where: { eventId: event.id } }))
          return;
        await createPath(tx, event.id, fullLearningPath(event, skills));
      },
      { timeout: 20000 },
    );
  }
}
async function ensurePath(activityId: string) {
  let path = await db.learningPath.findUnique({
    where: { eventId: activityId },
  });
  if (path) return path;
  const [event, skills] = await Promise.all([
    db.event.findUnique({
      where: { id: activityId },
      include: { gains: true },
    }),
    db.skill.findMany(),
  ]);
  if (!event) throw new Error("Activity not found.");
  if (!event.gains.length)
    throw new Error(
      "This activity needs a configured skill gain before a learning path can be published.",
    );
  path = await db.$transaction(async (tx) => {
    const existing = await tx.learningPath.findUnique({
      where: { eventId: activityId },
    });
    return (
      existing ?? createPath(tx, activityId, fullLearningPath(event, skills))
    );
  });
  return path;
}
function calculateStates(
  units: LearningUnitDefinition[],
  progress: LearningUnitProgress[],
  started: boolean,
) {
  const states = new Map<string, LearningUnitStatus>();
  for (const unit of units) {
    const own = progress.find((p) => p.unitId === unit.id);
    if (own) {
      states.set(unit.id, own.status as LearningUnitStatus);
      continue;
    }
    const earlier = units.filter(
      (u) =>
        u.order < unit.order &&
        u.required &&
        !u.isRemediation &&
        u.type !== "MENTOR_SESSION",
    );
    const unlocked =
      started &&
      (unit.isRemediation ||
        earlier.every((u) =>
          progress.some((p) => p.unitId === u.id && p.status === "COMPLETED"),
        ));
    states.set(unit.id, unlocked ? "AVAILABLE" : "LOCKED");
  }
  return states;
}
function mastery(
  units: LearningUnitDefinition[],
  progress: LearningUnitProgress[],
  approved: boolean,
) {
  return calculateMastery(
    units,
    progress
      .filter((p) => !p.skipped)
      .map((p) => ({
        unitId: p.unitId,
        status: p.status as LearningUnitStatus,
        score: p.score,
      })),
    approved,
  );
}
function verificationReasons(
  units: LearningUnitDefinition[],
  progress: LearningUnitProgress[],
  points: number,
  threshold: number,
  approvalStatus: string,
) {
  const reasons: string[] = [];
  if (
    units.some(
      (u) =>
        u.required &&
        !progress.some(
          (p) => p.unitId === u.id && p.status === "COMPLETED" && !p.skipped,
        ),
    )
  )
    reasons.push("Complete every required learning and remediation unit.");
  const assessments = units.filter((u) => u.type === "ASSESSMENT");
  if (
    !assessments.length ||
    assessments.some(
      (u) =>
        !progress.some(
          (p) =>
            p.unitId === u.id &&
            p.status === "COMPLETED" &&
            (p.score ?? 0) >= 70,
        ),
    )
  )
    reasons.push("Pass final skill verification with at least 70%.");
  if (
    units.some(
      (u) =>
        scored.has(u.type) &&
        u.required &&
        !progress.some(
          (p) =>
            p.unitId === u.id &&
            p.status === "COMPLETED" &&
            (p.score ?? 0) >= 70,
        ),
    )
  )
    reasons.push("Pass the required evidence assessments with at least 70%.");
  if (points < threshold)
    reasons.push("Earn at least " + threshold + " mastery points.");
  if (approvalStatus === "PENDING")
    reasons.push("Manager or mentor approval is pending.");
  if (approvalStatus === "REJECTED")
    reasons.push(
      "Manager requested changes. Submit a revised project for approval.",
    );
  return reasons;
}
export async function getSkillEvidence(
  employeeId: string,
): Promise<SkillEvidenceView[]> {
  const rows = await db.skillEvidence.findMany({
    where: { employeeId },
    include: {
      skill: true,
      enrollment: { include: { path: { include: { event: true } } } },
    },
    orderBy: { createdAt: "desc" },
  });
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
export async function getActivityWorkspace(
  employeeId: string,
  activityId: string,
): Promise<ActivityWorkspace> {
  const path = await ensurePath(activityId);
  const [state, enrollment, evidence] = await Promise.all([
    snapshot(employeeId),
    db.learningEnrollment.findUnique({
      where: { employeeId_pathId: { employeeId, pathId: path.id } },
      include: { progress: true },
    }),
    getSkillEvidence(employeeId),
  ]);
  const activity = state.events.find((e) => e.id === activityId)!;
  const rows = await db.learningUnit.findMany({
    where: {
      pathId: path.id,
      OR: [
        { enrollmentId: null },
        ...(enrollment ? [{ enrollmentId: enrollment.id }] : []),
      ],
    },
    orderBy: { order: "asc" },
  });
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

export async function startLearningActivity(
  employeeId: string,
  activityId: string,
): Promise<ActivityWorkspace> {
  const path = await ensurePath(activityId);
  await db.$transaction(async (tx) => {
    const employee = await tx.employee.findUnique({
      where: { id: employeeId },
      include: { skills: true, history: true },
    });
    const event = await tx.event.findUnique({
      where: { id: activityId },
      include: { gains: true },
    });
    if (!employee || !event) throw new Error("Employee or activity not found.");
    if (employee.tenureMonths < event.minTenureMonths)
      throw new Error("This activity's tenure requirement is not met.");
    const existing = await tx.learningEnrollment.findUnique({
      where: { employeeId_pathId: { employeeId, pathId: path.id } },
    });
    if (existing) return;
    if (
      employee.history.some(
        (h) => h.eventId === activityId && h.status === "COMPLETED",
      )
    )
      throw new Error(
        "Historical completion is preserved; it cannot award a second skill gain.",
      );
    const requirements = await tx.gradeRequirement.findMany();
    await tx.learningEnrollment.create({
      data: {
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
      },
    });
    await tx.activityHistory.upsert({
      where: { employeeId_eventId: { employeeId, eventId: activityId } },
      create: { employeeId, eventId: activityId, status: "IN_PROGRESS" },
      update: { status: "IN_PROGRESS", completedAt: null },
    });
    await tx.recommendation.deleteMany({ where: { employeeId } });
  });
  return getActivityWorkspace(employeeId, activityId);
}
const actionSchema = z
  .object({
    unitId: z.string().min(1).max(200),
    action: z.enum(["start", "complete", "submit", "skip"]),
    submission: z.string().trim().max(20000).optional(),
    answers: z.record(z.number().int().min(0).max(20)).optional(),
  })
  .strict();
export async function updateLearningUnit(
  employeeId: string,
  activityId: string,
  raw: LearningUnitAction,
): Promise<ActivityWorkspace> {
  const input = actionSchema.parse(raw);
  const path = await ensurePath(activityId);
  const enrollment = await db.learningEnrollment.findUnique({
    where: { employeeId_pathId: { employeeId, pathId: path.id } },
    include: { progress: true },
  });
  if (!enrollment) throw new Error("Start the learning path first.");
  if (enrollment.verifiedAt)
    return getActivityWorkspace(employeeId, activityId);
  const employee = await getEmployee(employeeId);
  const event = await db.event.findUnique({
    where: { id: activityId },
    include: { gains: true },
  });
  if (!event || employee.tenureMonths < event.minTenureMonths)
    throw new Error("This activity's tenure requirement is not met.");
  const rows = await db.learningUnit.findMany({
    where: {
      pathId: path.id,
      OR: [{ enrollmentId: null }, { enrollmentId: enrollment.id }],
    },
    orderBy: { order: "asc" },
  });
  const units = rows.map(unitDefinition),
    unit = units.find((u) => u.id === input.unitId);
  if (!unit)
    throw new Error("Learning unit not found in this employee's path.");
  const state = calculateStates(units, enrollment.progress, true).get(unit.id)!;
  if (state === "LOCKED")
    throw new Error("Complete the earlier required units first.");
  const previous = enrollment.progress.find((p) => p.unitId === unit.id);
  const revisingProject =
    unit.type === "PROJECT" &&
    enrollment.approvalStatus === "REJECTED" &&
    input.action === "submit";
  if (state === "COMPLETED" && !revisingProject)
    return getActivityWorkspace(employeeId, activityId);
  if (input.action === "complete" && !consuming.has(unit.type))
    throw new Error(
      "This unit requires assessed evidence; opening or marking it complete is insufficient.",
    );
  if (input.action === "complete" && state !== "IN_PROGRESS")
    throw new Error("Start the learning unit before confirming consumption.");
  if (input.action === "submit" && !scored.has(unit.type))
    throw new Error("This unit does not accept self-assessed submissions.");
  if (
    input.action === "skip" &&
    (unit.required ||
      !unit.content.basicPractice ||
      !enrollment.progress.some((p) => (p.score ?? 0) >= 85))
  )
    throw new Error(
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
    throw new Error(
      "Complete the assigned remediation modules before retrying an assessment.",
    );
  let evaluation: AssessmentEvaluation | null = null;
  if (input.action === "submit") {
    if (
      unit.type !== "QUIZ" &&
      (!input.submission || input.submission.length < 80)
    )
      throw new Error("Provide a written solution of at least 80 characters.");
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
  await db.$transaction(
    async (tx) => {
      const latest = await tx.learningEnrollment.findUnique({
        where: { id: enrollment.id },
        include: { progress: true },
      });
      if (!latest || latest.verifiedAt)
        throw new Error("This learning path has already been verified.");
      const nowProgress = latest.progress.find((p) => p.unitId === unit.id);
      if ((nowProgress?.attempts ?? 0) !== (previous?.attempts ?? 0))
        throw new Error(
          "Another assessment was saved. Refresh before retrying.",
        );
      const nowState = calculateStates(units, latest.progress, true).get(
        unit.id,
      );
      if (nowState === "LOCKED")
        throw new Error("Complete earlier units first.");
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
        throw new Error(
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
      await tx.learningUnitProgress.upsert({
        where: {
          enrollmentId_unitId: { enrollmentId: enrollment.id, unitId: unit.id },
        },
        create: { enrollmentId: enrollment.id, unitId: unit.id, ...data },
        update: data,
      });
      if (evaluation) {
        await tx.assessmentResult.create({
          data: {
            enrollmentId: enrollment.id,
            unitId: unit.id,
            score: evaluation.score,
            passed: evaluation.score >= 70,
            evaluation: JSON.stringify(evaluation),
            submission: input.submission ?? null,
            answers: input.answers ? JSON.stringify(input.answers) : null,
          },
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
            if (!(await tx.learningUnit.findUnique({ where: { id } })))
              await tx.learningUnit.create({
                data: unitData(
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
              });
          }
        }
        if (unit.type === "PROJECT" && path.requiresApproval)
          await tx.learningEnrollment.update({
            where: { id: enrollment.id },
            data: {
              approvalStatus: "PENDING",
              approvalComment: null,
              approvedAt: null,
            },
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
        await tx.skillEvidence.upsert({
          where: {
            enrollmentId_unitId_skillId: {
              enrollmentId: enrollment.id,
              unitId: unit.id,
              skillId: unit.skillId,
            },
          },
          create: {
            employeeId,
            enrollmentId: enrollment.id,
            unitId: unit.id,
            skillId: unit.skillId,
            ...evidenceData,
          },
          update: evidenceData,
        });
      }
    },
    { timeout: 25000 },
  );
  return getActivityWorkspace(employeeId, activityId);
}
export async function verifyLearningActivity(
  employeeId: string,
  activityId: string,
): Promise<ActivityWorkspace> {
  const path = await ensurePath(activityId);
  await db.$transaction(
    async (tx) => {
      const enrollment = await tx.learningEnrollment.findUnique({
        where: { employeeId_pathId: { employeeId, pathId: path.id } },
        include: { progress: true },
      });
      if (!enrollment) throw new Error("Start the learning path first.");
      if (enrollment.verifiedAt) return;
      const raw = await tx.employee.findUnique({
        where: { id: employeeId },
        include: { skills: true, history: true },
      });
      const event = await tx.event.findUnique({
        where: { id: activityId },
        include: { gains: true },
      });
      if (!raw || !event) throw new Error("Employee or activity not found.");
      if (raw.tenureMonths < event.minTenureMonths)
        throw new Error("This activity's tenure requirement is not met.");
      if (
        raw.history.some(
          (h) => h.eventId === activityId && h.status === "COMPLETED",
        )
      )
        throw new Error(
          "A completed activity cannot award another skill gain.",
        );
      if (enrollment.configuredGains !== gainFingerprint(event.gains))
        throw new Error(
          "Configured skill gains changed after enrollment; a reviewed replacement path is required before verification.",
        );
      const rows = await tx.learningUnit.findMany({
        where: {
          pathId: path.id,
          OR: [{ enrollmentId: null }, { enrollmentId: enrollment.id }],
        },
        orderBy: { order: "asc" },
      });
      const units = rows.map(unitDefinition);
      const evidence = await tx.skillEvidence.findMany({
        where: { enrollmentId: enrollment.id },
      });
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
        throw new Error(
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
      if (reasons.length) throw new Error(reasons.join(" "));
      const [requirements, skills] = await Promise.all([
        tx.gradeRequirement.findMany(),
        tx.skill.findMany(),
      ]);
      const employee = { ...raw, history: [] } as Employee;
      const verifiedEvent = event;
      if (!verifiedEvent.gains.length)
        throw new Error("Path skill gain is no longer configured.");
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
        await tx.employeeSkill.upsert({
          where: {
            employeeId_skillId: { employeeId, skillId: change.skillId },
          },
          create: { employeeId, skillId: change.skillId, level: change.to },
          update: { level: change.to },
        });
      for (const gain of verifiedEvent.gains) {
        const level =
          projected.skills.find((s) => s.skillId === gain.skillId)?.level ?? 0;
        await tx.skillEvidence.updateMany({
          where: { enrollmentId: enrollment.id, skillId: gain.skillId },
          data: { level, verifiedAt: now },
        });
      }
      const milestone = {
        changes,
        readinessBefore: readiness(employee, requirements),
        readinessAfter: readiness(projected, requirements),
        evidenceConfidence: confidence,
        nextRecommendation: null,
      };
      await tx.learningEnrollment.update({
        where: { id: enrollment.id },
        data: {
          status: "COMPLETED",
          completedAt: now,
          verifiedAt: now,
          milestone: JSON.stringify(milestone),
        },
      });
      await tx.activityHistory.upsert({
        where: { employeeId_eventId: { employeeId, eventId: activityId } },
        create: {
          employeeId,
          eventId: activityId,
          status: "COMPLETED",
          completedAt: now,
        },
        update: { status: "COMPLETED", completedAt: now },
      });
      await tx.recommendation.deleteMany({ where: { employeeId } });
    },
    { timeout: 25000 },
  );
  return getActivityWorkspace(employeeId, activityId);
}

export async function getLearningCatalog() {
  await ensureLearningPaths();
  const paths = await db.learningPath.findMany({
    include: { units: { where: { enrollmentId: null } } },
  });
  return paths.map((p) => ({
    activityId: p.eventId,
    unitTypes: [...new Set(p.units.map((u) => u.type))],
    difficulty: Math.max(1, ...p.units.map((u) => u.difficulty)),
    estimatedMinutes: p.units.reduce((n, u) => n + u.estimatedMinutes, 0),
    skillId: p.skillId,
    published: true,
  }));
}
export async function developmentReport(): Promise<DevelopmentReport> {
  await ensureLearningPaths();
  const [paths, skills] = await Promise.all([
    db.learningPath.findMany({
      include: {
        skill: true,
        event: true,
        units: { orderBy: { order: "asc" } },
        enrollments: {
          include: { employee: true, progress: true, assessments: true },
        },
      },
      orderBy: { createdAt: "asc" },
    }),
    db.skill.findMany(),
  ]);
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
    const unitStats = base.map((u) => ({
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
export async function reviewLearningApproval(input: {
  enrollmentId: string;
  approved: boolean;
  comment?: string;
}): Promise<DevelopmentReport> {
  const parsed = z
    .object({
      enrollmentId: z.string().min(1).max(200),
      approved: z.boolean(),
      comment: z.string().trim().max(2000).optional(),
    })
    .strict()
    .parse(input);
  await db.$transaction(async (tx) => {
    const enrollment = await tx.learningEnrollment.findUnique({
      where: { id: parsed.enrollmentId },
      include: { path: { include: { units: true } }, progress: true },
    });
    if (!enrollment) throw new Error("Enrollment not found.");
    if (!enrollment.path.requiresApproval)
      throw new Error("This path does not require manager approval.");
    if (enrollment.verifiedAt)
      throw new Error("This path has already been verified.");
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
      throw new Error(
        "Review is available after the required assessed work is complete. " +
          reasons.join(" "),
      );
    await tx.learningEnrollment.update({
      where: { id: enrollment.id },
      data: {
        approvalStatus: parsed.approved ? "APPROVED" : "REJECTED",
        approvalComment: parsed.comment ?? null,
        approvedAt: parsed.approved ? new Date() : null,
      },
    });
    if (parsed.approved) {
      for (const unit of units.filter((u) => u.type === "MENTOR_SESSION"))
        await tx.learningUnitProgress.upsert({
          where: {
            enrollmentId_unitId: {
              enrollmentId: enrollment.id,
              unitId: unit.id,
            },
          },
          create: {
            enrollmentId: enrollment.id,
            unitId: unit.id,
            status: "COMPLETED",
            completedAt: new Date(),
          },
          update: { status: "COMPLETED", completedAt: new Date() },
        });
      const existing = await tx.skillEvidence.findFirst({
        where: { enrollmentId: enrollment.id, type: "MENTOR_VALIDATION" },
      });
      if (!existing)
        await tx.skillEvidence.create({
          data: {
            employeeId: enrollment.employeeId,
            enrollmentId: enrollment.id,
            skillId: enrollment.path.skillId,
            type: "MENTOR_VALIDATION",
            title: "Manager / mentor validation",
            level: enrollment.path.fromLevel,
            confidence: 0,
            summary:
              "Simulated HR approval of assessed work. " +
              (parsed.comment ?? ""),
          },
        });
    }
  });
  return developmentReport();
}
const safeUrl = z
  .string()
  .url()
  .max(2000)
  .refine(
    (url) => ["http:", "https:"].includes(new URL(url).protocol),
    "Only HTTP(S) content URLs are supported.",
  );
const questionSchema = z
  .object({
    id: z.string().min(1).max(100),
    text: z.string().min(10).max(2000),
    answers: z.array(z.string().min(1).max(1000)).min(2).max(8),
    topic: z.string().min(1).max(200),
    skillId: z.string().min(1).max(120),
    difficulty: z.number().int().min(1).max(5),
  })
  .strict();
const contentSchema = z
  .object({
    sections: z
      .array(
        z
          .object({
            title: z.string().min(1).max(200),
            body: z.string().min(1).max(12000),
          })
          .strict(),
      )
      .max(20)
      .optional(),
    prompt: z.string().max(12000).optional(),
    deliverables: z.array(z.string().max(2000)).max(20).optional(),
    syntheticData: z.string().max(20000).optional(),
    questions: z.array(questionSchema).min(1).max(30).optional(),
    basicPractice: z.boolean().optional(),
    externalUrl: safeUrl.optional(),
    providerName: z.string().max(200).optional(),
    courseId: z.string().max(200).optional(),
  })
  .strict();
const unitSchema = z
  .object({
    id: z.string().min(1).max(200),
    title: z.string().min(1).max(200),
    description: z.string().min(1).max(5000),
    type: z.enum(LEARNING_UNIT_TYPES),
    estimatedMinutes: z.number().int().min(1).max(1440),
    order: z.number().min(0).max(10000),
    required: z.boolean(),
    skillId: z.string().min(1).max(120),
    difficulty: z.number().int().min(1).max(5),
    content: contentSchema,
    learningObjectives: z.array(z.string().min(1).max(1000)).min(1).max(20),
    externalUrl: safeUrl.optional(),
    providerName: z.string().max(200).optional(),
    externalCourseId: z.string().max(200).optional(),
    completionRequirement: z.string().max(3000).optional(),
    masteryPoints: z.number().int().min(0).max(30),
    assessmentConfig: z
      .object({
        questions: z
          .array(
            z
              .object({
                id: z.string().min(1).max(100),
                correctAnswer: z.number().int().min(0).max(7),
                explanation: z.string().min(1).max(3000),
                topic: z.string().min(1).max(200),
              })
              .strict(),
          )
          .min(1)
          .max(30)
          .optional(),
        rubric: z
          .record(z.string().min(1).max(80), z.number().int().min(1).max(100))
          .optional(),
      })
      .strict()
      .optional(),
    isRemediation: z.boolean().optional(),
  })
  .strict();
const pathSchema = z
  .object({
    title: z.string().min(3).max(200),
    description: z.string().min(10).max(5000),
    skillId: z.string().min(1).max(120),
    fromLevel: z.number().int().min(0).max(4),
    toLevel: z.number().int().min(1).max(5),
    audience: z.string().min(3).max(200),
    learningObjectives: z.array(z.string().min(1).max(1000)).min(1).max(20),
    units: z.array(unitSchema).min(4).max(40),
    masteryThreshold: z.number().int().min(70).max(100),
    requiresApproval: z.boolean(),
    status: z.literal("DRAFT").optional(),
    generator: z.literal("deterministic").optional(),
    estimatedMinutes: z.number().int().positive().optional(),
  })
  .strict()
  .superRefine((path, ctx) => {
    const fail = (message: string) =>
      ctx.addIssue({ code: z.ZodIssueCode.custom, message });
    if (path.toLevel <= path.fromLevel)
      fail("Target level must exceed starting level.");
    if (
      new Set(path.units.map((u) => u.id)).size !== path.units.length ||
      new Set(path.units.map((u) => u.order)).size !== path.units.length
    )
      fail("Unit IDs and orders must be unique.");
    if (path.units.some((u) => u.skillId !== path.skillId || u.isRemediation))
      fail(
        "Published draft units must belong to the configured skill and cannot be learner-specific remediation.",
      );
    if (!path.units.some((u) => u.type === "ASSESSMENT" && u.required))
      fail("A required final skill assessment is mandatory.");
    if (
      !path.units.some(
        (u) =>
          ["AI_TASK", "PROJECT", "CODING_TASK"].includes(u.type) && u.required,
      )
    )
      fail("A required applied evidence task is mandatory.");
    for (const unit of path.units) {
      if (scored.has(unit.type) && unit.type !== "QUIZ") {
        if (!unit.content.prompt || unit.content.prompt.length < 20)
          fail("Assessed written tasks require a clear prompt.");
        const rubric = unit.assessmentConfig?.rubric;
        if (
          !rubric ||
          Object.keys(rubric).sort().join("|") !==
            Object.keys(SYSTEM_DESIGN_RUBRIC).sort().join("|") ||
          Object.values(rubric).reduce((n, v) => n + v, 0) !== 100
        )
          fail(
            "Assessed written tasks require an explicit rubric totaling 100.",
          );
      }
      if (unit.type === "QUIZ") {
        const publicQuestions = unit.content.questions ?? [],
          keys = unit.assessmentConfig?.questions ?? [];
        if (
          !publicQuestions.length ||
          keys.length !== publicQuestions.length ||
          new Set(publicQuestions.map((q) => q.id)).size !==
            publicQuestions.length
        )
          fail("Quiz questions require unique IDs and complete answer keys.");
        for (const question of publicQuestions) {
          const key = keys.find((k) => k.id === question.id);
          if (
            !key ||
            key.correctAnswer >= question.answers.length ||
            question.skillId !== path.skillId
          )
            fail("Quiz answer key or skill reference is invalid.");
        }
      }
      if (
        unit.type === "MENTOR_SESSION" &&
        unit.required &&
        !path.requiresApproval
      )
        fail("Required mentor sessions need manager approval.");
    }
    const max = calculateMastery(
      path.units,
      path.units
        .filter((u) => u.required)
        .map((u) => ({ unitId: u.id, status: "COMPLETED", score: 100 })),
      path.requiresApproval,
    );
    if (max < path.masteryThreshold)
      fail("Required units cannot earn the configured mastery threshold.");
  });
export async function draftLearningPath(
  input: LearningPathBuilderInput,
): Promise<LearningPathDraft> {
  const parsed = z
    .object({
      skillId: z.string().min(1).max(120),
      fromLevel: z.number().int().min(0).max(4),
      toLevel: z.number().int().min(1).max(5),
      audience: z.string().trim().min(3).max(200),
      title: z.string().trim().min(3).max(200).optional(),
    })
    .strict()
    .parse(input);
  if (parsed.toLevel <= parsed.fromLevel)
    throw new Error("Target level must exceed current level.");
  const skill = await db.skill.findUnique({ where: { id: parsed.skillId } });
  if (!skill) throw new Error("Skill not found.");
  const draft = generateLearningPath({ ...parsed, skillName: skill.name });
  return {
    ...draft,
    status: "DRAFT",
    generator: "deterministic",
    estimatedMinutes: draft.units.reduce((n, u) => n + u.estimatedMinutes, 0),
  };
}
export async function saveLearningPath(
  raw: unknown,
): Promise<{ activityId: string; pathId: string }> {
  const draft = pathSchema.parse(raw);
  const skill = await db.skill.findUnique({ where: { id: draft.skillId } });
  if (!skill) throw new Error("Skill not found.");
  const activityId = "DEV_" + randomUUID().replaceAll("-", "");
  return db.$transaction(
    async (tx) => {
      await tx.event.create({
        data: {
          id: activityId,
          eventCode: activityId,
          name: draft.title,
          type: "Learning Path",
          category: skill.category,
          description: draft.description,
          hours: Math.ceil(
            draft.units.reduce((n, u) => n + u.estimatedMinutes, 0) / 60,
          ),
          businessPriority: 0.7,
          minTenureMonths: 0,
          gains: {
            create: {
              skillId: draft.skillId,
              gain: draft.toLevel - draft.fromLevel,
              maxLevel: draft.toLevel,
            },
          },
        },
      });
      const path = await createPath(tx, activityId, draft);
      await tx.recommendation.deleteMany();
      return { activityId, pathId: path.id };
    },
    { timeout: 25000 },
  );
}

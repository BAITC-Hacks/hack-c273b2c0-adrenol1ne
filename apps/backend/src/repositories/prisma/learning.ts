import type { Prisma } from "@prisma/client";
import type { RepositoryContext } from "../contracts";
export function learningRepositories(
  db: Prisma.TransactionClient,
): Pick<RepositoryContext, "learning" | "evidence"> {
  return {
    learning: {
      pathForActivity: (eventId) =>
        db.learningPath.findUnique({ where: { eventId } }),
      createPath: (data) => db.learningPath.create({ data }),
      async createUnit(data) {
        await db.learningUnit.create({ data });
      },
      getUnit: (id) => db.learningUnit.findUnique({ where: { id } }),
      units: (pathId, enrollmentId) =>
        db.learningUnit.findMany({
          where: {
            pathId,
            OR: [
              { enrollmentId: null },
              ...(enrollmentId ? [{ enrollmentId }] : []),
            ],
          },
          orderBy: { order: "asc" },
        }),
      enrollment: (employeeId, pathId) =>
        db.learningEnrollment.findUnique({
          where: { employeeId_pathId: { employeeId, pathId } },
          include: { progress: true },
        }),
      enrollmentById: (id) =>
        db.learningEnrollment.findUnique({
          where: { id },
          include: { progress: true },
        }),
      enrollmentForReview: (id) =>
        db.learningEnrollment.findUnique({
          where: { id },
          include: { progress: true, path: { include: { units: true } } },
        }),
      async createEnrollment(data) {
        await db.learningEnrollment.create({ data });
      },
      async updateEnrollment(id, data) {
        await db.learningEnrollment.update({ where: { id }, data });
      },
      async saveProgress(enrollmentId, unitId, data) {
        await db.learningUnitProgress.upsert({
          where: { enrollmentId_unitId: { enrollmentId, unitId } },
          create: { enrollmentId, unitId, ...data },
          update: data,
        });
      },
      async addAssessment(data) {
        await db.assessmentResult.create({ data });
      },
      catalog: () =>
        db.learningPath.findMany({
          include: { units: { where: { enrollmentId: null } } },
        }),
      report: (departments) =>
        db.learningPath.findMany({
          include: {
            skill: true,
            event: true,
            units: { orderBy: { order: "asc" } },
            enrollments: {
              where: departments
                ? { employee: { department: { in: departments } } }
                : undefined,
              include: { employee: true, progress: true, assessments: true },
            },
          },
          orderBy: { createdAt: "asc" },
        }),
    },
    evidence: {
      forEmployee: (employeeId) =>
        db.skillEvidence.findMany({
          where: { employeeId },
          include: {
            skill: true,
            enrollment: { include: { path: { include: { event: true } } } },
          },
          orderBy: { createdAt: "desc" },
        }),
      forEnrollment: (enrollmentId) =>
        db.skillEvidence.findMany({ where: { enrollmentId } }),
      mentorValidation: (enrollmentId) =>
        db.skillEvidence.findFirst({
          where: { enrollmentId, type: "MENTOR_VALIDATION" },
        }),
      async saveUnit(data) {
        await db.skillEvidence.upsert({
          where: {
            enrollmentId_unitId_skillId: {
              enrollmentId: data.enrollmentId,
              unitId: data.unitId,
              skillId: data.skillId,
            },
          },
          create: data,
          update: data,
        });
      },
      async add(data) {
        await db.skillEvidence.create({ data });
      },
      async verifySkill(enrollmentId, skillId, level, verifiedAt) {
        await db.skillEvidence.updateMany({
          where: { enrollmentId, skillId },
          data: { level, verifiedAt },
        });
      },
    },
  };
}

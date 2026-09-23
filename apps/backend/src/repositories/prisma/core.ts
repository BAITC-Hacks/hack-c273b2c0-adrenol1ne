import type { Prisma } from "@prisma/client";
import type { Employee, History } from "@shared/types";
import type { RepositoryContext } from "../contracts";
type StoredEmployee = Prisma.EmployeeGetPayload<{
  include: { skills: true; history: true };
}>;
const employeeView = (e: StoredEmployee): Employee => ({
  id: e.id,
  employeeId: e.employeeId,
  name: e.name,
  role: e.role,
  grade: e.grade,
  department: e.department,
  tenureMonths: e.tenureMonths,
  targetRole: e.targetRole,
  targetGrade: e.targetGrade,
  skills: e.skills.map(({ skillId, level }) => ({ skillId, level })),
  history: e.history.map((h) => ({
    eventId: h.eventId,
    status: h.status as History["status"],
    createdAt: h.createdAt.toISOString(),
    completedAt: h.completedAt?.toISOString() ?? null,
  })),
});
export function coreRepositories(
  db: Prisma.TransactionClient,
): Pick<
  RepositoryContext,
  | "employees"
  | "skills"
  | "activities"
  | "career"
  | "history"
  | "recommendations"
  | "managers"
  | "audit"
> {
  const include = {
    skills: true,
    history: { orderBy: { createdAt: "desc" as const } },
  };
  return {
    employees: {
      async getById(id) {
        const e = await db.employee.findUnique({ where: { id }, include });
        return e ? employeeView(e) : null;
      },
      async getByExternalId(employeeId) {
        const e = await db.employee.findUnique({
          where: { employeeId },
          include,
        });
        return e ? employeeView(e) : null;
      },
      async list(departments) {
        return (
          await db.employee.findMany({
            where: departments
              ? { department: { in: departments } }
              : undefined,
            include,
          })
        ).map(employeeView);
      },
      async updateTarget(id, role, grade) {
        await db.employee.update({
          where: { id },
          data: { targetRole: role, targetGrade: grade },
        });
      },
      async updateSkill(employeeId, skillId, level) {
        await db.employeeSkill.upsert({
          where: { employeeId_skillId: { employeeId, skillId } },
          create: { employeeId, skillId, level },
          update: { level },
        });
      },
      async saveImported({ skills, ...e }) {
        await db.employee.upsert({
          where: { id: e.id },
          create: { ...e, skills: { create: skills } },
          update: { ...e, skills: { deleteMany: {}, create: skills } },
        });
      },
    },
    skills: {
      list: () => db.skill.findMany(),
      getById: (id) => db.skill.findUnique({ where: { id } }),
      async save(s) {
        await db.skill.upsert({ where: { id: s.id }, create: s, update: s });
      },
    },
    activities: {
      list: () => db.event.findMany({ include: { gains: true } }),
      listWithPaths: () =>
        db.event.findMany({ include: { gains: true, learningPath: true } }),
      getById: (id) =>
        db.event.findUnique({ where: { id }, include: { gains: true } }),
      async save({ gains, ...e }) {
        await db.event.upsert({
          where: { id: e.id },
          create: { ...e, gains: { create: gains } },
          update: { ...e, gains: { deleteMany: {}, create: gains } },
        });
      },
      async create({ gains, ...e }) {
        await db.event.create({ data: { ...e, gains: { create: gains } } });
      },
      missions: () => db.mission.findMany({ include: { skills: true } }),
    },
    career: {
      requirements: () => db.gradeRequirement.findMany(),
      async saveRequirement(r) {
        await db.gradeRequirement.upsert({
          where: {
            role_grade_skillId: {
              role: r.role,
              grade: r.grade,
              skillId: r.skillId,
            },
          },
          create: r,
          update: r,
        });
      },
    },
    history: {
      async save(h) {
        await db.activityHistory.upsert({
          where: {
            employeeId_eventId: {
              employeeId: h.employeeId,
              eventId: h.eventId,
            },
          },
          create: h,
          update: {
            status: h.status,
            completedAt: h.completedAt ?? null,
            ...(h.createdAt ? { createdAt: h.createdAt } : {}),
          },
        });
      },
    },
    recommendations: {
      get: (employeeId, eventId) =>
        db.recommendation.findUnique({
          where: { employeeId_eventId: { employeeId, eventId } },
        }),
      async save(value) {
        await db.recommendation.upsert({
          where: {
            employeeId_eventId: {
              employeeId: value.employeeId,
              eventId: value.eventId,
            },
          },
          create: value,
          update: { ...value, createdAt: new Date() },
        });
      },
      async invalidate(employeeId) {
        await db.recommendation.deleteMany({
          where: employeeId ? { employeeId } : undefined,
        });
      },
    },
    managers: {
      async departments(managerId) {
        return (await db.managerTeam.findMany({ where: { managerId } })).map(
          (v) => v.department,
        );
      },
      async assign(managerId, department) {
        await db.managerTeam.upsert({
          where: { managerId_department: { managerId, department } },
          create: { managerId, department },
          update: {},
        });
      },
    },
    audit: {
      async append(value) {
        await db.auditEvent.create({ data: value });
      },
      list: (limit) =>
        db.auditEvent.findMany({ take: limit, orderBy: { timestamp: "desc" } }),
    },
  };
}

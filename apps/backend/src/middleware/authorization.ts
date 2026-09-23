import type { Session } from "@shared/types/session";
import type { UserRole } from "@shared/constants/roles";
import type {
  EmployeeRepository,
  ManagerRepository,
} from "@backend/repositories/contracts";
import { repositories } from "@backend/repositories";
import {
  ForbiddenError,
  NotFoundError,
  UnauthorizedError,
} from "@backend/errors/app-error";
export type Permission =
  | "employee:read"
  | "employee:write"
  | "workforce:read"
  | "content:write"
  | "data:import"
  | "development:review"
  | "audit:read"
  | "team:read";
const permissions: Record<UserRole, readonly Permission[]> = {
  EMPLOYEE: ["employee:read", "employee:write"],
  MANAGER: ["employee:read", "development:review", "team:read"],
  HR: [
    "employee:read",
    "workforce:read",
    "content:write",
    "data:import",
    "development:review",
    "audit:read",
  ],
};
export function authorize(
  session: Session | null,
  permission: Permission,
): asserts session is Session {
  if (!session) throw new UnauthorizedError();
  if (!permissions[session.role]?.includes(permission))
    throw new ForbiddenError();
}
export function actorFor(session: Session) {
  return {
    id: session.actorId ?? session.employeeId ?? "DEMO-" + session.role,
    role: session.role,
  };
}
export async function authorizeEmployee(
  session: Session | null,
  id: string,
  write = false,
  store: {
    employees: EmployeeRepository;
    managers: ManagerRepository;
  } = repositories,
) {
  authorize(session, write ? "employee:write" : "employee:read");
  if (session.role === "EMPLOYEE" && session.employeeId !== id)
    throw new ForbiddenError();
  if (write && session.employeeId !== id) throw new ForbiddenError();
  if (session.role === "MANAGER") {
    const [employee, teams] = await Promise.all([
      store.employees.getById(id),
      store.managers.departments(actorFor(session).id),
    ]);
    if (!employee || !teams.includes(employee.department))
      throw new ForbiddenError("This employee is outside your team.");
  } else if (!(await store.employees.getById(id)))
    throw new NotFoundError("Employee not found.", "EMPLOYEE_NOT_FOUND");
}
export async function authorizeEnrollment(
  session: Session | null,
  enrollmentId: string,
) {
  authorize(session, "development:review");
  const enrollment = await repositories.learning.enrollmentById(enrollmentId);
  if (!enrollment) throw new NotFoundError("Enrollment not found.");
  await authorizeEmployee(session, enrollment.employeeId);
  return enrollment;
}

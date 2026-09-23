import { repositories } from "@backend/repositories";
import { AppError } from "@backend/errors/app-error";
import type { UserRole } from "@shared/constants/roles";
import type { Session } from "@shared/types/session";
export class SessionService {
  static async demo(role: UserRole): Promise<Session> {
    const employee =
      role === "EMPLOYEE"
        ? await repositories.employees.getByExternalId("DEMO-AIDAR")
        : null;
    if (role === "EMPLOYEE" && !employee)
      throw new AppError(
        "DEMO_NOT_READY",
        "Demo data is not initialized. Run npm run db:setup.",
        503,
      );
    return {
      role,
      employeeId: employee?.id ?? null,
      actorId: employee?.id ?? "DEMO-" + role,
      expires: Date.now() + 8 * 3600000,
    };
  }
}

import { repositories } from "@backend/repositories";
import { catalog } from "./catalog.service";
import { NotFoundError, BusinessRuleError } from "@backend/errors/app-error";
import { careerView, simulateTargetRole } from "@domain/career/career";
import { AuditService } from "./audit.service";
export class CareerService {
  static async get(id: string, target?: { role: string; grade: string }) {
    const [employee, data] = await Promise.all([
      repositories.employees.getById(id),
      catalog(),
    ]);
    if (!employee)
      throw new NotFoundError("Employee not found.", "EMPLOYEE_NOT_FOUND");
    return target
      ? simulateTargetRole(employee, target, data.requirements)
      : careerView(employee, data.requirements);
  }
  static async setTarget(id: string, role: string, grade: string) {
    const requirements = await repositories.career.requirements();
    if (!requirements.some((r) => r.role === role && r.grade === grade))
      throw new BusinessRuleError(
        "No requirements exist for this career target.",
      );
    await repositories.transaction(async (tx) => {
      await tx.employees.updateTarget(id, role, grade);
      await tx.recommendations.invalidate(id);
      await AuditService.record(
        {
          action: "CAREER_TARGET_UPDATED",
          entityType: "Employee",
          entityId: id,
          metadata: { role, grade },
        },
        tx.audit,
      );
    });
  }
}

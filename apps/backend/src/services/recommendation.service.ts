import { rankActivities, scoreActivity } from "@ai/recommendation";
import { repositories } from "@backend/repositories";
import { catalog } from "./catalog.service";
import { AuditService } from "./audit.service";
import { NotFoundError } from "@backend/errors/app-error";
import type { Employee } from "@shared/types";
export class RecommendationService {
  static calculate(
    employee: Employee,
    data: Awaited<ReturnType<typeof catalog>>,
  ) {
    return rankActivities(
      employee,
      data.events,
      data.requirements,
      data.skills,
    );
  }
  static candidates(
    employee: Employee,
    data: Awaited<ReturnType<typeof catalog>>,
  ) {
    return data.events.map((event) =>
      scoreActivity(
        employee,
        event,
        data.events,
        data.requirements,
        data.skills,
      ),
    );
  }
  static async generateForEmployee(id: string) {
    const [employee, data] = await Promise.all([
      repositories.employees.getById(id),
      catalog(),
    ]);
    if (!employee)
      throw new NotFoundError("Employee not found.", "EMPLOYEE_NOT_FOUND");
    const recommendations = this.calculate(employee, data);
    await AuditService.record({
      action: "RECOMMENDATION_GENERATED",
      entityType: "Employee",
      entityId: id,
      metadata: {
        activityIds: recommendations.map((r) => r.activity.id),
        scores: recommendations.map((r) => r.score),
      },
    });
    return { employeeId: id, recommendations };
  }
}

import { repositories } from "@backend/repositories";
import { catalog } from "./catalog.service";
import { RecommendationService } from "./recommendation.service";
import { aggregateWorkforce } from "@domain/workforce/analytics";
import { simulateWorkforce } from "@domain/workforce/scenario";
export async function workforce(departments?: string[]) {
  const [employees, data] = await Promise.all([
    repositories.employees.list(departments),
    catalog(),
  ]);
  const counts = Object.fromEntries(
    employees.map((e) => [
      e.id,
      RecommendationService.calculate(e, data).length,
    ]),
  );
  return aggregateWorkforce(employees, data, counts);
}
export class HRService {
  static overview = workforce;
  static async scenario(skillId: string, needed: number, months: number) {
    return simulateWorkforce(
      (await workforce()).employees,
      skillId,
      needed,
      months,
    );
  }
}

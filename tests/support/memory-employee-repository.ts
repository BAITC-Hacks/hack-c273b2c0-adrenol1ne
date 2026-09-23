import type { EmployeeRepository } from "@backend/repositories/contracts";
import type { Employee } from "@shared/types";
export class MemoryEmployeeRepository implements EmployeeRepository {
  private records: Map<string, Employee>;
  constructor(rows: Employee[]) {
    this.records = new Map(rows.map((e) => [e.id, structuredClone(e)]));
  }
  async getById(id: string) {
    const e = this.records.get(id);
    return e ? structuredClone(e) : null;
  }
  async getByExternalId(id: string) {
    return (await this.list()).find((e) => e.employeeId === id) ?? null;
  }
  async list(departments?: string[]) {
    return structuredClone(
      [...this.records.values()].filter(
        (e) => !departments || departments.includes(e.department),
      ),
    );
  }
  async updateTarget(id: string, role: string, grade: string) {
    const e = this.records.get(id);
    if (!e) throw new Error("Missing employee");
    e.targetRole = role;
    e.targetGrade = grade;
  }
  async updateSkill(id: string, skillId: string, level: number) {
    const e = this.records.get(id);
    if (!e) throw new Error("Missing employee");
    const old = e.skills.find((s) => s.skillId === skillId);
    if (old) old.level = level;
    else e.skills.push({ skillId, level });
  }
  async saveImported(e: Omit<Employee, "history">) {
    this.records.set(e.id, {
      ...structuredClone(e),
      history: this.records.get(e.id)?.history ?? [],
    });
  }
}

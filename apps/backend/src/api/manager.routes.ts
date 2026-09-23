import type { ApiContext } from "./context";
import { json, readJson } from "./http";
import {
  authorize,
  authorizeEmployee,
  authorizeEnrollment,
  actorFor,
} from "@backend/middleware/authorization";
import { ManagerService } from "@backend/services/manager.service";
import { EmployeeService } from "@backend/services/employee.service";
import { employeeView } from "./employee.routes";
import { approvalSchema } from "@shared/schemas/requests";
export async function managerRoutes({
  request,
  path,
  session,
}: ApiContext): Promise<Response | null> {
  if (path[0] !== "manager") return null;
  authorize(session, "team:read");
  const managerId = actorFor(session).id;
  if (request.method === "GET") {
    if (path[1] === "team" && path.length === 2)
      return json(await ManagerService.team(managerId));
    if (path[1] === "employees" && path.length === 3) {
      await authorizeEmployee(session, path[2]);
      return json(
        employeeView(await EmployeeService.dashboard(path[2]), session),
      );
    }
  }
  if (
    request.method === "POST" &&
    path[1] === "validate" &&
    path.length === 2
  ) {
    const input = await readJson(request, approvalSchema);
    await authorizeEnrollment(session, input.enrollmentId);
    await ManagerService.review(input);
    return json(await ManagerService.team(managerId));
  }
  return null;
}

import type { ApiContext } from "./context";
import { json, readJson } from "./http";
import {
  authorizeEmployee,
  authorize,
} from "@backend/middleware/authorization";
import { EmployeeService } from "@backend/services/employee.service";
import { RecommendationService } from "@backend/services/recommendation.service";
import { CareerService } from "@backend/services/career.service";
import { ActivityService } from "@backend/services/activity.service";
import {
  getActivityWorkspace,
  updateLearningUnit,
} from "@backend/services/learning";
import {
  getSkillEvidence,
  SkillService,
} from "@backend/services/skill.service";
import { getLearningCatalog } from "@backend/services/development.service";
import { AIExplanationService } from "@backend/services/explanation.service";
import {
  activityStartSchema,
  activityStatusSchema,
  targetSchema,
} from "@shared/schemas/requests";
import { actionSchema } from "@shared/schemas/learning";
import { ForbiddenError, NotFoundError } from "@backend/errors/app-error";
import type { Snapshot } from "@shared/types";
import type { Session } from "@shared/types/session";
export function employeeView(state: Snapshot, session: Session): Snapshot {
  return {
    ...state,
    access: {
      role: session.role,
      canEdit:
        session.role === "EMPLOYEE" && session.employeeId === state.employee.id,
      basePath:
        session.role === "HR"
          ? "/hr/employees/" + state.employee.id
          : session.role === "MANAGER"
            ? "/manager/employees/" + state.employee.id
            : "/employee",
    },
  };
}
export async function employeeRoutes({
  request,
  url,
  path,
  session,
}: ApiContext): Promise<Response | null> {
  const route = path.join("/"),
    get = request.method === "GET";
  if (get && route === "learning-catalog")
    return json(await getLearningCatalog());
  if (get && route === "evidence") {
    const id =
      session.role === "EMPLOYEE"
        ? session.employeeId!
        : (url.searchParams.get("employeeId") ?? "");
    await authorizeEmployee(session, id);
    return json(await getSkillEvidence(id));
  }
  if (get && route === "explanation") {
    const id =
      session.role === "EMPLOYEE"
        ? session.employeeId!
        : (url.searchParams.get("employeeId") ?? "");
    await authorizeEmployee(session, id);
    const state = await EmployeeService.dashboard(id),
      key =
        url.searchParams.get("targetRole") +
        "|" +
        url.searchParams.get("targetGrade");
    const candidate = (
      state.careerViews[key]?.candidates ?? state.activityCandidates
    ).find((c) => c.activity.id === url.searchParams.get("eventId"));
    if (!candidate) throw new NotFoundError("Activity not found.");
    return json(
      await AIExplanationService.explain(
        state.careerViews[key]
          ? {
              ...state.employee,
              targetRole: url.searchParams.get("targetRole")!,
              targetGrade: url.searchParams.get("targetGrade")!,
            }
          : state.employee,
        candidate,
      ),
    );
  }
  let id = session.employeeId ?? "",
    resource = "";
  if (path[0] === "employees" && path.length >= 3) {
    id = path[1];
    resource = path[2];
  } else if (route === "me") resource = "dashboard";
  else if (route === "target") resource = "target";
  else if (route === "activity") resource = "legacy-activity";
  else if (path[0] === "learning") resource = "learning";
  else return null;
  if (!id) throw new ForbiddenError();
  await authorizeEmployee(session, id, !get);
  if (get) {
    if (resource === "dashboard")
      return json(employeeView(await EmployeeService.dashboard(id), session));
    if (resource === "recommendations")
      return json(await RecommendationService.generateForEmployee(id));
    if (resource === "skills") return json(await SkillService.profile(id));
    if (resource === "learning" && path.length === 2)
      return json(await getActivityWorkspace(id, path[1]));
    return null;
  }
  if (request.method !== "POST") return null;
  if (resource === "target") {
    const input = await readJson(request, targetSchema);
    await CareerService.setTarget(id, input.role, input.grade);
    return json(employeeView(await EmployeeService.dashboard(id), session));
  }
  if (resource === "legacy-activity") {
    const input = await readJson(request, activityStatusSchema);
    const result = await ActivityService.record(
      id,
      input.eventId,
      input.status,
    );
    return json({
      ...result,
      state: employeeView(await EmployeeService.dashboard(id), session),
    });
  }
  if (resource === "activities" && path.length === 5) {
    if (path[4] === "start")
      return json(await ActivityService.start(id, path[3]));
    if (path[4] === "complete")
      return json(await ActivityService.complete(id, path[3]));
  }
  if (resource === "learning") {
    authorize(session, "employee:write");
    if (route === "learning/start") {
      const { activityId } = await readJson(request, activityStartSchema);
      return json(await ActivityService.start(id, activityId));
    }
    if (path.length === 3 && path[2] === "unit")
      return json(
        await updateLearningUnit(
          id,
          path[1],
          await readJson(request, actionSchema),
        ),
      );
    if (path.length === 3 && path[2] === "verify")
      return json(await ActivityService.complete(id, path[1]));
  }
  return null;
}

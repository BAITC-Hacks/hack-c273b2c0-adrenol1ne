import { errorResponse } from "./http";
import { sessionRoutes } from "./session.routes";
import { employeeRoutes } from "./employee.routes";
import { hrRoutes } from "./hr.routes";
import { managerRoutes } from "./manager.routes";
import { getSession } from "@backend/middleware/session";
import { isSameOrigin } from "@backend/middleware/request-security";
import { actorFor } from "@backend/middleware/authorization";
import { withActor } from "@backend/middleware/request-context";
import {
  ForbiddenError,
  NotFoundError,
  UnauthorizedError,
} from "@backend/errors/app-error";
export async function handleApi(request: Request): Promise<Response> {
  try {
    const url = new URL(request.url),
      path = url.pathname
        .replace(/^\/api\/?/, "")
        .split("/")
        .filter(Boolean);
    if (!["GET", "HEAD"].includes(request.method) && !isSameOrigin(request))
      throw new ForbiddenError("Invalid request origin");
    const sessionResponse = await sessionRoutes(request, path.join("/"));
    if (sessionResponse) return sessionResponse;
    const session = getSession(request);
    if (!session) throw new UnauthorizedError();
    return await withActor(actorFor(session), async () => {
      const context = { request, url, path, session };
      for (const controller of [employeeRoutes, managerRoutes, hrRoutes]) {
        const response = await controller(context);
        if (response) return response;
      }
      throw new NotFoundError("API route not found.", "ROUTE_NOT_FOUND");
    });
  } catch (error) {
    return errorResponse(error);
  }
}

import { json, readJson } from "./http";
import { loginSchema } from "@shared/schemas/requests";
import { ROLE_HOME } from "@shared/constants/roles";
import { signSession, getSession } from "@backend/middleware/session";
import { SessionService } from "@backend/services/session.service";
import { AppError, UnauthorizedError } from "@backend/errors/app-error";
export async function sessionRoutes(
  request: Request,
  path: string,
): Promise<Response | null> {
  if (path === "session" && request.method === "GET") {
    const session = getSession(request);
    if (!session) throw new UnauthorizedError();
    return json(session);
  }
  if (request.method !== "POST") return null;
  if (path === "logout") {
    const response = json({ ok: true });
    response.headers.set(
      "Set-Cookie",
      "talentos_session=; Path=/; HttpOnly; SameSite=Strict; Max-Age=0",
    );
    return response;
  }
  if (path !== "login") return null;
  if (process.env.DEMO_LOGIN_ENABLED !== "true")
    throw new AppError(
      "DEMO_DISABLED",
      "Demo login is disabled. Configure an identity provider for production.",
      403,
    );
  const { role } = await readJson(request, loginSchema);
  const session = await SessionService.demo(role);
  const response = json({ redirect: ROLE_HOME[role] });
  response.headers.set(
    "Set-Cookie",
    "talentos_session=" +
      signSession(session) +
      "; Path=/; HttpOnly; SameSite=Strict; Max-Age=28800" +
      (new URL(request.url).protocol === "https:" ? "; Secure" : ""),
  );
  return response;
}

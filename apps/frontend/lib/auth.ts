import { redirect } from "next/navigation";
import { serverApi } from "./server-api";
import type { Session } from "@shared/types/session";
import { ROLE_HOME } from "@shared/constants/roles";
import { ApiClientError } from "./api-client";
export async function requireSession(role?: Session["role"]): Promise<Session> {
  let session: Session;
  try {
    session = await serverApi<Session>("/api/session");
  } catch (e) {
    if (e instanceof ApiClientError && e.status === 401) redirect("/");
    throw e;
  }
  if (role && session.role !== role) redirect(ROLE_HOME[session.role]);
  return session;
}

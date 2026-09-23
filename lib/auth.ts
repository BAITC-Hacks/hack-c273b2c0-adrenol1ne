import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
export type Session = {
  role: "EMPLOYEE" | "HR";
  employeeId: string | null;
  expires: number;
};
const globalAuth = globalThis as unknown as { demoSecret?: string };
const secret = () => {
  const value = process.env.SESSION_SECRET;
  if (value && value.length >= 32) return value;
  if (process.env.NODE_ENV === "production")
    throw new Error("SESSION_SECRET must contain at least 32 characters.");
  return (globalAuth.demoSecret ??= randomBytes(32).toString("hex"));
};
export function signSession(session: Session) {
  const payload = Buffer.from(JSON.stringify(session)).toString("base64url");
  return `${payload}.${createHmac("sha256", secret()).update(payload).digest("base64url")}`;
}
export function verifySession(token: string | undefined): Session | null {
  if (!token) return null;
  try {
    const [payload, signature, ...rest] = token.split(".");
    if (!payload || !signature || rest.length) return null;
    const expected = createHmac("sha256", secret()).update(payload).digest();
    const actual = Buffer.from(signature, "base64url");
    if (actual.length !== expected.length || !timingSafeEqual(actual, expected))
      return null;
    const s = JSON.parse(Buffer.from(payload, "base64url").toString());
    return ["EMPLOYEE", "HR"].includes(s.role) &&
      typeof s.expires === "number" &&
      s.expires > Date.now() &&
      (s.role === "HR" || typeof s.employeeId === "string")
      ? s
      : null;
  } catch {
    return null;
  }
}
export async function getSession() {
  return verifySession((await cookies()).get("talentos_session")?.value);
}
export async function requireSession(role?: Session["role"]) {
  const s = await getSession();
  if (!s) redirect("/");
  if (role && s.role !== role) redirect(s.role === "HR" ? "/hr" : "/employee");
  return s;
}

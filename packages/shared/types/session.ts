import type { UserRole } from "@shared/constants/roles";
export type Session = {
  actorId?: string;
  role: UserRole;
  employeeId: string | null;
  expires: number;
};
export type Actor = { id: string; role: UserRole | "SYSTEM" };
export const SYSTEM_ACTOR: Actor = { id: "system", role: "SYSTEM" };

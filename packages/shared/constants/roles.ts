export const USER_ROLES = ["EMPLOYEE", "MANAGER", "HR"] as const;
export type UserRole = (typeof USER_ROLES)[number];
export const ROLE_HOME: Record<UserRole, string> = {
  EMPLOYEE: "/employee",
  MANAGER: "/manager",
  HR: "/hr",
};

/**
 * Roller och rättigheter. All behörighetskontroll går genom can(), så att skillnader
 * mellan roller införs här och ingen annanstans (PLAN.md §5).
 */

export const ROLES = ["admin", "member"] as const;
export type Role = (typeof ROLES)[number];

export const ROLE_LABELS: Record<Role, string> = {
  admin: "Administratör",
  member: "Medlem",
};

export const PERMISSIONS = [
  "dashboard:read",
  "portfolio:read",
  "portfolio:write",
  "watchlist:read",
  "watchlist:write",
  "analyses:read",
  "analyses:write",
  "tools:use",
  "reports:read",
  "reports:write",
  "settings:benchmarks",
  "users:manage",
] as const;
export type Permission = (typeof PERMISSIONS)[number];

const ALL: readonly Permission[] = PERMISSIONS;

/** Samma rättigheter för båda rollerna tills utskottet bestämt annat. */
const MATRIX: Record<Role, readonly Permission[]> = {
  admin: ALL,
  member: ALL,
};

export function can(user: { role: Role } | null | undefined, permission: Permission): boolean {
  return !!user && MATRIX[user.role].includes(permission);
}

export function isRole(value: unknown): value is Role {
  return typeof value === "string" && (ROLES as readonly string[]).includes(value);
}

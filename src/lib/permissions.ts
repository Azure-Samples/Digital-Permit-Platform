// ─────────────────────────────────────────────────────────────
// RBAC / permissions helper
// ─────────────────────────────────────────────────────────────
import type { SystemRole } from "@prisma/client";
import { getServerSession } from "next-auth";
import { authOptions } from "./auth";

type Permission =
  | "application:create"
  | "application:view_own"
  | "application:view_team"
  | "application:view_all"
  | "application:assign"
  | "application:review"
  | "application:decide"
  | "application:delete"
  | "module:view"
  | "module:edit"
  | "module:create"
  | "module:toggle"
  | "user:view"
  | "user:manage"
  | "team:manage"
  | "audit:view"
  | "report:view"
  | "admin:access";

const ROLE_PERMISSIONS: Record<SystemRole, Permission[]> = {
  APPLICANT: [
    "application:create",
    "application:view_own",
  ],
  REVIEWER: [
    "application:view_team",
    "application:review",
    "module:view",
    "report:view",
  ],
  MANAGER: [
    "application:view_all",
    "application:assign",
    "application:review",
    "application:decide",
    "module:view",
    "module:edit",
    "report:view",
    "audit:view",
    "team:manage",
  ],
  ADMIN: [
    "application:view_all",
    "application:assign",
    "application:review",
    "application:decide",
    "application:delete",
    "module:view",
    "module:edit",
    "module:create",
    "module:toggle",
    "user:view",
    "user:manage",
    "team:manage",
    "audit:view",
    "report:view",
    "admin:access",
  ],
};

export function hasPermission(role: SystemRole, permission: Permission): boolean {
  return ROLE_PERMISSIONS[role]?.includes(permission) ?? false;
}

export function hasAnyPermission(role: SystemRole, permissions: Permission[]): boolean {
  return permissions.some((p) => hasPermission(role, p));
}

export async function requirePermission(permission: Permission) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    throw new Error("Unauthorized");
  }
  if (!hasPermission(session.user.role, permission)) {
    throw new Error("Forbidden");
  }
  return session;
}

export async function requireRole(...roles: SystemRole[]) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    throw new Error("Unauthorized");
  }
  if (!roles.includes(session.user.role)) {
    throw new Error("Forbidden");
  }
  return session;
}

export async function getSessionOrNull() {
  return getServerSession(authOptions);
}

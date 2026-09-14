export const ROLES = ["member", "admin", "owner"] as const;
export type Role = (typeof ROLES)[number];

export type Permission =
  | "organization:read"
  | "organization:update"
  | "member:read"
  | "member:invite"
  | "member:change-role"
  | "member:remove"
  | "project:read"
  | "project:create"
  | "project:update"
  | "project:delete"
  | "task:read"
  | "task:create"
  | "task:update"
  | "task:delete"
  | "comment:create"
  | "comment:update-own"
  | "comment:delete-own"
  | "attachment:create"
  | "attachment:delete-own"
  | "audit:read"
  | "export:create";

const roleRank: Record<Role, number> = {
  member: 0,
  admin: 1,
  owner: 2,
};

const permissionMatrix: Record<Permission, readonly Role[]> = {
  "organization:read": ROLES,
  "organization:update": ["owner"],
  "member:read": ROLES,
  "member:invite": ["admin", "owner"],
  "member:change-role": ["owner"],
  "member:remove": ["admin", "owner"],
  "project:read": ROLES,
  "project:create": ["admin", "owner"],
  "project:update": ["admin", "owner"],
  "project:delete": ["admin", "owner"],
  "task:read": ROLES,
  "task:create": ROLES,
  "task:update": ROLES,
  "task:delete": ["admin", "owner"],
  "comment:create": ROLES,
  "comment:update-own": ROLES,
  "comment:delete-own": ROLES,
  "attachment:create": ROLES,
  "attachment:delete-own": ROLES,
  "audit:read": ["admin", "owner"],
  "export:create": ["admin", "owner"],
};

export function isRole(value: unknown): value is Role {
  return typeof value === "string" && ROLES.includes(value as Role);
}

export function hasMinimumRole(role: Role, minimum: Role): boolean {
  return roleRank[role] >= roleRank[minimum];
}

export function can(role: Role, permission: Permission): boolean {
  return permissionMatrix[permission].includes(role);
}

export function canChangeMemberRole(
  actorRole: Role,
  targetRole: Role,
  nextRole: Role,
  isSelf: boolean,
): boolean {
  return (
    actorRole === "owner" &&
    targetRole !== "owner" &&
    nextRole !== "owner" &&
    !isSelf
  );
}

export function canRemoveMember(
  actorRole: Role,
  targetRole: Role,
  isSelf: boolean,
): boolean {
  if (!can(actorRole, "member:remove") || targetRole === "owner" || isSelf) {
    return false;
  }
  return actorRole === "owner" || targetRole === "member";
}

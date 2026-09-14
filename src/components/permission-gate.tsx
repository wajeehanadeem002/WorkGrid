import type { ReactNode } from "react";
import { can, type Permission, type Role } from "@/lib/auth/permissions";

export function PermissionGate({
  role,
  permission,
  children,
}: {
  role: Role;
  permission: Permission;
  children: ReactNode;
}) {
  return can(role, permission) ? children : null;
}

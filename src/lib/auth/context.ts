import { can, type Permission, type Role } from "./permissions";
import { AppError } from "@/lib/security/errors";

export interface OrganizationSummary {
  id: string;
  name: string;
  slug: string;
}

export interface MembershipSummary {
  id: string;
  userId: string;
  role: Role;
}

export interface OrganizationContext {
  userId: string;
  organization: OrganizationSummary;
  membership: MembershipSummary;
}

export type FindOrganizationContext = (
  userId: string,
  slug: string,
) => Promise<{
  organization: OrganizationSummary;
  membership: MembershipSummary;
} | null>;

export async function loadOrganizationContext(
  userId: string | null,
  slug: string,
  findContext: FindOrganizationContext,
): Promise<OrganizationContext> {
  if (!userId) throw new AppError("UNAUTHENTICATED", "Sign in to continue.");
  const result = await findContext(userId, slug);
  if (!result) throw new AppError("NOT_FOUND", "Organization not found.");
  return { userId, ...result };
}

export function requirePermission(
  context: OrganizationContext,
  permission: Permission,
): OrganizationContext {
  if (!can(context.membership.role, permission)) {
    throw new AppError(
      "FORBIDDEN",
      "You do not have permission to perform this action.",
    );
  }
  return context;
}

export function assertOrganizationResource(
  context: OrganizationContext,
  resourceOrganizationId: string,
): void {
  if (resourceOrganizationId !== context.organization.id) {
    throw new AppError("NOT_FOUND", "Resource not found.");
  }
}

import type { WorkGridClient } from "@/lib/supabase/server";
import type {
  Organization,
  OrganizationInvitation,
  OrganizationMember,
  PageResult,
} from "@/types/domain";
import type { Pagination } from "@/lib/security/pagination";
import type { Role } from "@/lib/auth/permissions";
import { AppError } from "@/lib/security/errors";
import { assertData, mapDataError } from "./errors";

export interface OrganizationListItem extends Organization {
  role: Role;
}

export async function listOrganizations(
  client: WorkGridClient,
  userId: string,
): Promise<OrganizationListItem[]> {
  const { data: memberships, error: membershipError } = await client
    .from("organization_members")
    .select("organization_id, role")
    .eq("user_id", userId)
    .is("removed_at", null);
  if (membershipError) throw mapDataError(membershipError);
  if (!memberships?.length) return [];

  const roleByOrganization = new Map(
    memberships.map((membership) => [
      membership.organization_id,
      membership.role,
    ]),
  );
  const { data, error } = await client
    .from("organizations")
    .select("*")
    .in("id", [...roleByOrganization.keys()])
    .order("name", { ascending: true });
  if (error) throw mapDataError(error);
  return (data ?? []).map((organization) => ({
    ...organization,
    role: roleByOrganization.get(organization.id) ?? "member",
  }));
}

export async function findOrganizationContext(
  client: WorkGridClient,
  userId: string,
  slug: string,
): Promise<{
  organization: Pick<Organization, "id" | "name" | "slug">;
  membership: { id: string; userId: string; role: Role };
} | null> {
  const { data: organization, error: organizationError } = await client
    .from("organizations")
    .select("id, name, slug")
    .eq("slug", slug)
    .maybeSingle();
  if (organizationError) throw mapDataError(organizationError);
  if (!organization) return null;

  const { data: membership, error: membershipError } = await client
    .from("organization_members")
    .select("id, user_id, role")
    .eq("organization_id", organization.id)
    .eq("user_id", userId)
    .is("removed_at", null)
    .maybeSingle();
  if (membershipError) throw mapDataError(membershipError);
  if (!membership) return null;

  return {
    organization,
    membership: {
      id: membership.id,
      userId: membership.user_id,
      role: membership.role,
    },
  };
}

export async function findOrganizationContextById(
  client: WorkGridClient,
  userId: string,
  organizationId: string,
) {
  const { data: organization, error } = await client
    .from("organizations")
    .select("id, name, slug")
    .eq("id", organizationId)
    .maybeSingle();
  if (error) throw mapDataError(error);
  if (!organization) return null;
  return findOrganizationContext(client, userId, organization.slug);
}

export async function listOrganizationMembers(
  client: WorkGridClient,
  organizationId: string,
): Promise<OrganizationMember[]> {
  const { data, error } = await client
    .from("organization_members")
    .select("*")
    .eq("organization_id", organizationId)
    .is("removed_at", null)
    .order("role", { ascending: false })
    .order("created_at", { ascending: true });
  if (error) throw mapDataError(error);
  return data ?? [];
}

export async function listActiveInvitations(
  client: WorkGridClient,
  organizationId: string,
): Promise<OrganizationInvitation[]> {
  const { data, error } = await client
    .from("organization_invitations")
    .select("*")
    .eq("organization_id", organizationId)
    .is("accepted_at", null)
    .gt("expires_at", new Date().toISOString())
    .order("created_at", { ascending: false });
  if (error) throw mapDataError(error);
  return data ?? [];
}

export async function listOrganizationMembersPage(
  client: WorkGridClient,
  organizationId: string,
  pagination: Pagination,
): Promise<PageResult<OrganizationMember>> {
  const { data, error, count } = await client
    .from("organization_members")
    .select("*", { count: "exact" })
    .eq("organization_id", organizationId)
    .is("removed_at", null)
    .order("role", { ascending: false })
    .order("created_at", { ascending: true })
    .range(pagination.from, pagination.to);
  if (error) throw mapDataError(error);
  return {
    items: data ?? [],
    total: count ?? 0,
    page: pagination.page,
    pageSize: pagination.pageSize,
  };
}

export async function listActiveInvitationsPage(
  client: WorkGridClient,
  organizationId: string,
  pagination: Pagination,
): Promise<PageResult<OrganizationInvitation>> {
  const { data, error, count } = await client
    .from("organization_invitations")
    .select("*", { count: "exact" })
    .eq("organization_id", organizationId)
    .is("accepted_at", null)
    .gt("expires_at", new Date().toISOString())
    .order("created_at", { ascending: false })
    .range(pagination.from, pagination.to);
  if (error) throw mapDataError(error);
  return {
    items: data ?? [],
    total: count ?? 0,
    page: pagination.page,
    pageSize: pagination.pageSize,
  };
}

export async function getMembership(
  client: WorkGridClient,
  organizationId: string,
  membershipId: string,
): Promise<OrganizationMember> {
  const { data, error } = await client
    .from("organization_members")
    .select("*")
    .eq("organization_id", organizationId)
    .eq("id", membershipId)
    .is("removed_at", null)
    .maybeSingle();
  if (error) throw mapDataError(error);
  if (!data) throw new AppError("NOT_FOUND", "Member not found.");
  return data;
}

export async function getMembershipByUserId(
  client: WorkGridClient,
  organizationId: string,
  userId: string,
): Promise<OrganizationMember> {
  const { data, error } = await client
    .from("organization_members")
    .select("*")
    .eq("organization_id", organizationId)
    .eq("user_id", userId)
    .is("removed_at", null)
    .maybeSingle();
  if (error) throw mapDataError(error);
  if (!data) throw new AppError("NOT_FOUND", "Assignee not found.");
  return data;
}

export async function updateOrganizationName(
  client: WorkGridClient,
  organizationId: string,
  name: string,
) {
  const { data, error } = await client
    .from("organizations")
    .update({ name })
    .eq("id", organizationId)
    .select()
    .single();
  return assertData(data, error);
}

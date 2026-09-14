import type { WorkGridClient } from "@/lib/supabase/server";
import type { PageResult, Project } from "@/types/domain";
import type { Pagination } from "@/lib/security/pagination";
import type { ProjectFilters, ProjectInput } from "@/features/shared/schemas";
import { AppError } from "@/lib/security/errors";
import { requireResourceId } from "@/lib/security/identifiers";
import { mapDataError } from "./errors";

function likePattern(value: string): string {
  return `%${value.replace(/[\\%_]/g, (character) => `\\${character}`)}%`;
}

export async function listProjects(
  client: WorkGridClient,
  organizationId: string,
  filters: ProjectFilters,
  pagination: Pagination,
): Promise<PageResult<Project>> {
  let query = client
    .from("projects")
    .select("*", { count: "exact" })
    .eq("organization_id", organizationId);

  if (filters.query) query = query.ilike("name", likePattern(filters.query));
  if (filters.status !== "ALL") query = query.eq("status", filters.status);

  const [column, ascending] =
    filters.sort === "name_asc"
      ? (["name", true] as const)
      : filters.sort === "name_desc"
        ? (["name", false] as const)
        : filters.sort === "updated_asc"
          ? (["updated_at", true] as const)
          : (["updated_at", false] as const);

  const { data, error, count } = await query
    .order(column, { ascending })
    .order("id", { ascending })
    .range(pagination.from, pagination.to);
  if (error) throw mapDataError(error);
  return {
    items: data ?? [],
    total: count ?? 0,
    page: pagination.page,
    pageSize: pagination.pageSize,
  };
}

export async function getProject(
  client: WorkGridClient,
  organizationId: string,
  projectId: string,
): Promise<Project> {
  const id = requireResourceId(projectId);
  const { data, error } = await client
    .from("projects")
    .select("*")
    .eq("organization_id", organizationId)
    .eq("id", id)
    .maybeSingle();
  if (error) throw mapDataError(error);
  if (!data) throw new AppError("NOT_FOUND", "Project not found.");
  return data;
}

export async function listProjectsByIds(
  client: WorkGridClient,
  organizationId: string,
  projectIds: string[],
): Promise<Project[]> {
  const uniqueIds = [...new Set(projectIds)];
  if (!uniqueIds.length) return [];
  const { data, error } = await client
    .from("projects")
    .select("*")
    .eq("organization_id", organizationId)
    .in("id", uniqueIds);
  if (error) throw mapDataError(error);
  return data ?? [];
}

export async function createProject(
  client: WorkGridClient,
  organizationId: string,
  userId: string,
  input: ProjectInput,
): Promise<Project> {
  const { data, error } = await client
    .from("projects")
    .insert({ organization_id: organizationId, created_by: userId, ...input })
    .select()
    .single();
  if (error) throw mapDataError(error);
  return data;
}

export async function updateProject(
  client: WorkGridClient,
  organizationId: string,
  projectId: string,
  input: ProjectInput,
): Promise<Project> {
  const { data, error } = await client
    .from("projects")
    .update(input)
    .eq("organization_id", organizationId)
    .eq("id", projectId)
    .select()
    .maybeSingle();
  if (error) throw mapDataError(error);
  if (!data) throw new AppError("NOT_FOUND", "Project not found.");
  return data;
}

export async function deleteProject(
  client: WorkGridClient,
  organizationId: string,
  projectId: string,
) {
  const { error, count } = await client
    .from("projects")
    .delete({ count: "exact" })
    .eq("organization_id", organizationId)
    .eq("id", projectId);
  if (error) throw mapDataError(error);
  if (!count) throw new AppError("NOT_FOUND", "Project not found.");
}

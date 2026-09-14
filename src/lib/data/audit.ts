import type { Pagination } from "@/lib/security/pagination";
import type { WorkGridClient } from "@/lib/supabase/server";
import type { AuditLog, PageResult } from "@/types/domain";
import { mapDataError } from "./errors";

export async function listAuditLogs(
  client: WorkGridClient,
  organizationId: string,
  pagination: Pagination,
): Promise<PageResult<AuditLog>> {
  const { data, error, count } = await client
    .from("audit_logs")
    .select("*", { count: "exact" })
    .eq("organization_id", organizationId)
    .order("created_at", { ascending: false })
    .order("id", { ascending: false })
    .range(pagination.from, pagination.to);
  if (error) throw mapDataError(error);
  return {
    items: data ?? [],
    total: count ?? 0,
    page: pagination.page,
    pageSize: pagination.pageSize,
  };
}

export async function listRecentAuditLogs(
  client: WorkGridClient,
  organizationId: string,
  limit = 8,
): Promise<AuditLog[]> {
  const { data, error } = await client
    .from("audit_logs")
    .select("*")
    .eq("organization_id", organizationId)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw mapDataError(error);
  return data ?? [];
}

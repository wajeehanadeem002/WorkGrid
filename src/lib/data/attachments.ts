import type { WorkGridClient } from "@/lib/supabase/server";
import type { Attachment, PageResult } from "@/types/domain";
import type { Pagination } from "@/lib/security/pagination";
import { AppError } from "@/lib/security/errors";
import { requireResourceId } from "@/lib/security/identifiers";
import { mapDataError } from "./errors";

export async function listTaskAttachments(
  client: WorkGridClient,
  organizationId: string,
  taskId: string,
  pagination: Pagination,
): Promise<PageResult<Attachment>> {
  const { data, error, count } = await client
    .from("attachments")
    .select("*", { count: "exact" })
    .eq("organization_id", organizationId)
    .eq("task_id", taskId)
    .eq("upload_status", "ready")
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

export async function getAttachment(
  client: WorkGridClient,
  organizationId: string,
  attachmentId: string,
): Promise<Attachment> {
  const id = requireResourceId(attachmentId);
  const { data, error } = await client
    .from("attachments")
    .select("*")
    .eq("organization_id", organizationId)
    .eq("id", id)
    .eq("upload_status", "ready")
    .maybeSingle();
  if (error) throw mapDataError(error);
  if (!data) throw new AppError("NOT_FOUND", "Attachment not found.");
  return data;
}

import type { WorkGridClient } from "@/lib/supabase/server";
import type { Comment, PageResult } from "@/types/domain";
import type { Pagination } from "@/lib/security/pagination";
import { AppError } from "@/lib/security/errors";
import { mapDataError } from "./errors";

export async function listTaskComments(
  client: WorkGridClient,
  organizationId: string,
  taskId: string,
  pagination: Pagination,
): Promise<PageResult<Comment>> {
  const { data, error, count } = await client
    .from("comments")
    .select("*", { count: "exact" })
    .eq("organization_id", organizationId)
    .eq("task_id", taskId)
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

export async function createComment(
  client: WorkGridClient,
  organizationId: string,
  taskId: string,
  userId: string,
  body: string,
) {
  const { data, error } = await client
    .from("comments")
    .insert({
      organization_id: organizationId,
      task_id: taskId,
      author_id: userId,
      body,
    })
    .select()
    .single();
  if (error) throw mapDataError(error);
  return data;
}

export async function deleteComment(
  client: WorkGridClient,
  organizationId: string,
  commentId: string,
) {
  const { error, count } = await client
    .from("comments")
    .delete({ count: "exact" })
    .eq("organization_id", organizationId)
    .eq("id", commentId);
  if (error) throw mapDataError(error);
  if (!count) throw new AppError("NOT_FOUND", "Comment not found.");
}

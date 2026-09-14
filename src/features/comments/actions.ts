"use server";

import { revalidatePath } from "next/cache";
import { actionResult, parseActionInput } from "@/lib/actions";
import { requirePermission } from "@/lib/auth/context";
import { resolveOrganizationContext } from "@/lib/auth/server-context";
import { deleteComment } from "@/lib/data/comments";
import { getTask } from "@/lib/data/tasks";
import { mapDataError } from "@/lib/data/errors";
import { requireRpcResult } from "@/lib/data/rpc";
import { AppError, type ActionState } from "@/lib/security/errors";
import { commentSchema, uuidSchema } from "@/features/shared/schemas";
import { createAuthenticatedContext } from "@/lib/supabase/server";

export async function createCommentAction(
  slug: string,
  taskId: string,
  _state: ActionState,
  formData: FormData,
): Promise<ActionState> {
  void _state;
  const authenticated = await createAuthenticatedContext();
  return actionResult(async () => {
    const id = uuidSchema.parse(taskId);
    const input = parseActionInput(commentSchema, formData);
    const { context, client } = await resolveOrganizationContext(
      slug,
      authenticated,
    );
    requirePermission(context, "comment:create");
    await getTask(client, context.organization.id, id);
    const { data, error } = await client.rpc("create_comment", {
      target_organization_id: context.organization.id,
      target_task_id: id,
      comment_body: input.body,
    });
    if (error) throw mapDataError(error);
    requireRpcResult(data);
    revalidatePath(`/app/${slug}/tasks/${id}`);
    return { status: "success", message: "Comment added." };
  });
}

export async function deleteCommentAction(
  slug: string,
  taskId: string,
  commentId: string,
  _state: ActionState,
  _formData: FormData,
): Promise<ActionState> {
  void _state;
  void _formData;
  const authenticated = await createAuthenticatedContext();
  return actionResult(async () => {
    const task = uuidSchema.parse(taskId);
    const comment = uuidSchema.parse(commentId);
    const { context, client } = await resolveOrganizationContext(
      slug,
      authenticated,
    );
    await getTask(client, context.organization.id, task);
    const { data, error } = await client
      .from("comments")
      .select("author_id")
      .eq("organization_id", context.organization.id)
      .eq("task_id", task)
      .eq("id", comment)
      .maybeSingle();
    if (error) throw mapDataError(error);
    if (!data) throw new AppError("NOT_FOUND", "Comment not found.");
    if (
      data.author_id !== context.userId &&
      context.membership.role === "member"
    ) {
      throw new AppError("FORBIDDEN", "You cannot delete this comment.");
    }
    await deleteComment(client, context.organization.id, comment);
    revalidatePath(`/app/${slug}/tasks/${task}`);
    return { status: "success", message: "Comment deleted." };
  });
}

"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { actionResult, parseActionInput } from "@/lib/actions";
import { requirePermission } from "@/lib/auth/context";
import { resolveOrganizationContext } from "@/lib/auth/server-context";
import { getProject } from "@/lib/data/projects";
import { getMembershipByUserId } from "@/lib/data/organizations";
import { createTask, deleteTask, getTask, updateTask } from "@/lib/data/tasks";
import { AppError, type ActionState } from "@/lib/security/errors";
import { taskSchema, uuidSchema } from "@/features/shared/schemas";
import { createAuthenticatedContext } from "@/lib/supabase/server";

export async function createTaskAction(
  slug: string,
  _state: ActionState,
  formData: FormData,
): Promise<ActionState> {
  void _state;
  const authenticated = await createAuthenticatedContext();
  let destination: string | null = null;
  const result = await actionResult(async () => {
    const input = parseActionInput(taskSchema, formData);
    const { context, client } = await resolveOrganizationContext(
      slug,
      authenticated,
    );
    requirePermission(context, "task:create");
    await getProject(client, context.organization.id, input.projectId);
    if (input.assigneeId) {
      await getMembershipByUserId(
        client,
        context.organization.id,
        input.assigneeId,
      );
    }
    const task = await createTask(
      client,
      context.organization.id,
      context.userId,
      input,
    );
    destination = `/app/${slug}/tasks/${task.id}?created=1`;
    return { status: "success", message: "Task created." };
  });
  if (destination) redirect(destination);
  return result;
}

export async function updateTaskAction(
  slug: string,
  taskId: string,
  _state: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const authenticated = await createAuthenticatedContext();
  return actionResult(async () => {
    const id = uuidSchema.parse(taskId);
    const input = parseActionInput(taskSchema, formData);
    const { context, client } = await resolveOrganizationContext(
      slug,
      authenticated,
    );
    requirePermission(context, "task:update");
    const existing = await getTask(client, context.organization.id, id);
    if (existing.project_id !== input.projectId) {
      throw new AppError(
        "VALIDATION",
        "Moving a task between projects is not supported.",
      );
    }
    if (input.assigneeId) {
      await getMembershipByUserId(
        client,
        context.organization.id,
        input.assigneeId,
      );
    }
    await updateTask(client, context.organization.id, id, input);
    revalidatePath(`/app/${slug}/tasks`);
    revalidatePath(`/app/${slug}/tasks/${id}`);
    return { status: "success", message: "Task saved." };
  });
}

export async function deleteTaskAction(
  slug: string,
  taskId: string,
  _state: ActionState,
  _formData: FormData,
): Promise<ActionState> {
  void _state;
  void _formData;
  const authenticated = await createAuthenticatedContext();
  let destination: string | null = null;
  const result = await actionResult(async () => {
    const id = uuidSchema.parse(taskId);
    const { context, client } = await resolveOrganizationContext(
      slug,
      authenticated,
    );
    requirePermission(context, "task:delete");
    await getTask(client, context.organization.id, id);
    await deleteTask(client, context.organization.id, id);
    revalidatePath(`/app/${slug}/tasks`);
    destination = `/app/${slug}/tasks?deleted=1`;
    return { status: "success", message: "Task deleted." };
  });
  if (destination) redirect(destination);
  return result;
}

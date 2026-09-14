"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { actionResult, parseActionInput } from "@/lib/actions";
import { requirePermission } from "@/lib/auth/context";
import { resolveOrganizationContext } from "@/lib/auth/server-context";
import {
  createProject,
  deleteProject,
  getProject,
  updateProject,
} from "@/lib/data/projects";
import { type ActionState } from "@/lib/security/errors";
import { projectSchema, uuidSchema } from "@/features/shared/schemas";
import { createAuthenticatedContext } from "@/lib/supabase/server";

export async function createProjectAction(
  slug: string,
  _state: ActionState,
  formData: FormData,
): Promise<ActionState> {
  void _state;
  const authenticated = await createAuthenticatedContext();
  let destination: string | null = null;
  const result = await actionResult(async () => {
    const input = parseActionInput(projectSchema, formData);
    const { context, client } = await resolveOrganizationContext(
      slug,
      authenticated,
    );
    requirePermission(context, "project:create");
    const project = await createProject(
      client,
      context.organization.id,
      context.userId,
      input,
    );
    destination = `/app/${slug}/projects/${project.id}?created=1`;
    return { status: "success", message: "Project created." };
  });
  if (destination) redirect(destination);
  return result;
}

export async function updateProjectAction(
  slug: string,
  projectId: string,
  _state: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const authenticated = await createAuthenticatedContext();
  return actionResult(async () => {
    const id = uuidSchema.parse(projectId);
    const input = parseActionInput(projectSchema, formData);
    const { context, client } = await resolveOrganizationContext(
      slug,
      authenticated,
    );
    requirePermission(context, "project:update");
    await getProject(client, context.organization.id, id);
    await updateProject(client, context.organization.id, id, input);
    revalidatePath(`/app/${slug}/projects`);
    revalidatePath(`/app/${slug}/projects/${id}`);
    return { status: "success", message: "Project saved." };
  });
}

export async function deleteProjectAction(
  slug: string,
  projectId: string,
  _state: ActionState,
  _formData: FormData,
): Promise<ActionState> {
  void _state;
  void _formData;
  const authenticated = await createAuthenticatedContext();
  let destination: string | null = null;
  const result = await actionResult(async () => {
    const id = uuidSchema.parse(projectId);
    const { context, client } = await resolveOrganizationContext(
      slug,
      authenticated,
    );
    requirePermission(context, "project:delete");
    await getProject(client, context.organization.id, id);
    await deleteProject(client, context.organization.id, id);
    revalidatePath(`/app/${slug}/projects`);
    destination = `/app/${slug}/projects?deleted=1`;
    return { status: "success", message: "Project deleted." };
  });
  if (destination) redirect(destination);
  return result;
}

import type { TaskFilters, TaskInput } from "@/features/shared/schemas";
import type { Pagination } from "@/lib/security/pagination";
import { AppError } from "@/lib/security/errors";
import { requireResourceId } from "@/lib/security/identifiers";
import type { WorkGridClient } from "@/lib/supabase/server";
import type { PageResult, Task } from "@/types/domain";
import { mapDataError } from "./errors";

function likePattern(value: string): string {
  return `%${value.replace(/[\\%_]/g, (character) => `\\${character}`)}%`;
}

export async function listTasks(
  client: WorkGridClient,
  organizationId: string,
  filters: TaskFilters,
  pagination: Pagination,
): Promise<PageResult<Task>> {
  let query = client
    .from("tasks")
    .select("*", { count: "exact" })
    .eq("organization_id", organizationId);
  if (filters.query) query = query.ilike("title", likePattern(filters.query));
  if (filters.status !== "ALL") query = query.eq("status", filters.status);
  if (filters.priority !== "ALL")
    query = query.eq("priority", filters.priority);
  if (filters.assignee !== "ALL") {
    query =
      filters.assignee === "UNASSIGNED"
        ? query.is("assignee_id", null)
        : query.eq("assignee_id", filters.assignee);
  }
  if (filters.project !== "ALL")
    query = query.eq("project_id", filters.project);

  const today = new Date().toISOString().slice(0, 10);
  if (filters.due === "OVERDUE")
    query = query.lt("due_date", today).neq("status", "DONE");
  if (filters.due === "UPCOMING")
    query = query.gte("due_date", today).neq("status", "DONE");
  if (filters.due === "NONE") query = query.is("due_date", null);

  if (filters.sort === "due_asc") {
    query = query.order("due_date", { ascending: true, nullsFirst: false });
  } else if (filters.sort === "priority_desc") {
    query = query.order("priority", { ascending: false });
  } else if (filters.sort === "updated_asc") {
    query = query.order("updated_at", { ascending: true });
  } else {
    query = query.order("updated_at", { ascending: false });
  }

  const { data, error, count } = await query
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

export async function listProjectTasks(
  client: WorkGridClient,
  organizationId: string,
  projectId: string,
  limit = 10,
) {
  const { data, error } = await client
    .from("tasks")
    .select("*")
    .eq("organization_id", organizationId)
    .eq("project_id", projectId)
    .order("updated_at", { ascending: false })
    .limit(limit);
  if (error) throw mapDataError(error);
  return data ?? [];
}

export async function getTask(
  client: WorkGridClient,
  organizationId: string,
  taskId: string,
): Promise<Task> {
  const id = requireResourceId(taskId);
  const { data, error } = await client
    .from("tasks")
    .select("*")
    .eq("organization_id", organizationId)
    .eq("id", id)
    .maybeSingle();
  if (error) throw mapDataError(error);
  if (!data) throw new AppError("NOT_FOUND", "Task not found.");
  return data;
}

export async function createTask(
  client: WorkGridClient,
  organizationId: string,
  userId: string,
  input: TaskInput,
): Promise<Task> {
  const { projectId, assigneeId, dueDate, ...task } = input;
  const { data, error } = await client
    .from("tasks")
    .insert({
      ...task,
      organization_id: organizationId,
      project_id: projectId,
      reporter_id: userId,
      assignee_id: assigneeId,
      due_date: dueDate,
    })
    .select()
    .single();
  if (error) throw mapDataError(error);
  return data;
}

export async function updateTask(
  client: WorkGridClient,
  organizationId: string,
  taskId: string,
  input: TaskInput,
): Promise<Task> {
  const { data, error } = await client
    .from("tasks")
    .update({
      title: input.title,
      description: input.description,
      status: input.status,
      priority: input.priority,
      assignee_id: input.assigneeId,
      due_date: input.dueDate,
    })
    .eq("organization_id", organizationId)
    .eq("id", taskId)
    .select()
    .maybeSingle();
  if (error) throw mapDataError(error);
  if (!data) throw new AppError("NOT_FOUND", "Task not found.");
  return data;
}

export async function deleteTask(
  client: WorkGridClient,
  organizationId: string,
  taskId: string,
) {
  const { error, count } = await client
    .from("tasks")
    .delete({ count: "exact" })
    .eq("organization_id", organizationId)
    .eq("id", taskId);
  if (error) throw mapDataError(error);
  if (!count) throw new AppError("NOT_FOUND", "Task not found.");
}

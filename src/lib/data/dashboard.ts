import type { WorkGridClient } from "@/lib/supabase/server";
import type { DashboardMetrics } from "@/types/domain";
import { mapDataError } from "./errors";

interface DashboardCounts {
  projects: number;
  all: number;
  todo: number;
  inProgress: number;
  inReview: number;
  done: number;
  overdue: number;
  assigned: number;
}

export function buildDashboardMetrics(
  counts: DashboardCounts,
): DashboardMetrics {
  return {
    projectCount: counts.projects,
    totalTasks: counts.all,
    completedTasks: counts.done,
    overdueTasks: counts.overdue,
    assignedTasks: counts.assigned,
    progressPercent:
      counts.all === 0 ? 0 : Math.round((counts.done / counts.all) * 100),
    statusCounts: {
      TODO: counts.todo,
      IN_PROGRESS: counts.inProgress,
      IN_REVIEW: counts.inReview,
      DONE: counts.done,
    },
  };
}

export async function getDashboardMetrics(
  client: WorkGridClient,
  organizationId: string,
  userId: string,
): Promise<DashboardMetrics> {
  const today = new Date().toISOString().slice(0, 10);
  const base = () =>
    client
      .from("tasks")
      .select("id", { count: "exact", head: true })
      .eq("organization_id", organizationId);
  const [projects, all, todo, inProgress, inReview, done, overdue, assigned] =
    await Promise.all([
      client
        .from("projects")
        .select("id", { count: "exact", head: true })
        .eq("organization_id", organizationId),
      base(),
      base().eq("status", "TODO"),
      base().eq("status", "IN_PROGRESS"),
      base().eq("status", "IN_REVIEW"),
      base().eq("status", "DONE"),
      base().lt("due_date", today).neq("status", "DONE"),
      base().eq("assignee_id", userId).neq("status", "DONE"),
    ]);

  for (const result of [
    projects,
    all,
    todo,
    inProgress,
    inReview,
    done,
    overdue,
    assigned,
  ]) {
    if (result.error) throw mapDataError(result.error);
  }
  return buildDashboardMetrics({
    projects: projects.count ?? 0,
    all: all.count ?? 0,
    todo: todo.count ?? 0,
    inProgress: inProgress.count ?? 0,
    inReview: inReview.count ?? 0,
    done: done.count ?? 0,
    overdue: overdue.count ?? 0,
    assigned: assigned.count ?? 0,
  });
}

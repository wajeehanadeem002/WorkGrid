import Link from "next/link";
import { EmptyState } from "@/components/empty-state";
import { StatusBadge } from "@/components/status-badge";
import { formatDate, isOverdue } from "@/lib/ui/date";
import type { Project, Task } from "@/types/domain";

export function TaskList({
  tasks,
  projects,
  organizationSlug,
  emptyAction,
}: {
  tasks: Task[];
  projects: Pick<Project, "id" | "name" | "key">[];
  organizationSlug: string;
  emptyAction?: React.ReactNode;
}) {
  if (!tasks.length)
    return (
      <div className="card">
        <EmptyState
          title="No tasks found"
          description="Adjust the filters or add the next piece of work."
          action={emptyAction}
        />
      </div>
    );
  const projectMap = new Map(projects.map((project) => [project.id, project]));
  return (
    <div className="card">
      <div className="table-wrap">
        <table className="data-table">
          <thead>
            <tr>
              <th>Task</th>
              <th>Project</th>
              <th>Status</th>
              <th>Priority</th>
              <th>Due</th>
            </tr>
          </thead>
          <tbody>
            {tasks.map((task) => {
              const project = projectMap.get(task.project_id);
              const overdue = isOverdue(task.due_date, task.status);
              return (
                <tr key={task.id}>
                  <td>
                    <Link
                      className="data-table__primary"
                      href={`/app/${organizationSlug}/tasks/${task.id}`}
                    >
                      {task.title}
                    </Link>
                    <span className="data-table__secondary">
                      {task.assignee_id
                        ? `Assigned to ${task.assignee_id}`
                        : "Unassigned"}
                    </span>
                  </td>
                  <td>{project?.key ?? "—"}</td>
                  <td>
                    <StatusBadge value={task.status} />
                  </td>
                  <td>
                    <StatusBadge value={task.priority} />
                  </td>
                  <td>
                    {overdue ? (
                      <span className="badge badge--overdue">
                        {formatDate(task.due_date)}
                      </span>
                    ) : (
                      formatDate(task.due_date)
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <div className="responsive-card-list">
        {tasks.map((task) => {
          const project = projectMap.get(task.project_id);
          return (
            <article className="responsive-data-card" key={task.id}>
              <div className="responsive-data-card__header">
                <div>
                  <Link
                    className="data-table__primary"
                    href={`/app/${organizationSlug}/tasks/${task.id}`}
                  >
                    {task.title}
                  </Link>
                  <span className="data-table__secondary">
                    {project?.key ?? "Unknown project"}
                  </span>
                </div>
                <StatusBadge value={task.status} />
              </div>
              <dl>
                <div>
                  <dt>Priority</dt>
                  <dd>
                    <StatusBadge value={task.priority} />
                  </dd>
                </div>
                <div>
                  <dt>Due</dt>
                  <dd>{formatDate(task.due_date)}</dd>
                </div>
              </dl>
            </article>
          );
        })}
      </div>
    </div>
  );
}

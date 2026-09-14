import Link from "next/link";
import { PageHeader } from "@/components/page-header";
import { PermissionGate } from "@/components/permission-gate";
import { StatusBadge } from "@/components/status-badge";
import { resolveOrganizationContext } from "@/lib/auth/server-context";
import { listRecentAuditLogs } from "@/lib/data/audit";
import { getDashboardMetrics } from "@/lib/data/dashboard";
import { listProjects } from "@/lib/data/projects";
import { listTasks } from "@/lib/data/tasks";
import { formatDateTime } from "@/lib/ui/date";

export default async function DashboardPage({
  params,
  searchParams,
}: {
  params: Promise<{ organizationSlug: string }>;
  searchParams: Promise<{ created?: string; joined?: string }>;
}) {
  const [{ organizationSlug }, notices] = await Promise.all([
    params,
    searchParams,
  ]);
  const { context, client } =
    await resolveOrganizationContext(organizationSlug);
  const pagination = { page: 1, pageSize: 5, from: 0, to: 4 };
  const [metrics, projects, tasks, activity] = await Promise.all([
    getDashboardMetrics(client, context.organization.id, context.userId),
    listProjects(
      client,
      context.organization.id,
      { query: "", status: "ALL", sort: "updated_desc" },
      pagination,
    ),
    listTasks(
      client,
      context.organization.id,
      {
        query: "",
        status: "ALL",
        priority: "ALL",
        assignee: context.userId,
        project: "ALL",
        due: "ALL",
        sort: "updated_desc",
      },
      pagination,
    ),
    context.membership.role === "member"
      ? Promise.resolve([])
      : listRecentAuditLogs(client, context.organization.id, 6),
  ]);
  const metricCards = [
    ["Projects", metrics.projectCount],
    ["All tasks", metrics.totalTasks],
    ["Assigned to you", metrics.assignedTasks],
    ["Overdue", metrics.overdueTasks],
    ["Completed", metrics.completedTasks],
  ] as const;

  return (
    <div className="page">
      <PageHeader
        eyebrow="Overview"
        title="Good work starts with clarity."
        description={`${context.organization.name} at a glance.`}
        actions={
          <>
            <PermissionGate
              role={context.membership.role}
              permission="project:create"
            >
              <Link
                className="button button--secondary"
                href={`/app/${organizationSlug}/projects/new`}
              >
                New project
              </Link>
            </PermissionGate>
            <Link
              className="button button--primary"
              href={`/app/${organizationSlug}/tasks/new`}
            >
              New task
            </Link>
          </>
        }
      />
      {notices.created ? (
        <div className="flash flash--success" role="status">
          Organization created. Your secure workspace is ready.
        </div>
      ) : null}
      {notices.joined ? (
        <div className="flash flash--success" role="status">
          You joined {context.organization.name}.
        </div>
      ) : null}
      <section className="metric-grid" aria-label="Workspace metrics">
        {metricCards.map(([label, value]) => (
          <article className="card metric" key={label}>
            <span className="metric__label">{label}</span>
            <strong className="metric__value">{value}</strong>
          </article>
        ))}
      </section>
      <div className="dashboard-grid">
        <section className="card">
          <div className="card__header">
            <h2>Project progress</h2>
            <span>{metrics.progressPercent}% complete</span>
          </div>
          <div className="card__body">
            <div
              className="progress-track"
              role="progressbar"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={metrics.progressPercent}
              aria-label="Completed tasks"
            >
              <div
                className="progress-fill"
                style={{ width: `${metrics.progressPercent}%` }}
              />
            </div>
            <div className="status-bars">
              {Object.entries(metrics.statusCounts).map(([status, count]) => (
                <div className="status-bar" key={status}>
                  <div className="status-bar__label">
                    <StatusBadge value={status} />
                    <strong>{count}</strong>
                  </div>
                  <div className="progress-track">
                    <div
                      className="progress-fill"
                      style={{
                        width: `${metrics.totalTasks ? Math.round((count / metrics.totalTasks) * 100) : 0}%`,
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>
        <section className="card">
          <div className="card__header">
            <h2>Recent activity</h2>
            {context.membership.role !== "member" ? (
              <Link href={`/app/${organizationSlug}/audit`}>View all</Link>
            ) : null}
          </div>
          <div className="card__body">
            {activity.length ? (
              <ul className="activity-list">
                {activity.map((event) => (
                  <li className="activity-item" key={event.id}>
                    <span className="activity-dot" />
                    <div>
                      <p>
                        {event.action
                          .replaceAll(".", " · ")
                          .replaceAll("_", " ")}
                      </p>
                      <time dateTime={event.created_at}>
                        {formatDateTime(event.created_at)}
                      </time>
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <p style={{ color: "var(--muted)" }}>
                {context.membership.role === "member"
                  ? "Activity history is available to administrators."
                  : "No activity recorded yet."}
              </p>
            )}
          </div>
        </section>
      </div>
      <div className="dashboard-grid" style={{ marginTop: "1rem" }}>
        <section className="card">
          <div className="card__header">
            <h2>Recently updated projects</h2>
            <Link href={`/app/${organizationSlug}/projects`}>
              View projects
            </Link>
          </div>
          <div className="card__body">
            {projects.items.length ? (
              <ul className="activity-list">
                {projects.items.map((project) => (
                  <li className="activity-item" key={project.id}>
                    <span className="activity-dot" />
                    <div>
                      <p>
                        <Link
                          href={`/app/${organizationSlug}/projects/${project.id}`}
                        >
                          <strong>{project.key}</strong> · {project.name}
                        </Link>
                      </p>
                      <StatusBadge value={project.status} />
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <p style={{ color: "var(--muted)" }}>
                Create a project to organize the first stream of work.
              </p>
            )}
          </div>
        </section>
        <section className="card">
          <div className="card__header">
            <h2>Your open tasks</h2>
            <Link
              href={`/app/${organizationSlug}/tasks?assignee=${encodeURIComponent(context.userId)}`}
            >
              View tasks
            </Link>
          </div>
          <div className="card__body">
            {tasks.items.length ? (
              <ul className="activity-list">
                {tasks.items.map((task) => (
                  <li className="activity-item" key={task.id}>
                    <span className="activity-dot" />
                    <div>
                      <p>
                        <Link
                          href={`/app/${organizationSlug}/tasks/${task.id}`}
                        >
                          {task.title}
                        </Link>
                      </p>
                      <StatusBadge value={task.status} />
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <p style={{ color: "var(--muted)" }}>
                No open tasks are assigned to you.
              </p>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}

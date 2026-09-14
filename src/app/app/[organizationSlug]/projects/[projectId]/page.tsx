import Link from "next/link";
import { Breadcrumbs } from "@/components/breadcrumbs";
import { ConfirmAction } from "@/components/confirm-action";
import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/page-header";
import { PermissionGate } from "@/components/permission-gate";
import { StatusBadge } from "@/components/status-badge";
import { deleteProjectAction } from "@/features/projects/actions";
import { resolveOrganizationContext } from "@/lib/auth/server-context";
import { getProject } from "@/lib/data/projects";
import { listProjectTasks } from "@/lib/data/tasks";
import { formatDateTime } from "@/lib/ui/date";

export default async function ProjectDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ organizationSlug: string; projectId: string }>;
  searchParams: Promise<{ created?: string }>;
}) {
  const [{ organizationSlug, projectId }, query] = await Promise.all([
    params,
    searchParams,
  ]);
  const { context, client } =
    await resolveOrganizationContext(organizationSlug);
  const [project, tasks] = await Promise.all([
    getProject(client, context.organization.id, projectId),
    listProjectTasks(client, context.organization.id, projectId),
  ]);
  return (
    <div className="page">
      <Breadcrumbs
        items={[
          { label: "Projects", href: `/app/${organizationSlug}/projects` },
          { label: project.name },
        ]}
      />
      <PageHeader
        title={project.name}
        description={`${project.key} · Updated ${formatDateTime(project.updated_at)}`}
        actions={
          <>
            <PermissionGate
              role={context.membership.role}
              permission="project:update"
            >
              <Link
                className="button button--secondary"
                href={`/app/${organizationSlug}/projects/${project.id}/edit`}
              >
                Edit project
              </Link>
            </PermissionGate>
            <Link
              className="button button--primary"
              href={`/app/${organizationSlug}/tasks/new?project=${project.id}`}
            >
              Add task
            </Link>
          </>
        }
      />
      {query.created ? (
        <div className="flash flash--success" role="status">
          Project created.
        </div>
      ) : null}
      <div className="detail-grid">
        <section className="card">
          <div className="card__header">
            <h2>Overview</h2>
            <StatusBadge value={project.status} />
          </div>
          <div className="card__body">
            <p className="description">
              {project.description || "No description has been added."}
            </p>
          </div>
        </section>
        <aside className="card">
          <div className="card__header">
            <h2>Project details</h2>
          </div>
          <div className="card__body">
            <dl className="detail-list">
              <div>
                <dt>Key</dt>
                <dd>{project.key}</dd>
              </div>
              <div>
                <dt>Status</dt>
                <dd>
                  <StatusBadge value={project.status} />
                </dd>
              </div>
              <div>
                <dt>Created</dt>
                <dd>{formatDateTime(project.created_at)}</dd>
              </div>
            </dl>
          </div>
        </aside>
      </div>
      <section className="card" style={{ marginTop: "1rem" }}>
        <div className="card__header">
          <h2>Recent tasks</h2>
          <Link href={`/app/${organizationSlug}/tasks?project=${project.id}`}>
            View all
          </Link>
        </div>
        {tasks.length ? (
          <div className="card__body">
            <ul className="activity-list">
              {tasks.map((task) => (
                <li className="activity-item" key={task.id}>
                  <span className="activity-dot" />
                  <div>
                    <p>
                      <Link href={`/app/${organizationSlug}/tasks/${task.id}`}>
                        {task.title}
                      </Link>
                    </p>
                    <StatusBadge value={task.status} />
                  </div>
                </li>
              ))}
            </ul>
          </div>
        ) : (
          <EmptyState
            title="No tasks yet"
            description="Break the project into clear, assignable work."
            action={
              <Link
                className="button button--primary"
                href={`/app/${organizationSlug}/tasks/new?project=${project.id}`}
              >
                Add task
              </Link>
            }
          />
        )}
      </section>
      <PermissionGate
        role={context.membership.role}
        permission="project:delete"
      >
        <section className="card danger-zone" style={{ marginTop: "1rem" }}>
          <div className="card__header">
            <h2>Danger zone</h2>
          </div>
          <div className="card__body">
            <p>
              Projects with tasks cannot be deleted. Archive completed work when
              history must be retained.
            </p>
            <ConfirmAction
              title="Delete this project?"
              description="This action is permanent and succeeds only when the project has no related tasks or attachments."
              triggerLabel="Delete project"
              confirmLabel="Delete project"
              action={deleteProjectAction.bind(
                null,
                organizationSlug,
                project.id,
              )}
            />
          </div>
        </section>
      </PermissionGate>
    </div>
  );
}

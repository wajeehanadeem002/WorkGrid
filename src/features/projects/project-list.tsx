import Link from "next/link";
import { EmptyState } from "@/components/empty-state";
import { StatusBadge } from "@/components/status-badge";
import { formatDateTime } from "@/lib/ui/date";
import type { Project } from "@/types/domain";

export function ProjectList({
  projects,
  organizationSlug,
  emptyAction,
}: {
  projects: Project[];
  organizationSlug: string;
  emptyAction?: React.ReactNode;
}) {
  if (!projects.length)
    return (
      <div className="card">
        <EmptyState
          title="No projects found"
          description="Adjust the filters or create the first project for this organization."
          action={emptyAction}
        />
      </div>
    );
  return (
    <div className="card">
      <div className="table-wrap">
        <table className="data-table">
          <thead>
            <tr>
              <th>Project</th>
              <th>Status</th>
              <th>Updated</th>
            </tr>
          </thead>
          <tbody>
            {projects.map((project) => (
              <tr key={project.id}>
                <td>
                  <Link
                    className="data-table__primary"
                    href={`/app/${organizationSlug}/projects/${project.id}`}
                  >
                    {project.name}
                  </Link>
                  <span className="data-table__secondary">{project.key}</span>
                </td>
                <td>
                  <StatusBadge value={project.status} />
                </td>
                <td>{formatDateTime(project.updated_at)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="responsive-card-list">
        {projects.map((project) => (
          <article className="responsive-data-card" key={project.id}>
            <div className="responsive-data-card__header">
              <div>
                <Link
                  className="data-table__primary"
                  href={`/app/${organizationSlug}/projects/${project.id}`}
                >
                  {project.name}
                </Link>
                <span className="data-table__secondary">{project.key}</span>
              </div>
              <StatusBadge value={project.status} />
            </div>
            <dl>
              <div>
                <dt>Updated</dt>
                <dd>{formatDateTime(project.updated_at)}</dd>
              </div>
            </dl>
          </article>
        ))}
      </div>
    </div>
  );
}

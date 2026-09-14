import Link from "next/link";
import { Breadcrumbs } from "@/components/breadcrumbs";
import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/page-header";
import { TaskForm } from "@/features/tasks/task-form";
import { createTaskAction } from "@/features/tasks/actions";
import { uuidSchema } from "@/features/shared/schemas";
import { resolveOrganizationContext } from "@/lib/auth/server-context";
import { listOrganizationMembers } from "@/lib/data/organizations";
import { getProject, listProjects } from "@/lib/data/projects";
import { getUserProfiles, userLabel } from "@/lib/auth/user-profiles";

export default async function NewTaskPage({
  params,
  searchParams,
}: {
  params: Promise<{ organizationSlug: string }>;
  searchParams: Promise<{ project?: string; projectQuery?: string }>;
}) {
  const [{ organizationSlug }, query] = await Promise.all([
    params,
    searchParams,
  ]);
  const { context, client } =
    await resolveOrganizationContext(organizationSlug);
  const requestedProjectId = uuidSchema.safeParse(query.project);
  const projectQuery = query.projectQuery?.trim().slice(0, 100) ?? "";
  const [projectResult, members, requestedProject] = await Promise.all([
    listProjects(
      client,
      context.organization.id,
      { query: projectQuery, status: "ALL", sort: "name_asc" },
      { page: 1, pageSize: 50, from: 0, to: 49 },
    ),
    listOrganizationMembers(client, context.organization.id),
    requestedProjectId.success
      ? getProject(client, context.organization.id, requestedProjectId.data)
      : Promise.resolve(null),
  ]);
  if (!projectResult.items.length && !requestedProject && !projectQuery)
    return (
      <div className="page">
        <Breadcrumbs
          items={[
            { label: "Tasks", href: `/app/${organizationSlug}/tasks` },
            { label: "New task" },
          ]}
        />
        <PageHeader title="Create task" />
        <div className="card">
          <EmptyState
            title="Create a project first"
            description="Every task must belong to a project in this organization."
            action={
              context.membership.role === "member" ? undefined : (
                <Link
                  className="button button--primary"
                  href={`/app/${organizationSlug}/projects/new`}
                >
                  Create project
                </Link>
              )
            }
          />
        </div>
      </div>
    );
  if (!projectResult.items.length && !requestedProject) {
    return (
      <div className="page">
        <Breadcrumbs
          items={[
            { label: "Tasks", href: `/app/${organizationSlug}/tasks` },
            { label: "New task" },
          ]}
        />
        <PageHeader
          title="Create task"
          description="Search the organization project directory before creating the task."
        />
        <form className="filter-bar" role="search" method="get">
          <div className="field field--search">
            <label htmlFor="project-query">Find a project</label>
            <input
              id="project-query"
              name="projectQuery"
              type="search"
              defaultValue={projectQuery}
              maxLength={100}
            />
          </div>
          <button className="button button--primary" type="submit">
            Search projects
          </button>
        </form>
        <div className="card">
          <EmptyState
            title="No matching projects"
            description="Try another project name or clear the search."
            action={
              <Link
                className="button button--secondary"
                href={`/app/${organizationSlug}/tasks/new`}
              >
                Clear search
              </Link>
            }
          />
        </div>
      </div>
    );
  }
  const projects = requestedProject
    ? [
        requestedProject,
        ...projectResult.items.filter(
          (project) => project.id !== requestedProject.id,
        ),
      ]
    : projectResult.items;
  const profiles = await getUserProfiles(
    members.map((member) => member.user_id),
  );
  const memberOptions = members.map((member) => ({
    userId: member.user_id,
    label: userLabel(profiles, member.user_id, context.userId),
  }));
  return (
    <div className="page">
      <Breadcrumbs
        items={[
          { label: "Tasks", href: `/app/${organizationSlug}/tasks` },
          { label: "New task" },
        ]}
      />
      <PageHeader
        title="Create task"
        description="Capture enough context for someone else to move the work forward."
      />
      <form className="filter-bar" role="search" method="get">
        <div className="field field--search">
          <label htmlFor="project-query">Find a project</label>
          <input
            id="project-query"
            name="projectQuery"
            type="search"
            defaultValue={projectQuery}
            maxLength={100}
            placeholder="Project name contains..."
          />
        </div>
        <button className="button button--secondary" type="submit">
          Search projects
        </button>
      </form>
      <TaskForm
        action={createTaskAction.bind(null, organizationSlug)}
        projects={projects}
        members={memberOptions}
      />
    </div>
  );
}

import Link from "next/link";
import { PageHeader } from "@/components/page-header";
import { Pagination } from "@/components/pagination";
import { normalizeTaskFilters } from "@/features/shared/schemas";
import { TaskFilters } from "@/features/tasks/task-filters";
import { TaskList } from "@/features/tasks/task-list";
import { resolveOrganizationContext } from "@/lib/auth/server-context";
import { listOrganizationMembers } from "@/lib/data/organizations";
import { listProjects, listProjectsByIds } from "@/lib/data/projects";
import { listTasks } from "@/lib/data/tasks";
import { parsePagination } from "@/lib/security/pagination";
import { firstParam, type SearchParams } from "@/lib/ui/search-params";
import { getUserProfiles, userLabel } from "@/lib/auth/user-profiles";

export default async function TasksPage({
  params,
  searchParams,
}: {
  params: Promise<{ organizationSlug: string }>;
  searchParams: Promise<SearchParams>;
}) {
  const [{ organizationSlug }, query] = await Promise.all([
    params,
    searchParams,
  ]);
  const { context, client } =
    await resolveOrganizationContext(organizationSlug);
  const filters = normalizeTaskFilters({
    query: firstParam(query.query),
    status: firstParam(query.status, "ALL"),
    priority: firstParam(query.priority, "ALL"),
    assignee: firstParam(query.assignee, "ALL"),
    project: firstParam(query.project, "ALL"),
    due: firstParam(query.due, "ALL"),
    sort: firstParam(query.sort, "updated_desc"),
  });
  const pagination = parsePagination({
    page: query.page,
    pageSize: query.pageSize,
  });
  const [result, projectResult, members] = await Promise.all([
    listTasks(client, context.organization.id, filters, pagination),
    listProjects(
      client,
      context.organization.id,
      { query: "", status: "ALL", sort: "name_asc" },
      { page: 1, pageSize: 50, from: 0, to: 49 },
    ),
    listOrganizationMembers(client, context.organization.id),
  ]);
  const profiles = await getUserProfiles(
    members.map((member) => member.user_id),
  );
  const memberOptions = members.map((member) => ({
    userId: member.user_id,
    label: userLabel(profiles, member.user_id, context.userId),
  }));
  const loadedProjectIds = new Set(
    projectResult.items.map((project) => project.id),
  );
  const requiredProjectIds = result.items
    .map((task) => task.project_id)
    .concat(filters.project === "ALL" ? [] : [filters.project])
    .filter((projectId) => !loadedProjectIds.has(projectId));
  const additionalProjects = await listProjectsByIds(
    client,
    context.organization.id,
    requiredProjectIds,
  );
  const projects = [...projectResult.items, ...additionalProjects];
  const createLink = (
    <Link
      className="button button--primary"
      href={`/app/${organizationSlug}/tasks/new`}
    >
      New task
    </Link>
  );
  return (
    <div className="page">
      <PageHeader
        eyebrow="Work queue"
        title="Tasks"
        description="Focus the team with clear ownership, priority, and due dates."
        actions={createLink}
      />
      {query.deleted ? (
        <div className="flash flash--success" role="status">
          Task deleted.
        </div>
      ) : null}
      <TaskFilters
        values={filters}
        projects={projects}
        members={memberOptions}
      />
      <TaskList
        tasks={result.items}
        projects={projects}
        organizationSlug={organizationSlug}
        emptyAction={createLink}
      />
      <Pagination
        page={result.page}
        pageSize={result.pageSize}
        total={result.total}
        query={{
          query: filters.query,
          status: filters.status,
          priority: filters.priority,
          assignee: filters.assignee,
          project: filters.project,
          due: filters.due,
          sort: filters.sort,
        }}
      />
    </div>
  );
}

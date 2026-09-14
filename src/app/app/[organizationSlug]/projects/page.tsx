import Link from "next/link";
import { PageHeader } from "@/components/page-header";
import { Pagination } from "@/components/pagination";
import { PermissionGate } from "@/components/permission-gate";
import { ProjectFilters } from "@/features/projects/project-filters";
import { ProjectList } from "@/features/projects/project-list";
import { normalizeProjectFilters } from "@/features/shared/schemas";
import { resolveOrganizationContext } from "@/lib/auth/server-context";
import { listProjects } from "@/lib/data/projects";
import { parsePagination } from "@/lib/security/pagination";
import { firstParam, type SearchParams } from "@/lib/ui/search-params";

export default async function ProjectsPage({
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
  const filters = normalizeProjectFilters({
    query: firstParam(query.query),
    status: firstParam(query.status, "ALL"),
    sort: firstParam(query.sort, "updated_desc"),
  });
  const pagination = parsePagination({
    page: query.page,
    pageSize: query.pageSize,
  });
  const result = await listProjects(
    client,
    context.organization.id,
    filters,
    pagination,
  );
  const createLink = (
    <Link
      className="button button--primary"
      href={`/app/${organizationSlug}/projects/new`}
    >
      New project
    </Link>
  );
  return (
    <div className="page">
      <PageHeader
        eyebrow="Portfolio"
        title="Projects"
        description="Organize related work and track delivery health."
        actions={
          <PermissionGate
            role={context.membership.role}
            permission="project:create"
          >
            {createLink}
          </PermissionGate>
        }
      />
      {query.deleted ? (
        <div className="flash flash--success" role="status">
          Project deleted.
        </div>
      ) : null}
      <ProjectFilters values={filters} />
      <ProjectList
        projects={result.items}
        organizationSlug={organizationSlug}
        emptyAction={
          <PermissionGate
            role={context.membership.role}
            permission="project:create"
          >
            {createLink}
          </PermissionGate>
        }
      />
      <Pagination
        page={result.page}
        pageSize={result.pageSize}
        total={result.total}
        query={{
          query: filters.query,
          status: filters.status,
          sort: filters.sort,
        }}
      />
    </div>
  );
}

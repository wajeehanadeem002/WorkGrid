import { Breadcrumbs } from "@/components/breadcrumbs";
import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/page-header";
import { Pagination } from "@/components/pagination";
import { requirePermission } from "@/lib/auth/context";
import { resolveOrganizationContext } from "@/lib/auth/server-context";
import { listAuditLogs } from "@/lib/data/audit";
import { parsePagination } from "@/lib/security/pagination";
import { formatDateTime } from "@/lib/ui/date";
import type { SearchParams } from "@/lib/ui/search-params";

export default async function AuditPage({
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
  requirePermission(context, "audit:read");
  const pagination = parsePagination({
    page: query.page,
    pageSize: query.pageSize,
  });
  const result = await listAuditLogs(
    client,
    context.organization.id,
    pagination,
  );
  return (
    <div className="page">
      <Breadcrumbs items={[{ label: "Activity" }]} />
      <PageHeader
        eyebrow="Governance"
        title="Activity and audit log"
        description="An append-only record of important workspace and administrative actions."
      />
      <section className="card">
        {result.items.length ? (
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Action</th>
                  <th>Entity</th>
                  <th>Actor</th>
                  <th>Time</th>
                </tr>
              </thead>
              <tbody>
                {result.items.map((event) => (
                  <tr key={event.id}>
                    <td>
                      <strong>
                        {event.action
                          .replaceAll(".", " · ")
                          .replaceAll("_", " ")}
                      </strong>
                    </td>
                    <td>
                      {event.entity_type}
                      {event.entity_id ? (
                        <span className="data-table__secondary">
                          {event.entity_id}
                        </span>
                      ) : null}
                    </td>
                    <td>{event.actor_id ?? "System"}</td>
                    <td>
                      <time dateTime={event.created_at}>
                        {formatDateTime(event.created_at)}
                      </time>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="responsive-card-list">
              {result.items.map((event) => (
                <article className="responsive-data-card" key={event.id}>
                  <div className="responsive-data-card__header">
                    <strong>
                      {event.action.replaceAll(".", " · ").replaceAll("_", " ")}
                    </strong>
                    <time dateTime={event.created_at}>
                      {formatDateTime(event.created_at)}
                    </time>
                  </div>
                  <dl>
                    <div>
                      <dt>Entity</dt>
                      <dd>{event.entity_type}</dd>
                    </div>
                    <div>
                      <dt>Actor</dt>
                      <dd>{event.actor_id ?? "System"}</dd>
                    </div>
                  </dl>
                </article>
              ))}
            </div>
          </div>
        ) : (
          <EmptyState
            title="No activity recorded"
            description="Important changes will appear here as your team begins working."
          />
        )}
      </section>
      <Pagination
        page={result.page}
        pageSize={result.pageSize}
        total={result.total}
        query={{}}
      />
    </div>
  );
}

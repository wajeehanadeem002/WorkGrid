import { Breadcrumbs } from "@/components/breadcrumbs";
import { PageHeader } from "@/components/page-header";
import { OrganizationSettingsForm } from "@/features/organizations/settings-form";
import { updateOrganizationAction } from "@/features/organizations/actions";
import { resolveOrganizationContext } from "@/lib/auth/server-context";

export default async function OrganizationSettingsPage({
  params,
}: {
  params: Promise<{ organizationSlug: string }>;
}) {
  const { organizationSlug } = await params;
  const { context } = await resolveOrganizationContext(organizationSlug);
  const owner = context.membership.role === "owner";
  return (
    <div className="page">
      <Breadcrumbs items={[{ label: "Settings" }]} />
      <PageHeader
        eyebrow="Administration"
        title="Organization settings"
        description="Manage organization identity and controlled data exports."
      />
      <section className="card" style={{ marginBottom: "1rem" }}>
        <div className="card__header">
          <h2>General</h2>
        </div>
        <div className="card__body">
          {owner ? (
            <OrganizationSettingsForm
              action={updateOrganizationAction.bind(null, organizationSlug)}
              name={context.organization.name}
              disabled={false}
            />
          ) : (
            <div>
              <dl className="detail-list">
                <div>
                  <dt>Name</dt>
                  <dd>{context.organization.name}</dd>
                </div>
                <div>
                  <dt>URL slug</dt>
                  <dd>{context.organization.slug}</dd>
                </div>
              </dl>
              <p className="field-help" style={{ marginTop: "1rem" }}>
                Only an organization owner can change these settings.
              </p>
            </div>
          )}
        </div>
      </section>
      {context.membership.role !== "member" ? (
        <section className="card">
          <div className="card__header">
            <h2>Data export</h2>
          </div>
          <div className="card__body">
            <p>
              Exports are generated on demand, scoped to this organization, and
              rate limited. Attachment contents are not included.
            </p>
            <div className="page-header__actions">
              <form
                action={`/api/organizations/${context.organization.id}/export`}
                method="post"
              >
                <input type="hidden" name="format" value="json" />
                <input type="hidden" name="resource" value="all" />
                <button className="button button--secondary" type="submit">
                  Download JSON export
                </button>
              </form>
              <form
                action={`/api/organizations/${context.organization.id}/export`}
                method="post"
              >
                <input type="hidden" name="format" value="csv" />
                <input type="hidden" name="resource" value="tasks" />
                <button className="button button--secondary" type="submit">
                  Download tasks CSV
                </button>
              </form>
              <form
                action={`/api/organizations/${context.organization.id}/export`}
                method="post"
              >
                <input type="hidden" name="format" value="csv" />
                <input type="hidden" name="resource" value="projects" />
                <button className="button button--secondary" type="submit">
                  Download projects CSV
                </button>
              </form>
            </div>
          </div>
        </section>
      ) : null}
    </div>
  );
}

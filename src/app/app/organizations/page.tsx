import Link from "next/link";
import { EmptyState } from "@/components/empty-state";
import { Logo } from "@/components/logo";
import { PageHeader } from "@/components/page-header";
import { StatusBadge } from "@/components/status-badge";
import { listOrganizations } from "@/lib/data/organizations";
import { createAuthenticatedContext } from "@/lib/supabase/server";

export default async function OrganizationsPage() {
  const { userId, client } = await createAuthenticatedContext();
  const organizations = await listOrganizations(client, userId);
  return (
    <main id="main-content">
      <header className="public-header">
        <div className="public-header__inner container">
          <Logo href="/app" />
          <Link className="button button--primary" href="/app/new-organization">
            New organization
          </Link>
        </div>
      </header>
      <div className="page">
        <PageHeader
          eyebrow="Workspaces"
          title="Organizations"
          description="Choose the tenant boundary you want to work inside."
        />
        {organizations.length ? (
          <div className="feature-grid">
            {organizations.map((organization) => (
              <article className="feature-card" key={organization.id}>
                <StatusBadge value={organization.role} />
                <h2>{organization.name}</h2>
                <p>/{organization.slug}</p>
                <div style={{ marginTop: "1rem" }}>
                  <Link
                    className="button button--secondary"
                    href={`/app/${organization.slug}/dashboard`}
                  >
                    Open workspace
                  </Link>
                </div>
              </article>
            ))}
          </div>
        ) : (
          <div className="card">
            <EmptyState
              title="No organizations yet"
              description="Create a secure workspace to start organizing projects and tasks."
              action={
                <Link
                  className="button button--primary"
                  href="/app/new-organization"
                >
                  Create organization
                </Link>
              }
            />
          </div>
        )}
      </div>
    </main>
  );
}

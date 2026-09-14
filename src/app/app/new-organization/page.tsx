import { OrganizationForm } from "@/features/organizations/organization-form";
import { Logo } from "@/components/logo";

export default function NewOrganizationPage() {
  return (
    <main id="main-content" className="auth-page">
      <aside className="auth-page__aside">
        <Logo href="/app" />
        <div>
          <p className="eyebrow">Workspace setup</p>
          <h1>Create your organization.</h1>
          <p>
            This becomes the security boundary for members, projects, tasks,
            files, and audit history.
          </p>
        </div>
        <small>You will be the organization owner.</small>
      </aside>
      <section className="auth-page__main">
        <div style={{ width: "min(100%, 620px)" }}>
          <h2>Organization details</h2>
          <p style={{ color: "var(--muted)" }}>
            Use a name and short URL your team will recognize.
          </p>
          <OrganizationForm />
        </div>
      </section>
    </main>
  );
}

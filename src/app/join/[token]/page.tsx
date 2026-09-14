import type { Metadata } from "next";
import { AcceptInvitationForm } from "@/features/organizations/accept-invitation-form";
import { Logo } from "@/components/logo";
import { createAuthenticatedContext } from "@/lib/supabase/server";
import { getVerifiedPrimaryEmail } from "@/lib/auth/clerk-user";
import { getInvitationPreview } from "@/lib/data/invitations";

export const metadata: Metadata = {
  robots: { index: false, follow: false, nocache: true },
};

export default async function JoinOrganizationPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const authenticated = await createAuthenticatedContext();
  const verifiedEmail = await getVerifiedPrimaryEmail();
  const { token } = await params;
  const invitation = await getInvitationPreview(
    authenticated,
    token,
    verifiedEmail,
  );
  return (
    <main id="main-content" className="auth-page">
      <aside className="auth-page__aside">
        <Logo href="/app" />
        <div>
          <p className="eyebrow">Organization invitation</p>
          <h1>Join a WorkGrid team.</h1>
          <p>
            Your access will be limited to the organization and role granted by
            this invitation.
          </p>
        </div>
        <small>Expired or previously used links are rejected.</small>
      </aside>
      <section className="auth-page__main">
        <div style={{ width: "min(100%, 620px)" }}>
          <h2>Review invitation</h2>
          {invitation.ok ? (
            <AcceptInvitationForm
              token={token}
              organizationName={invitation.organizationName}
              email={invitation.email}
              role={invitation.role}
              expiresAt={invitation.expiresAt}
            />
          ) : (
            <div className="form-message form-message--error" role="alert">
              <p>{invitation.message}</p>
            </div>
          )}
        </div>
      </section>
    </main>
  );
}

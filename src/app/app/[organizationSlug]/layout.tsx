import { notFound } from "next/navigation";
import { WorkspaceNavigation } from "@/components/workspace-navigation";
import { resolveOrganizationContext } from "@/lib/auth/server-context";
import { AppError } from "@/lib/security/errors";
import { createAuthenticatedContext } from "@/lib/supabase/server";

export default async function OrganizationLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ organizationSlug: string }>;
}) {
  const { organizationSlug } = await params;
  const authenticated = await createAuthenticatedContext();
  let resolved;
  try {
    resolved = await resolveOrganizationContext(
      organizationSlug,
      authenticated,
    );
  } catch (error) {
    if (error instanceof AppError && error.code === "NOT_FOUND") notFound();
    throw error;
  }
  const { context } = resolved;
  return (
    <div className="app-shell">
      <WorkspaceNavigation
        organizationName={context.organization.name}
        organizationSlug={organizationSlug}
        role={context.membership.role}
      />
      <main className="app-main" id="main-content">
        {children}
      </main>
    </div>
  );
}

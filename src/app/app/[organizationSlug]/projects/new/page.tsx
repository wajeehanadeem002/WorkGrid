import { Breadcrumbs } from "@/components/breadcrumbs";
import { PageHeader } from "@/components/page-header";
import { ProjectForm } from "@/features/projects/project-form";
import { createProjectAction } from "@/features/projects/actions";
import { requirePermission } from "@/lib/auth/context";
import { resolveOrganizationContext } from "@/lib/auth/server-context";

export default async function NewProjectPage({
  params,
}: {
  params: Promise<{ organizationSlug: string }>;
}) {
  const { organizationSlug } = await params;
  const { context } = await resolveOrganizationContext(organizationSlug);
  requirePermission(context, "project:create");
  return (
    <div className="page">
      <Breadcrumbs
        items={[
          { label: "Projects", href: `/app/${organizationSlug}/projects` },
          { label: "New project" },
        ]}
      />
      <PageHeader
        title="Create project"
        description="Define a clear scope and a short key for task references."
      />
      <ProjectForm action={createProjectAction.bind(null, organizationSlug)} />
    </div>
  );
}

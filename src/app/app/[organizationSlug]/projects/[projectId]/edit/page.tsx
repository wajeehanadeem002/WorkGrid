import { Breadcrumbs } from "@/components/breadcrumbs";
import { PageHeader } from "@/components/page-header";
import { ProjectForm } from "@/features/projects/project-form";
import { updateProjectAction } from "@/features/projects/actions";
import { requirePermission } from "@/lib/auth/context";
import { resolveOrganizationContext } from "@/lib/auth/server-context";
import { getProject } from "@/lib/data/projects";

export default async function EditProjectPage({
  params,
}: {
  params: Promise<{ organizationSlug: string; projectId: string }>;
}) {
  const { organizationSlug, projectId } = await params;
  const { context, client } =
    await resolveOrganizationContext(organizationSlug);
  requirePermission(context, "project:update");
  const project = await getProject(client, context.organization.id, projectId);
  return (
    <div className="page">
      <Breadcrumbs
        items={[
          { label: "Projects", href: `/app/${organizationSlug}/projects` },
          {
            label: project.name,
            href: `/app/${organizationSlug}/projects/${project.id}`,
          },
          { label: "Edit" },
        ]}
      />
      <PageHeader
        title="Edit project"
        description="Changes are recorded in the organization activity history."
      />
      <ProjectForm
        project={project}
        action={updateProjectAction.bind(null, organizationSlug, project.id)}
      />
    </div>
  );
}

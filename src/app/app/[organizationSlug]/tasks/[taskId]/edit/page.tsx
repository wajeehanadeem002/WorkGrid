import { Breadcrumbs } from "@/components/breadcrumbs";
import { PageHeader } from "@/components/page-header";
import { TaskForm } from "@/features/tasks/task-form";
import { updateTaskAction } from "@/features/tasks/actions";
import { resolveOrganizationContext } from "@/lib/auth/server-context";
import { listOrganizationMembers } from "@/lib/data/organizations";
import { getProject } from "@/lib/data/projects";
import { getTask } from "@/lib/data/tasks";
import { getUserProfiles, userLabel } from "@/lib/auth/user-profiles";

export default async function EditTaskPage({
  params,
}: {
  params: Promise<{ organizationSlug: string; taskId: string }>;
}) {
  const { organizationSlug, taskId } = await params;
  const { context, client } =
    await resolveOrganizationContext(organizationSlug);
  const task = await getTask(client, context.organization.id, taskId);
  const [project, members] = await Promise.all([
    getProject(client, context.organization.id, task.project_id),
    listOrganizationMembers(client, context.organization.id),
  ]);
  const profiles = await getUserProfiles(
    members.map((member) => member.user_id),
  );
  const memberOptions = members.map((member) => ({
    userId: member.user_id,
    label: userLabel(profiles, member.user_id, context.userId),
  }));
  return (
    <div className="page">
      <Breadcrumbs
        items={[
          { label: "Tasks", href: `/app/${organizationSlug}/tasks` },
          {
            label: task.title,
            href: `/app/${organizationSlug}/tasks/${task.id}`,
          },
          { label: "Edit" },
        ]}
      />
      <PageHeader
        title="Edit task"
        description="Assignment, status, and priority changes are recorded in activity history."
      />
      <TaskForm
        task={task}
        action={updateTaskAction.bind(null, organizationSlug, task.id)}
        projects={[project]}
        members={memberOptions}
      />
    </div>
  );
}

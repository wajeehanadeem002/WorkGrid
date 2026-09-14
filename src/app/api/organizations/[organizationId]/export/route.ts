import { requirePermission } from "@/lib/auth/context";
import { resolveOrganizationContextById } from "@/lib/auth/server-context";
import { mapDataError } from "@/lib/data/errors";
import { createDownloadResponse } from "@/lib/http/download";
import { routeErrorResponse } from "@/lib/http/route-errors";
import { enforceExportRateLimit } from "@/lib/security/rate-limit";
import {
  assertSameOrigin,
  parseExportInput,
  toCsv,
} from "@/lib/security/export";
import { uuidSchema } from "@/features/shared/schemas";
import type { WorkGridClient } from "@/lib/supabase/server";
import type {
  Attachment,
  AuditLog,
  Comment,
  OrganizationMember,
  Project,
  Task,
} from "@/types/domain";
import { createAuthenticatedContext } from "@/lib/supabase/server";
import { getPublicEnv } from "@/lib/env";

export const dynamic = "force-dynamic";
const EXPORT_LIMIT = 1_000;

interface ExportResult<T> {
  items: T[];
  total: number;
  truncated: boolean;
}

function toExportResult<T>(
  items: T[] | null,
  count: number | null,
): ExportResult<T> {
  const safeItems = items ?? [];
  const total = count ?? safeItems.length;
  return { items: safeItems, total, truncated: total > safeItems.length };
}

async function exportProjects(
  client: WorkGridClient,
  organizationId: string,
): Promise<ExportResult<Project>> {
  const { data, error, count } = await client
    .from("projects")
    .select("*", { count: "exact" })
    .eq("organization_id", organizationId)
    .order("created_at")
    .limit(EXPORT_LIMIT);
  if (error) throw mapDataError(error);
  return toExportResult(data, count);
}

async function exportTasks(
  client: WorkGridClient,
  organizationId: string,
): Promise<ExportResult<Task>> {
  const { data, error, count } = await client
    .from("tasks")
    .select("*", { count: "exact" })
    .eq("organization_id", organizationId)
    .order("created_at")
    .limit(EXPORT_LIMIT);
  if (error) throw mapDataError(error);
  return toExportResult(data, count);
}

async function exportComments(
  client: WorkGridClient,
  organizationId: string,
): Promise<ExportResult<Comment>> {
  const { data, error, count } = await client
    .from("comments")
    .select("*", { count: "exact" })
    .eq("organization_id", organizationId)
    .order("created_at")
    .limit(EXPORT_LIMIT);
  if (error) throw mapDataError(error);
  return toExportResult(data, count);
}

async function exportAttachments(
  client: WorkGridClient,
  organizationId: string,
): Promise<ExportResult<Attachment>> {
  const { data, error, count } = await client
    .from("attachments")
    .select("*", { count: "exact" })
    .eq("organization_id", organizationId)
    .eq("upload_status", "ready")
    .order("created_at")
    .limit(EXPORT_LIMIT);
  if (error) throw mapDataError(error);
  return toExportResult(data, count);
}

async function exportMembers(
  client: WorkGridClient,
  organizationId: string,
): Promise<ExportResult<OrganizationMember>> {
  const { data, error, count } = await client
    .from("organization_members")
    .select("*", { count: "exact" })
    .eq("organization_id", organizationId)
    .order("created_at")
    .limit(EXPORT_LIMIT);
  if (error) throw mapDataError(error);
  return toExportResult(data, count);
}

async function exportAuditLogs(
  client: WorkGridClient,
  organizationId: string,
): Promise<ExportResult<AuditLog>> {
  const { data, error, count } = await client
    .from("audit_logs")
    .select("*", { count: "exact" })
    .eq("organization_id", organizationId)
    .order("created_at")
    .limit(EXPORT_LIMIT);
  if (error) throw mapDataError(error);
  return toExportResult(data, count);
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ organizationId: string }> },
) {
  const authenticated = await createAuthenticatedContext();
  try {
    assertSameOrigin(request, getPublicEnv().NEXT_PUBLIC_APP_URL);
    const organizationId = uuidSchema.parse((await params).organizationId);
    const { context, client } = await resolveOrganizationContextById(
      organizationId,
      authenticated,
    );
    requirePermission(context, "export:create");
    const formData = await request.formData();
    const { format, resource } = parseExportInput({
      format: formData.get("format"),
      resource: formData.get("resource"),
    });
    await enforceExportRateLimit(client, context.organization.id);
    const filename = context.organization.slug.replace(/[^a-z0-9-]/g, "-");

    if (format === "csv") {
      if (resource === "projects") {
        const result = await exportProjects(client, context.organization.id);
        const rows = result.items.map((project) => ({
          id: project.id,
          key: project.key,
          name: project.name,
          status: project.status,
          description: project.description,
          created_at: project.created_at,
          updated_at: project.updated_at,
        }));
        return createDownloadResponse(
          toCsv(rows, [
            "id",
            "key",
            "name",
            "status",
            "description",
            "created_at",
            "updated_at",
          ]),
          {
            contentType: "text/csv; charset=utf-8",
            filename: `${filename}-projects.csv`,
            truncated: result.truncated,
          },
        );
      }
      if (resource === "tasks") {
        const result = await exportTasks(client, context.organization.id);
        const rows = result.items.map((task) => ({
          id: task.id,
          project_id: task.project_id,
          title: task.title,
          description: task.description,
          status: task.status,
          priority: task.priority,
          assignee_id: task.assignee_id,
          reporter_id: task.reporter_id,
          due_date: task.due_date,
          created_at: task.created_at,
          updated_at: task.updated_at,
        }));
        return createDownloadResponse(
          toCsv(rows, [
            "id",
            "project_id",
            "title",
            "description",
            "status",
            "priority",
            "assignee_id",
            "reporter_id",
            "due_date",
            "created_at",
            "updated_at",
          ]),
          {
            contentType: "text/csv; charset=utf-8",
            filename: `${filename}-tasks.csv`,
            truncated: result.truncated,
          },
        );
      }
      throw new Error("Validated CSV resource was not handled.");
    }
    const [projects, tasks, comments, attachments, members, auditLogs] =
      await Promise.all([
        exportProjects(client, context.organization.id),
        exportTasks(client, context.organization.id),
        exportComments(client, context.organization.id),
        exportAttachments(client, context.organization.id),
        exportMembers(client, context.organization.id),
        exportAuditLogs(client, context.organization.id),
      ]);
    const results = {
      projects,
      tasks,
      comments,
      attachments,
      members,
      auditLogs,
    };
    const truncated = Object.values(results).some((result) => result.truncated);
    const payload = {
      schemaVersion: 1,
      generatedAt: new Date().toISOString(),
      exportLimitPerResource: EXPORT_LIMIT,
      truncated,
      totals: Object.fromEntries(
        Object.entries(results).map(([name, result]) => [name, result.total]),
      ),
      organization: context.organization,
      projects: projects.items,
      tasks: tasks.items,
      comments: comments.items,
      attachments: attachments.items,
      members: members.items,
      auditLogs: auditLogs.items,
    };
    return createDownloadResponse(JSON.stringify(payload), {
      contentType: "application/json; charset=utf-8",
      filename: `${filename}-export.json`,
      truncated,
    });
  } catch (error) {
    return routeErrorResponse(error);
  }
}

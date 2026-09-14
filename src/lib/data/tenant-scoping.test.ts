import { describe, expect, it, vi } from "vitest";
import type { WorkGridClient } from "@/lib/supabase/server";
import { getAttachment, listTaskAttachments } from "./attachments";
import { listAuditLogs } from "./audit";
import { listTaskComments } from "./comments";
import {
  getMembership,
  getMembershipByUserId,
  listActiveInvitationsPage,
  listOrganizationMembersPage,
  listOrganizationMembers,
} from "./organizations";
import { getProject, listProjectsByIds } from "./projects";
import { getTask, listTasks } from "./tasks";

const organizationId = "11111111-1111-4111-8111-111111111111";
const resourceId = "22222222-2222-4222-8222-222222222222";

function createQueryClient(data: unknown = {}) {
  const response = {
    data,
    error: null,
    count: Array.isArray(data) ? data.length : 1,
  };
  const query: Record<string, ReturnType<typeof vi.fn>> & {
    then?: PromiseLike<typeof response>["then"];
  } = {};
  for (const method of [
    "select",
    "eq",
    "ilike",
    "is",
    "lt",
    "lte",
    "gt",
    "gte",
    "neq",
    "in",
    "order",
    "range",
    "limit",
  ]) {
    query[method] = vi.fn(() => query);
  }
  query.maybeSingle = vi.fn(async () => response);
  query.single = vi.fn(async () => response);
  query.then = (onFulfilled, onRejected) =>
    Promise.resolve(response).then(onFulfilled, onRejected);
  const from = vi.fn(() => query);
  return {
    client: { from } as unknown as WorkGridClient,
    from,
    query,
  };
}

describe("tenant-scoped data contracts", () => {
  it("loads projects and tasks by both tenant and resource identifier", async () => {
    const projectQuery = createQueryClient({ id: resourceId });
    await getProject(projectQuery.client, organizationId, resourceId);
    expect(projectQuery.query.eq).toHaveBeenNthCalledWith(
      1,
      "organization_id",
      organizationId,
    );
    expect(projectQuery.query.eq).toHaveBeenNthCalledWith(2, "id", resourceId);

    const taskQuery = createQueryClient({ id: resourceId });
    await getTask(taskQuery.client, organizationId, resourceId);
    expect(taskQuery.query.eq).toHaveBeenNthCalledWith(
      1,
      "organization_id",
      organizationId,
    );
    expect(taskQuery.query.eq).toHaveBeenNthCalledWith(2, "id", resourceId);
  });

  it("rejects malformed resource IDs before they reach the data provider", async () => {
    const projects = createQueryClient({});
    await expect(
      getProject(projects.client, organizationId, "manipulated-id"),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
    expect(projects.from).not.toHaveBeenCalled();

    const tasks = createQueryClient({});
    await expect(
      getTask(tasks.client, organizationId, "../../other-tenant"),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
    expect(tasks.from).not.toHaveBeenCalled();
  });

  it("loads supplemental project labels without leaving the tenant", async () => {
    const projects = createQueryClient([]);
    await listProjectsByIds(projects.client, organizationId, [resourceId]);
    expect(projects.query.eq).toHaveBeenCalledWith(
      "organization_id",
      organizationId,
    );
    expect(projects.query.in).toHaveBeenCalledWith("id", [resourceId]);
  });

  it("scopes comments and ready attachments to the active task and tenant", async () => {
    const comments = createQueryClient([]);
    await listTaskComments(comments.client, organizationId, resourceId, {
      page: 2,
      pageSize: 20,
      from: 20,
      to: 39,
    });
    expect(comments.query.eq).toHaveBeenCalledWith(
      "organization_id",
      organizationId,
    );
    expect(comments.query.eq).toHaveBeenCalledWith("task_id", resourceId);
    expect(comments.query.range).toHaveBeenCalledWith(20, 39);

    const attachments = createQueryClient([]);
    await listTaskAttachments(attachments.client, organizationId, resourceId, {
      page: 3,
      pageSize: 10,
      from: 20,
      to: 29,
    });
    expect(attachments.query.eq).toHaveBeenCalledWith(
      "organization_id",
      organizationId,
    );
    expect(attachments.query.eq).toHaveBeenCalledWith("task_id", resourceId);
    expect(attachments.query.eq).toHaveBeenCalledWith("upload_status", "ready");
    expect(attachments.query.range).toHaveBeenCalledWith(20, 29);
  });

  it("never resolves attachment metadata by an unscoped identifier", async () => {
    const attachment = createQueryClient({ id: resourceId });
    await getAttachment(attachment.client, organizationId, resourceId);
    expect(attachment.query.eq).toHaveBeenNthCalledWith(
      1,
      "organization_id",
      organizationId,
    );
    expect(attachment.query.eq).toHaveBeenNthCalledWith(2, "id", resourceId);
  });

  it("never resolves removed memberships as active organization access", async () => {
    const membership = createQueryClient({ id: resourceId });
    await getMembership(membership.client, organizationId, resourceId);
    expect(membership.query.eq).toHaveBeenCalledWith(
      "organization_id",
      organizationId,
    );
    expect(membership.query.is).toHaveBeenCalledWith("removed_at", null);

    const members = createQueryClient([]);
    await listOrganizationMembers(members.client, organizationId);
    expect(members.query.is).toHaveBeenCalledWith("removed_at", null);

    const assignee = createQueryClient({ id: resourceId });
    await getMembershipByUserId(
      assignee.client,
      organizationId,
      "user_assignee",
    );
    expect(assignee.query.eq).toHaveBeenCalledWith(
      "organization_id",
      organizationId,
    );
    expect(assignee.query.eq).toHaveBeenCalledWith("user_id", "user_assignee");
    expect(assignee.query.is).toHaveBeenCalledWith("removed_at", null);
  });

  it("paginates administrative member and invitation collections in the tenant query", async () => {
    const members = createQueryClient([]);
    await listOrganizationMembersPage(members.client, organizationId, {
      page: 2,
      pageSize: 20,
      from: 20,
      to: 39,
    });
    expect(members.query.eq).toHaveBeenCalledWith(
      "organization_id",
      organizationId,
    );
    expect(members.query.is).toHaveBeenCalledWith("removed_at", null);
    expect(members.query.range).toHaveBeenCalledWith(20, 39);

    const invitations = createQueryClient([]);
    await listActiveInvitationsPage(invitations.client, organizationId, {
      page: 3,
      pageSize: 10,
      from: 20,
      to: 29,
    });
    expect(invitations.query.eq).toHaveBeenCalledWith(
      "organization_id",
      organizationId,
    );
    expect(invitations.query.range).toHaveBeenCalledWith(20, 29);
  });

  it("applies task filters and bounded pagination in the database query", async () => {
    const tasks = createQueryClient([]);
    await listTasks(
      tasks.client,
      organizationId,
      {
        query: "release_100%",
        status: "IN_PROGRESS",
        priority: "URGENT",
        assignee: "user_12345",
        project: resourceId,
        due: "OVERDUE",
        sort: "priority_desc",
      },
      { page: 2, pageSize: 20, from: 20, to: 39 },
    );

    expect(tasks.query.eq).toHaveBeenCalledWith(
      "organization_id",
      organizationId,
    );
    expect(tasks.query.ilike).toHaveBeenCalledWith(
      "title",
      "%release\\_100\\%%",
    );
    expect(tasks.query.eq).toHaveBeenCalledWith("project_id", resourceId);
    expect(tasks.query.lt).toHaveBeenCalledWith("due_date", expect.any(String));
    expect(tasks.query.order).toHaveBeenCalledWith("priority", {
      ascending: false,
    });
    expect(tasks.query.range).toHaveBeenCalledWith(20, 39);
  });

  it("scopes and paginates audit history on the server", async () => {
    const audit = createQueryClient([]);
    await listAuditLogs(audit.client, organizationId, {
      page: 3,
      pageSize: 10,
      from: 20,
      to: 29,
    });
    expect(audit.from).toHaveBeenCalledWith("audit_logs");
    expect(audit.query.eq).toHaveBeenCalledWith(
      "organization_id",
      organizationId,
    );
    expect(audit.query.range).toHaveBeenCalledWith(20, 29);
  });
});

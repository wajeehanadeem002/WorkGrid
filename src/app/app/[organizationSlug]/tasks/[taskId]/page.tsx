import Link from "next/link";
import { Download, Paperclip } from "lucide-react";
import { Breadcrumbs } from "@/components/breadcrumbs";
import { ConfirmAction } from "@/components/confirm-action";
import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/page-header";
import { PermissionGate } from "@/components/permission-gate";
import { StatusBadge } from "@/components/status-badge";
import { AttachmentForm } from "@/features/attachments/attachment-form";
import {
  uploadAttachmentAction,
  deleteAttachmentAction,
} from "@/features/attachments/actions";
import {
  createCommentAction,
  deleteCommentAction,
} from "@/features/comments/actions";
import { CommentForm } from "@/features/comments/comment-form";
import { deleteTaskAction } from "@/features/tasks/actions";
import { resolveOrganizationContext } from "@/lib/auth/server-context";
import { listTaskAttachments } from "@/lib/data/attachments";
import { listTaskComments } from "@/lib/data/comments";
import { getProject } from "@/lib/data/projects";
import { getTask } from "@/lib/data/tasks";
import { formatDate, formatDateTime, isOverdue } from "@/lib/ui/date";
import { parsePagination } from "@/lib/security/pagination";
import { Pagination } from "@/components/pagination";
import { getUserProfiles, userLabel } from "@/lib/auth/user-profiles";

export default async function TaskDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ organizationSlug: string; taskId: string }>;
  searchParams: Promise<{
    created?: string;
    commentDeleted?: string;
    attachmentDeleted?: string;
    commentPage?: string;
    commentPageSize?: string;
    attachmentPage?: string;
    attachmentPageSize?: string;
  }>;
}) {
  const [{ organizationSlug, taskId }, query] = await Promise.all([
    params,
    searchParams,
  ]);
  const { context, client } =
    await resolveOrganizationContext(organizationSlug);
  const task = await getTask(client, context.organization.id, taskId);
  const commentPagination = parsePagination({
    page: query.commentPage,
    pageSize: query.commentPageSize,
  });
  const attachmentPagination = parsePagination({
    page: query.attachmentPage,
    pageSize: query.attachmentPageSize,
  });
  const [project, comments, attachments] = await Promise.all([
    getProject(client, context.organization.id, task.project_id),
    listTaskComments(
      client,
      context.organization.id,
      task.id,
      commentPagination,
    ),
    listTaskAttachments(
      client,
      context.organization.id,
      task.id,
      attachmentPagination,
    ),
  ]);
  const overdue = isOverdue(task.due_date, task.status);
  const profiles = await getUserProfiles([
    task.reporter_id,
    ...(task.assignee_id ? [task.assignee_id] : []),
    ...comments.items.map((comment) => comment.author_id),
    ...attachments.items.map((attachment) => attachment.uploaded_by),
  ]);
  return (
    <div className="page">
      <Breadcrumbs
        items={[
          { label: "Tasks", href: `/app/${organizationSlug}/tasks` },
          { label: task.title },
        ]}
      />
      <PageHeader
        title={task.title}
        description={`${project.key} · Updated ${formatDateTime(task.updated_at)}`}
        actions={
          <Link
            className="button button--secondary"
            href={`/app/${organizationSlug}/tasks/${task.id}/edit`}
          >
            Edit task
          </Link>
        }
      />
      {query.created ? (
        <div className="flash flash--success" role="status">
          Task created.
        </div>
      ) : null}
      {query.commentDeleted ? (
        <div className="flash flash--success" role="status">
          Comment deleted.
        </div>
      ) : null}
      {query.attachmentDeleted ? (
        <div className="flash flash--success" role="status">
          Attachment deleted.
        </div>
      ) : null}
      <div className="detail-grid">
        <section className="card">
          <div className="card__header">
            <h2>Description</h2>
            <StatusBadge value={task.status} />
          </div>
          <div className="card__body">
            <p className="description">
              {task.description || "No description has been added."}
            </p>
          </div>
        </section>
        <aside className="card">
          <div className="card__header">
            <h2>Task details</h2>
          </div>
          <div className="card__body">
            <dl className="detail-list">
              <div>
                <dt>Project</dt>
                <dd>
                  <Link
                    href={`/app/${organizationSlug}/projects/${project.id}`}
                  >
                    {project.key}
                  </Link>
                </dd>
              </div>
              <div>
                <dt>Priority</dt>
                <dd>
                  <StatusBadge value={task.priority} />
                </dd>
              </div>
              <div>
                <dt>Assignee</dt>
                <dd>
                  {task.assignee_id
                    ? userLabel(profiles, task.assignee_id, context.userId)
                    : "Unassigned"}
                </dd>
              </div>
              <div>
                <dt>Reporter</dt>
                <dd>{userLabel(profiles, task.reporter_id, context.userId)}</dd>
              </div>
              <div>
                <dt>Due date</dt>
                <dd>
                  {overdue ? (
                    <span className="badge badge--overdue">
                      {formatDate(task.due_date)}
                    </span>
                  ) : (
                    formatDate(task.due_date)
                  )}
                </dd>
              </div>
            </dl>
          </div>
        </aside>
      </div>
      <div className="dashboard-grid" style={{ marginTop: "1rem" }}>
        <section className="card">
          <div className="card__header">
            <h2>Comments</h2>
            <span>{comments.total}</span>
          </div>
          <div className="card__body">
            <CommentForm
              action={createCommentAction.bind(null, organizationSlug, task.id)}
            />
            {comments.items.length ? (
              comments.items.map((comment) => (
                <article className="comment" key={comment.id}>
                  <div className="comment__meta">
                    <span>
                      {userLabel(profiles, comment.author_id, context.userId)}
                    </span>
                    <time dateTime={comment.created_at}>
                      {formatDateTime(comment.created_at)}
                    </time>
                  </div>
                  <p className="comment__body">{comment.body}</p>
                  {comment.author_id === context.userId ||
                  context.membership.role !== "member" ? (
                    <div style={{ marginTop: ".5rem" }}>
                      <ConfirmAction
                        title="Delete this comment?"
                        description="This permanently removes the comment from the task history."
                        triggerLabel="Delete comment"
                        confirmLabel="Delete comment"
                        action={deleteCommentAction.bind(
                          null,
                          organizationSlug,
                          task.id,
                          comment.id,
                        )}
                      />
                    </div>
                  ) : null}
                </article>
              ))
            ) : (
              <p style={{ color: "var(--muted)" }}>
                No comments yet. Add context or an update above.
              </p>
            )}
            <Pagination
              page={comments.page}
              pageSize={comments.pageSize}
              total={comments.total}
              pageParam="commentPage"
              pageSizeParam="commentPageSize"
              query={{
                attachmentPage: query.attachmentPage,
                attachmentPageSize: query.attachmentPageSize,
              }}
            />
          </div>
        </section>
        <section className="card">
          <div className="card__header">
            <h2>Attachments</h2>
            <Paperclip size={18} aria-hidden="true" />
          </div>
          <div className="card__body">
            <AttachmentForm
              action={uploadAttachmentAction.bind(
                null,
                organizationSlug,
                task.id,
              )}
            />
            {attachments.items.length ? (
              <ul className="activity-list" style={{ marginTop: "1rem" }}>
                {attachments.items.map((attachment) => (
                  <li className="activity-item" key={attachment.id}>
                    <span className="activity-dot" />
                    <div>
                      <p>{attachment.original_name}</p>
                      <span className="data-table__secondary">
                        {Math.ceil(attachment.size_bytes / 1024)} KB
                      </span>
                      <div
                        style={{
                          display: "flex",
                          gap: ".5rem",
                          marginTop: ".45rem",
                        }}
                      >
                        <Link
                          className="button button--secondary button--small"
                          href={`/api/organizations/${context.organization.id}/attachments/${attachment.id}`}
                        >
                          <Download size={14} /> Download
                        </Link>
                        {attachment.uploaded_by === context.userId ||
                        context.membership.role !== "member" ? (
                          <ConfirmAction
                            title="Delete this attachment?"
                            description="This permanently removes the private file and its metadata."
                            triggerLabel="Delete"
                            confirmLabel="Delete attachment"
                            action={deleteAttachmentAction.bind(
                              null,
                              organizationSlug,
                              task.id,
                              attachment.id,
                            )}
                          />
                        ) : null}
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <EmptyState
                title="No attachments"
                description="Add a supporting document or image when it helps move this task forward."
              />
            )}
            <Pagination
              page={attachments.page}
              pageSize={attachments.pageSize}
              total={attachments.total}
              pageParam="attachmentPage"
              pageSizeParam="attachmentPageSize"
              query={{
                commentPage: query.commentPage,
                commentPageSize: query.commentPageSize,
              }}
            />
          </div>
        </section>
      </div>
      <PermissionGate role={context.membership.role} permission="task:delete">
        <section className="card danger-zone" style={{ marginTop: "1rem" }}>
          <div className="card__header">
            <h2>Danger zone</h2>
          </div>
          <div className="card__body">
            <p>
              Deleting a task requires its comments and attachments to be
              removed first.
            </p>
            <ConfirmAction
              title="Delete this task?"
              description="This permanently removes the task when no related records remain."
              triggerLabel="Delete task"
              confirmLabel="Delete task"
              action={deleteTaskAction.bind(null, organizationSlug, task.id)}
            />
          </div>
        </section>
      </PermissionGate>
    </div>
  );
}

import { Breadcrumbs } from "@/components/breadcrumbs";
import { ConfirmAction } from "@/components/confirm-action";
import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/page-header";
import { Pagination } from "@/components/pagination";
import { StatusBadge } from "@/components/status-badge";
import {
  changeMemberRoleAction,
  inviteMemberAction,
  removeMemberDirectAction,
  revokeInvitationAction,
} from "@/features/organizations/actions";
import { InvitationForm } from "@/features/organizations/invitation-form";
import { MemberRoleForm } from "@/features/organizations/member-role-form";
import { canRemoveMember } from "@/lib/auth/permissions";
import { resolveOrganizationContext } from "@/lib/auth/server-context";
import {
  listActiveInvitationsPage,
  listOrganizationMembersPage,
} from "@/lib/data/organizations";
import { formatDateTime } from "@/lib/ui/date";
import { getUserProfiles, userLabel } from "@/lib/auth/user-profiles";
import { parsePagination } from "@/lib/security/pagination";
import { firstParam, type SearchParams } from "@/lib/ui/search-params";

export default async function MembersPage({
  params,
  searchParams,
}: {
  params: Promise<{ organizationSlug: string }>;
  searchParams: Promise<SearchParams>;
}) {
  const [{ organizationSlug }, notices] = await Promise.all([
    params,
    searchParams,
  ]);
  const { context, client } =
    await resolveOrganizationContext(organizationSlug);
  const memberPagination = parsePagination({
    page: notices.memberPage,
    pageSize: notices.memberPageSize,
  });
  const invitationPagination = parsePagination({
    page: notices.invitationPage,
    pageSize: notices.invitationPageSize,
  });
  const [memberResult, invitationResult] = await Promise.all([
    listOrganizationMembersPage(
      client,
      context.organization.id,
      memberPagination,
    ),
    context.membership.role === "member"
      ? Promise.resolve({
          items: [],
          total: 0,
          page: invitationPagination.page,
          pageSize: invitationPagination.pageSize,
        })
      : listActiveInvitationsPage(
          client,
          context.organization.id,
          invitationPagination,
        ),
  ]);
  const members = memberResult.items;
  const invitations = invitationResult.items;
  const profiles = await getUserProfiles(
    members.map((member) => member.user_id),
  );
  return (
    <div className="page">
      <Breadcrumbs items={[{ label: "Members" }]} />
      <PageHeader
        eyebrow="Organization"
        title="Members"
        description="Manage access without weakening the organization boundary."
      />
      {notices.removed ? (
        <div className="flash flash--success" role="status">
          Member removed.
        </div>
      ) : null}
      {notices.revoked ? (
        <div className="flash flash--success" role="status">
          Invitation revoked.
        </div>
      ) : null}
      {context.membership.role !== "member" ? (
        <section style={{ marginBottom: "1rem" }}>
          <InvitationForm
            action={inviteMemberAction.bind(null, organizationSlug)}
            canInviteAdmin={context.membership.role === "owner"}
          />
        </section>
      ) : null}
      <section className="card">
        <div className="card__header">
          <h2>Organization members</h2>
          <span>{memberResult.total}</span>
        </div>
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>Account</th>
                <th>Role</th>
                <th>Joined</th>
                <th>
                  <span className="sr-only">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {members.map((member) => {
                const isSelf = member.user_id === context.userId;
                return (
                  <tr key={member.id}>
                    <td>
                      <strong>
                        {userLabel(profiles, member.user_id, context.userId)}
                      </strong>
                      <span className="data-table__secondary">
                        {profiles.get(member.user_id)?.secondary ??
                          `Account ...${member.user_id.slice(-6)}`}
                      </span>
                    </td>
                    <td>
                      <StatusBadge value={member.role} />
                    </td>
                    <td>{formatDateTime(member.created_at)}</td>
                    <td>
                      {context.membership.role === "owner" &&
                      member.role !== "owner" &&
                      !isSelf ? (
                        <MemberRoleForm
                          membershipId={member.id}
                          role={member.role}
                          action={changeMemberRoleAction.bind(
                            null,
                            organizationSlug,
                          )}
                        />
                      ) : null}
                      {canRemoveMember(
                        context.membership.role,
                        member.role,
                        isSelf,
                      ) ? (
                        <div style={{ marginTop: ".5rem" }}>
                          <ConfirmAction
                            title="Remove this member?"
                            description="They will immediately lose access to this organization. Their authored history remains."
                            triggerLabel="Remove"
                            confirmLabel="Remove member"
                            action={removeMemberDirectAction.bind(
                              null,
                              organizationSlug,
                              member.id,
                            )}
                          />
                        </div>
                      ) : null}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <div className="responsive-card-list">
          {members.map((member) => {
            const isSelf = member.user_id === context.userId;
            return (
              <article className="responsive-data-card" key={member.id}>
                <div className="responsive-data-card__header">
                  <strong>
                    {userLabel(profiles, member.user_id, context.userId)}
                  </strong>
                  <StatusBadge value={member.role} />
                </div>
                <dl>
                  <div>
                    <dt>Joined</dt>
                    <dd>{formatDateTime(member.created_at)}</dd>
                  </div>
                </dl>
                {context.membership.role === "owner" &&
                member.role !== "owner" &&
                !isSelf ? (
                  <div className="responsive-data-card__actions">
                    <MemberRoleForm
                      membershipId={member.id}
                      role={member.role}
                      action={changeMemberRoleAction.bind(
                        null,
                        organizationSlug,
                      )}
                    />
                  </div>
                ) : null}
                {canRemoveMember(
                  context.membership.role,
                  member.role,
                  isSelf,
                ) ? (
                  <div className="responsive-data-card__actions">
                    <ConfirmAction
                      title="Remove this member?"
                      description="They will immediately lose access to this organization. Their authored history remains."
                      triggerLabel="Remove"
                      confirmLabel="Remove member"
                      action={removeMemberDirectAction.bind(
                        null,
                        organizationSlug,
                        member.id,
                      )}
                    />
                  </div>
                ) : null}
              </article>
            );
          })}
        </div>
        <div className="card__body">
          <Pagination
            page={memberResult.page}
            pageSize={memberResult.pageSize}
            total={memberResult.total}
            pageParam="memberPage"
            pageSizeParam="memberPageSize"
            query={{
              invitationPage: firstParam(notices.invitationPage) || undefined,
              invitationPageSize:
                firstParam(notices.invitationPageSize) || undefined,
            }}
          />
        </div>
      </section>
      {context.membership.role !== "member" ? (
        <section className="card" style={{ marginTop: "1rem" }}>
          <div className="card__header">
            <h2>Pending invitations</h2>
            <span>{invitationResult.total}</span>
          </div>
          {invitations.length ? (
            <div className="table-wrap">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Email</th>
                    <th>Role</th>
                    <th>Expires</th>
                    <th>
                      <span className="sr-only">Actions</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {invitations.map((invitation) => (
                    <tr key={invitation.id}>
                      <td>{invitation.email ?? "Bearer link"}</td>
                      <td>
                        <StatusBadge value={invitation.role} />
                      </td>
                      <td>{formatDateTime(invitation.expires_at)}</td>
                      <td>
                        {context.membership.role === "owner" ||
                        invitation.role === "member" ? (
                          <ConfirmAction
                            title="Revoke this invitation?"
                            description="The invitation link will stop working immediately."
                            triggerLabel="Revoke"
                            confirmLabel="Revoke invitation"
                            action={revokeInvitationAction.bind(
                              null,
                              organizationSlug,
                              invitation.id,
                            )}
                          />
                        ) : null}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div className="responsive-card-list">
                {invitations.map((invitation) => (
                  <article className="responsive-data-card" key={invitation.id}>
                    <div className="responsive-data-card__header">
                      <strong>{invitation.email ?? "Bearer link"}</strong>
                      <StatusBadge value={invitation.role} />
                    </div>
                    <dl>
                      <div>
                        <dt>Expires</dt>
                        <dd>{formatDateTime(invitation.expires_at)}</dd>
                      </div>
                    </dl>
                    {context.membership.role === "owner" ||
                    invitation.role === "member" ? (
                      <div className="responsive-data-card__actions">
                        <ConfirmAction
                          title="Revoke this invitation?"
                          description="The invitation link will stop working immediately."
                          triggerLabel="Revoke"
                          confirmLabel="Revoke invitation"
                          action={revokeInvitationAction.bind(
                            null,
                            organizationSlug,
                            invitation.id,
                          )}
                        />
                      </div>
                    ) : null}
                  </article>
                ))}
              </div>
            </div>
          ) : (
            <EmptyState
              title="No pending invitations"
              description="New invitation links appear here until accepted, revoked, or expired."
            />
          )}
          <div className="card__body">
            <Pagination
              page={invitationResult.page}
              pageSize={invitationResult.pageSize}
              total={invitationResult.total}
              pageParam="invitationPage"
              pageSizeParam="invitationPageSize"
              query={{
                memberPage: firstParam(notices.memberPage) || undefined,
                memberPageSize: firstParam(notices.memberPageSize) || undefined,
              }}
            />
          </div>
        </section>
      ) : null}
    </div>
  );
}

"use client";

import { useActionState } from "react";
import { acceptInvitationAction } from "./actions";
import { FormFeedback } from "@/components/form-feedback";
import { SubmitButton } from "@/components/submit-button";
import { initialActionState } from "@/lib/security/errors";

export function AcceptInvitationForm({
  token,
  organizationName,
  email,
  role,
  expiresAt,
}: {
  token: string;
  organizationName: string;
  email: string;
  role: "member" | "admin";
  expiresAt: string;
}) {
  const action = acceptInvitationAction.bind(null, token);
  const [state, formAction] = useActionState(action, initialActionState);
  return (
    <form action={formAction} className="form-card">
      <FormFeedback state={state} />
      <dl className="detail-list">
        <div>
          <dt>Organization</dt>
          <dd>{organizationName}</dd>
        </div>
        <div>
          <dt>Invited email</dt>
          <dd>{email}</dd>
        </div>
        <div>
          <dt>Role</dt>
          <dd style={{ textTransform: "capitalize" }}>{role}</dd>
        </div>
        <div>
          <dt>Expires</dt>
          <dd>{new Date(expiresAt).toLocaleString()}</dd>
        </div>
      </dl>
      <p>
        Invitation links are single-use and bound to the verified email shown
        above.
      </p>
      <div className="form-actions">
        <SubmitButton pendingLabel="Joining organization…">
          Accept invitation
        </SubmitButton>
      </div>
    </form>
  );
}

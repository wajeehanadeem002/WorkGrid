"use client";

import { useActionState } from "react";
import type { ActionState } from "@/lib/security/errors";
import { initialActionState } from "@/lib/security/errors";
import { FormFeedback } from "@/components/form-feedback";
import { FieldError } from "@/components/field-error";
import { SubmitButton } from "@/components/submit-button";

export function InvitationForm({
  action,
  canInviteAdmin,
}: {
  action: (state: ActionState, formData: FormData) => Promise<ActionState>;
  canInviteAdmin: boolean;
}) {
  const [state, formAction] = useActionState(action, initialActionState);
  return (
    <form action={formAction} className="form-card" noValidate>
      <FormFeedback state={state} />
      {state.data?.invitationUrl ? (
        <div className="field">
          <label htmlFor="invitation-url">One-time invitation link</label>
          <input
            id="invitation-url"
            readOnly
            value={state.data.invitationUrl}
            onFocus={(event) => event.currentTarget.select()}
          />
        </div>
      ) : null}
      <div className="form-grid form-grid--two">
        <div className="field">
          <label htmlFor="invite-email">Email address</label>
          <input
            id="invite-email"
            name="email"
            type="email"
            required
            autoComplete="email"
            aria-describedby="invite-email-error"
            aria-invalid={Boolean(state.fieldErrors?.email)}
          />
          <FieldError
            id="invite-email-error"
            errors={state.fieldErrors?.email}
          />
        </div>
        <div className="field">
          <label htmlFor="invite-role">Role</label>
          <select
            id="invite-role"
            name="role"
            defaultValue="member"
            aria-describedby="invite-role-error"
            aria-invalid={Boolean(state.fieldErrors?.role)}
          >
            <option value="member">Member</option>
            {canInviteAdmin ? <option value="admin">Admin</option> : null}
          </select>
          <FieldError id="invite-role-error" errors={state.fieldErrors?.role} />
        </div>
      </div>
      <div className="form-actions">
        <SubmitButton pendingLabel="Creating invitation…">
          Create invitation
        </SubmitButton>
      </div>
    </form>
  );
}

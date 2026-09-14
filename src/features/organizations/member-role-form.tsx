"use client";

import { useActionState } from "react";
import { FormFeedback } from "@/components/form-feedback";
import { SubmitButton } from "@/components/submit-button";
import { initialActionState, type ActionState } from "@/lib/security/errors";
import type { Role } from "@/lib/auth/permissions";

export function MemberRoleForm({
  membershipId,
  role,
  action,
}: {
  membershipId: string;
  role: Role;
  action: (state: ActionState, formData: FormData) => Promise<ActionState>;
}) {
  const [state, formAction] = useActionState(action, initialActionState);
  return (
    <form action={formAction} className="inline-form">
      <input type="hidden" name="membershipId" value={membershipId} />
      <div className="field">
        <label className="field-help" htmlFor={`role-${membershipId}`}>
          Change role
        </label>
        <select id={`role-${membershipId}`} name="role" defaultValue={role}>
          <option value="member">Member</option>
          <option value="admin">Admin</option>
        </select>
      </div>
      <SubmitButton
        className="button button--secondary button--small"
        pendingLabel="Saving…"
      >
        Update
      </SubmitButton>
      <FormFeedback state={state} />
    </form>
  );
}

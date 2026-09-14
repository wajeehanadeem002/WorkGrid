"use client";

import { useActionState } from "react";
import { FormFeedback } from "@/components/form-feedback";
import { FieldError } from "@/components/field-error";
import { SubmitButton } from "@/components/submit-button";
import { initialActionState, type ActionState } from "@/lib/security/errors";

export function CommentForm({
  action,
}: {
  action: (state: ActionState, formData: FormData) => Promise<ActionState>;
}) {
  const [state, formAction] = useActionState(action, initialActionState);
  return (
    <form
      action={formAction}
      className="form-card"
      style={{ boxShadow: "none", maxWidth: "none" }}
    >
      <FormFeedback state={state} />
      <div className="field">
        <label htmlFor="comment-body">Add a comment</label>
        <textarea
          id="comment-body"
          name="body"
          required
          maxLength={5000}
          rows={4}
          aria-describedby="comment-body-error"
          aria-invalid={Boolean(state.fieldErrors?.body)}
          placeholder="Share context, a decision, or an update…"
        />
        <FieldError id="comment-body-error" errors={state.fieldErrors?.body} />
      </div>
      <div className="form-actions">
        <SubmitButton pendingLabel="Adding comment…">Add comment</SubmitButton>
      </div>
    </form>
  );
}

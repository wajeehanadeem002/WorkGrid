"use client";

import { useActionState } from "react";
import { FormFeedback } from "@/components/form-feedback";
import { SubmitButton } from "@/components/submit-button";
import { initialActionState, type ActionState } from "@/lib/security/errors";

export function AttachmentForm({
  action,
}: {
  action: (state: ActionState, formData: FormData) => Promise<ActionState>;
}) {
  const [state, formAction] = useActionState(action, initialActionState);
  return (
    <form action={formAction} className="inline-form">
      <div className="field" style={{ flex: 1 }}>
        <label htmlFor="attachment-file">Upload attachment</label>
        <input
          id="attachment-file"
          name="file"
          type="file"
          required
          accept=".pdf,.txt,.csv,.png,.jpg,.jpeg,.gif,.webp,application/pdf,text/plain,text/csv,image/png,image/jpeg,image/gif,image/webp"
        />
        <p className="field-help">
          PDF, text, CSV, PNG, JPEG, GIF, or WebP. Maximum 4 MB.
        </p>
      </div>
      <SubmitButton pendingLabel="Uploading…">Upload</SubmitButton>
      <FormFeedback state={state} />
    </form>
  );
}

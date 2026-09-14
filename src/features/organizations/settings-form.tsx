"use client";

import { useActionState } from "react";
import type { ActionState } from "@/lib/security/errors";
import { initialActionState } from "@/lib/security/errors";
import { FieldError } from "@/components/field-error";
import { FormFeedback } from "@/components/form-feedback";
import { SubmitButton } from "@/components/submit-button";

export function OrganizationSettingsForm({
  action,
  name,
  disabled,
}: {
  action: (state: ActionState, formData: FormData) => Promise<ActionState>;
  name: string;
  disabled: boolean;
}) {
  const [state, formAction] = useActionState(action, initialActionState);
  return (
    <form action={formAction} className="form-card" noValidate>
      <FormFeedback state={state} />
      <div className="field">
        <label htmlFor="organization-name">Organization name</label>
        <input
          id="organization-name"
          name="name"
          required
          minLength={2}
          maxLength={80}
          defaultValue={name}
          disabled={disabled}
          aria-describedby="organization-name-error"
          aria-invalid={Boolean(state.fieldErrors?.name)}
        />
        <FieldError
          id="organization-name-error"
          errors={state.fieldErrors?.name}
        />
      </div>
      <div className="form-actions">
        <SubmitButton pendingLabel="Saving settings…">
          Save settings
        </SubmitButton>
      </div>
    </form>
  );
}

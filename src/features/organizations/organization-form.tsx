"use client";

import { useActionState } from "react";
import { createOrganizationAction } from "./actions";
import { FieldError } from "@/components/field-error";
import { FormFeedback } from "@/components/form-feedback";
import { SubmitButton } from "@/components/submit-button";
import { initialActionState } from "@/lib/security/errors";

export function OrganizationForm() {
  const [state, action] = useActionState(
    createOrganizationAction,
    initialActionState,
  );
  return (
    <form action={action} className="form-card" noValidate>
      <FormFeedback state={state} />
      <div className="field">
        <label htmlFor="organization-name">Organization name</label>
        <input
          id="organization-name"
          name="name"
          required
          minLength={2}
          maxLength={80}
          autoComplete="organization"
          aria-describedby="organization-name-error"
          aria-invalid={Boolean(state.fieldErrors?.name)}
        />
        <FieldError
          id="organization-name-error"
          errors={state.fieldErrors?.name}
        />
      </div>
      <div className="field">
        <label htmlFor="organization-slug">Workspace URL</label>
        <div style={{ display: "flex", alignItems: "center", gap: ".5rem" }}>
          <span style={{ color: "var(--muted)" }}>/app/</span>
          <input
            id="organization-slug"
            name="slug"
            required
            minLength={2}
            maxLength={50}
            pattern="[a-z0-9]+(?:-[a-z0-9]+)*"
            placeholder="northstar-team"
            aria-describedby="organization-slug-help organization-slug-error"
            aria-invalid={Boolean(state.fieldErrors?.slug)}
          />
        </div>
        <p id="organization-slug-help" className="field-help">
          Lowercase letters, numbers, and hyphens. This cannot be changed later.
        </p>
        <FieldError
          id="organization-slug-error"
          errors={state.fieldErrors?.slug}
        />
      </div>
      <div className="form-actions">
        <SubmitButton pendingLabel="Creating workspace…">
          Create organization
        </SubmitButton>
      </div>
    </form>
  );
}

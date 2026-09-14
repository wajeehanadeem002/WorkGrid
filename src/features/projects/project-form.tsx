"use client";

import { useActionState } from "react";
import type { Project } from "@/types/domain";
import type { ActionState } from "@/lib/security/errors";
import { initialActionState } from "@/lib/security/errors";
import { FieldError } from "@/components/field-error";
import { FormFeedback } from "@/components/form-feedback";
import { SubmitButton } from "@/components/submit-button";

export function ProjectForm({
  action,
  project,
}: {
  action: (state: ActionState, formData: FormData) => Promise<ActionState>;
  project?: Project;
}) {
  const [state, formAction] = useActionState(action, initialActionState);
  return (
    <form action={formAction} className="form-card" noValidate>
      <FormFeedback state={state} />
      <div className="form-grid form-grid--two">
        <div className="field">
          <label htmlFor="project-name">Project name</label>
          <input
            id="project-name"
            name="name"
            required
            minLength={2}
            maxLength={100}
            defaultValue={project?.name}
            aria-describedby="project-name-error"
            aria-invalid={Boolean(state.fieldErrors?.name)}
          />
          <FieldError
            id="project-name-error"
            errors={state.fieldErrors?.name}
          />
        </div>
        <div className="field">
          <label htmlFor="project-key">Project key</label>
          <input
            id="project-key"
            name="key"
            required
            minLength={2}
            maxLength={10}
            defaultValue={project?.key}
            autoCapitalize="characters"
            aria-describedby="project-key-help project-key-error"
            aria-invalid={Boolean(state.fieldErrors?.key)}
          />
          <p className="field-help" id="project-key-help">
            2–10 letters or numbers, used in task references.
          </p>
          <FieldError id="project-key-error" errors={state.fieldErrors?.key} />
        </div>
      </div>
      <div className="field">
        <label htmlFor="project-description">Description</label>
        <textarea
          id="project-description"
          name="description"
          rows={6}
          maxLength={5000}
          defaultValue={project?.description}
          aria-describedby="project-description-error"
          aria-invalid={Boolean(state.fieldErrors?.description)}
        />
        <FieldError
          id="project-description-error"
          errors={state.fieldErrors?.description}
        />
      </div>
      <div className="field">
        <label htmlFor="project-form-status">Status</label>
        <select
          id="project-form-status"
          name="status"
          defaultValue={project?.status ?? "PLANNED"}
          aria-describedby="project-status-error"
          aria-invalid={Boolean(state.fieldErrors?.status)}
        >
          <option value="PLANNED">Planned</option>
          <option value="ACTIVE">Active</option>
          <option value="ON_HOLD">On hold</option>
          <option value="COMPLETED">Completed</option>
          <option value="ARCHIVED">Archived</option>
        </select>
        <FieldError
          id="project-status-error"
          errors={state.fieldErrors?.status}
        />
      </div>
      <div className="form-actions">
        <SubmitButton pendingLabel="Saving project…">
          {project ? "Save changes" : "Create project"}
        </SubmitButton>
      </div>
    </form>
  );
}

"use client";

import { useActionState, useId, useRef } from "react";
import { FormFeedback } from "./form-feedback";
import { SubmitButton } from "./submit-button";
import { initialActionState, type ActionState } from "@/lib/security/errors";

export function ConfirmAction({
  title,
  description,
  action,
  triggerLabel,
  confirmLabel,
}: {
  title: string;
  description: string;
  action: (state: ActionState, formData: FormData) => Promise<ActionState>;
  triggerLabel: string;
  confirmLabel: string;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [state, formAction, pending] = useActionState(
    action,
    initialActionState,
  );
  const titleId = useId();
  const descriptionId = useId();
  return (
    <>
      <button
        type="button"
        className="button button--danger button--small"
        disabled={pending}
        onClick={() => dialogRef.current?.showModal()}
      >
        {triggerLabel}
      </button>
      <dialog
        ref={dialogRef}
        className="confirm-dialog"
        aria-labelledby={titleId}
        aria-describedby={descriptionId}
        aria-busy={pending}
        onCancel={(event) => {
          if (pending) event.preventDefault();
        }}
      >
        <div className="confirm-dialog__content">
          <h2 id={titleId}>{title}</h2>
          <p id={descriptionId}>{description}</p>
          <FormFeedback state={state} />
          <div className="confirm-dialog__actions">
            <button
              className="button button--secondary"
              type="button"
              disabled={pending}
              onClick={() => dialogRef.current?.close()}
            >
              Cancel
            </button>
            <form action={formAction}>
              <SubmitButton
                className="button button--danger"
                pendingLabel="Working…"
              >
                {confirmLabel}
              </SubmitButton>
            </form>
          </div>
        </div>
      </dialog>
    </>
  );
}

import type { ActionState } from "@/lib/security/errors";

export function FormFeedback({ state }: { state: ActionState }) {
  if (!state.message || state.status === "idle") return null;
  return (
    <div
      className={
        state.status === "error"
          ? "form-message form-message--error"
          : "form-message form-message--success"
      }
      role={state.status === "error" ? "alert" : "status"}
      aria-live="polite"
    >
      <p>{state.message}</p>
      {state.requestId ? <small>Reference: {state.requestId}</small> : null}
    </div>
  );
}

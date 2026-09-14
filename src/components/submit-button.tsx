"use client";

import { useFormStatus } from "react-dom";
import { LoaderCircle } from "lucide-react";

export function SubmitButton({
  children,
  pendingLabel = "Saving…",
  className = "button button--primary",
}: {
  children: React.ReactNode;
  pendingLabel?: string;
  className?: string;
}) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      className={className}
      disabled={pending}
      aria-disabled={pending}
    >
      {pending ? (
        <LoaderCircle className="spin" size={16} aria-hidden="true" />
      ) : null}
      {pending ? pendingLabel : children}
    </button>
  );
}

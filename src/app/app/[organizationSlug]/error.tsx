"use client";

import { useEffect } from "react";

export default function WorkspaceError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Workspace route error", { digest: error.digest });
  }, [error]);
  return (
    <div className="page">
      <section className="empty-state">
        <h1>We couldn’t load this workspace</h1>
        <p>Your data was not changed. Try the request again.</p>
        <div className="empty-state__action">
          <button className="button button--primary" onClick={reset}>
            Try again
          </button>
        </div>
      </section>
    </div>
  );
}

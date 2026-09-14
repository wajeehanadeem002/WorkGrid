"use client";

import { useEffect } from "react";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("WorkGrid route error", { digest: error.digest });
  }, [error]);
  return (
    <main id="main-content" className="page">
      <section className="empty-state">
        <h1>We couldn’t load this page</h1>
        <p>
          The problem has been recorded. Try again, or return to your workspace.
        </p>
        <div className="empty-state__action">
          <button className="button button--primary" onClick={reset}>
            Try again
          </button>
        </div>
      </section>
    </main>
  );
}

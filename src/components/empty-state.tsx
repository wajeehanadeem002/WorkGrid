import type { ReactNode } from "react";
import { Inbox } from "lucide-react";

export function EmptyState({
  title,
  description,
  action,
}: {
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <section className="empty-state" aria-labelledby="empty-state-title">
      <span className="empty-state__icon" aria-hidden="true">
        <Inbox size={22} />
      </span>
      <h2 id="empty-state-title">{title}</h2>
      <p>{description}</p>
      {action ? <div className="empty-state__action">{action}</div> : null}
    </section>
  );
}

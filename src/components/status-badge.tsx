import { cn } from "@/lib/ui/cn";

const labels: Record<string, string> = {
  PLANNED: "Planned",
  ACTIVE: "Active",
  ON_HOLD: "On hold",
  COMPLETED: "Completed",
  ARCHIVED: "Archived",
  TODO: "To do",
  IN_PROGRESS: "In progress",
  IN_REVIEW: "In review",
  DONE: "Done",
  LOW: "Low",
  MEDIUM: "Medium",
  HIGH: "High",
  URGENT: "Urgent",
  member: "Member",
  admin: "Admin",
  owner: "Owner",
};

const modifiers: Record<string, string> = {
  ACTIVE: "badge--active",
  COMPLETED: "badge--done",
  DONE: "badge--done",
  LOW: "badge--low",
  IN_PROGRESS: "badge--progress",
  IN_REVIEW: "badge--review",
  ON_HOLD: "badge--hold",
  HIGH: "badge--high",
  URGENT: "badge--urgent",
  owner: "badge--progress",
  admin: "badge--active",
};

export function StatusBadge({ value }: { value: string }) {
  return (
    <span className={cn("badge", modifiers[value])}>
      {labels[value] ?? value}
    </span>
  );
}

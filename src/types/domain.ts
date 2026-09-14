import type { Tables } from "@/lib/supabase/database.types";

export type Organization = Tables<"organizations">;
export type OrganizationMember = Tables<"organization_members">;
export type OrganizationInvitation = Tables<"organization_invitations">;
export type Project = Tables<"projects">;
export type Task = Tables<"tasks">;
export type Comment = Tables<"comments">;
export type Attachment = Tables<"attachments">;
export type AuditLog = Tables<"audit_logs">;

export interface PageResult<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
}

export interface DashboardMetrics {
  projectCount: number;
  totalTasks: number;
  completedTasks: number;
  overdueTasks: number;
  assignedTasks: number;
  progressPercent: number;
  statusCounts: Record<"TODO" | "IN_PROGRESS" | "IN_REVIEW" | "DONE", number>;
}

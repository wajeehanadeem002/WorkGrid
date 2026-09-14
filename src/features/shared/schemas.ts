import { z } from "zod";

export const uuidSchema = z.uuid("Invalid resource identifier.");

const trimmedText = (minimum: number, maximum: number, label: string) =>
  z
    .string()
    .trim()
    .min(minimum, `${label} is required.`)
    .max(maximum, `${label} must be ${maximum} characters or fewer.`);

const emptyToNullDate = z.preprocess(
  (value) => (value === "" || value === undefined ? null : value),
  z.iso.date("Use a valid date.").nullable(),
);

export const organizationSchema = z.object({
  name: trimmedText(2, 80, "Organization name"),
  slug: z
    .string()
    .trim()
    .toLowerCase()
    .min(2, "Slug is required.")
    .max(50, "Slug must be 50 characters or fewer.")
    .regex(
      /^[a-z0-9]+(?:-[a-z0-9]+)*$/,
      "Use lowercase letters, numbers, and single hyphens.",
    ),
});

export const organizationSettingsSchema = organizationSchema.pick({
  name: true,
});

export const projectStatuses = [
  "PLANNED",
  "ACTIVE",
  "ON_HOLD",
  "COMPLETED",
  "ARCHIVED",
] as const;
export const taskStatuses = [
  "TODO",
  "IN_PROGRESS",
  "IN_REVIEW",
  "DONE",
] as const;
export const taskPriorities = ["LOW", "MEDIUM", "HIGH", "URGENT"] as const;

export const projectSchema = z.object({
  name: trimmedText(2, 100, "Project name"),
  key: z
    .string()
    .trim()
    .toUpperCase()
    .regex(
      /^[A-Z][A-Z0-9]{1,9}$/,
      "Use 2–10 uppercase letters or numbers, starting with a letter.",
    ),
  description: z
    .string()
    .trim()
    .max(5000, "Description must be 5,000 characters or fewer.")
    .default(""),
  status: z.enum(projectStatuses).default("PLANNED"),
});

export const taskSchema = z.object({
  projectId: uuidSchema,
  title: trimmedText(2, 200, "Task title"),
  description: z
    .string()
    .trim()
    .max(20_000, "Description must be 20,000 characters or fewer.")
    .default(""),
  status: z.enum(taskStatuses).default("TODO"),
  priority: z.enum(taskPriorities).default("MEDIUM"),
  assigneeId: z.preprocess(
    (value) => (value === "" || value === undefined ? null : value),
    z.string().min(5).max(255).nullable(),
  ),
  dueDate: emptyToNullDate,
});

export const commentSchema = z.object({
  body: trimmedText(1, 5000, "Comment"),
});

export const invitationSchema = z.object({
  email: z
    .string()
    .trim()
    .toLowerCase()
    .email("Enter a valid email address.")
    .max(254, "Email address is too long."),
  role: z.enum(["member", "admin"]),
});

export const memberRoleSchema = z.object({
  membershipId: uuidSchema,
  role: z.enum(["member", "admin"]),
});

export const projectFilterSchema = z.object({
  query: z.string().trim().max(100).default(""),
  status: z.enum(["ALL", ...projectStatuses]).default("ALL"),
  sort: z
    .enum(["updated_desc", "updated_asc", "name_asc", "name_desc"])
    .default("updated_desc"),
});

export const taskFilterSchema = z.object({
  query: z.string().trim().max(100).default(""),
  status: z.enum(["ALL", ...taskStatuses]).default("ALL"),
  priority: z.enum(["ALL", ...taskPriorities]).default("ALL"),
  assignee: z.string().trim().max(255).default("ALL"),
  project: z.union([z.literal("ALL"), uuidSchema]).default("ALL"),
  due: z.enum(["ALL", "OVERDUE", "UPCOMING", "NONE"]).default("ALL"),
  sort: z
    .enum(["updated_desc", "updated_asc", "due_asc", "priority_desc"])
    .default("updated_desc"),
});

export type OrganizationInput = z.infer<typeof organizationSchema>;
export type ProjectInput = z.infer<typeof projectSchema>;
export type TaskInput = z.infer<typeof taskSchema>;
export type ProjectFilters = z.infer<typeof projectFilterSchema>;
export type TaskFilters = z.infer<typeof taskFilterSchema>;

const defaultProjectFilters: ProjectFilters = {
  query: "",
  status: "ALL",
  sort: "updated_desc",
};
const defaultTaskFilters: TaskFilters = {
  query: "",
  status: "ALL",
  priority: "ALL",
  assignee: "ALL",
  project: "ALL",
  due: "ALL",
  sort: "updated_desc",
};

export function normalizeProjectFilters(input: unknown): ProjectFilters {
  const result = projectFilterSchema.safeParse(input);
  return result.success ? result.data : defaultProjectFilters;
}

export function normalizeTaskFilters(input: unknown): TaskFilters {
  const result = taskFilterSchema.safeParse(input);
  return result.success ? result.data : defaultTaskFilters;
}

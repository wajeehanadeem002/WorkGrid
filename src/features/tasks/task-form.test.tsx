import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { TaskForm } from "./task-form";

const existingTask = {
  id: "0f99a15f-e743-4bc2-a802-54f093c83b13",
  organization_id: "1f99a15f-e743-4bc2-a802-54f093c83b13",
  project_id: "2f99a15f-e743-4bc2-a802-54f093c83b13",
  title: "Review authorization boundary",
  description: "Verify tenant-scoped lookups.",
  status: "IN_REVIEW" as const,
  priority: "HIGH" as const,
  assignee_id: "user_12345",
  reporter_id: "user_67890",
  due_date: "2026-09-20",
  created_at: "2026-09-10T00:00:00.000Z",
  updated_at: "2026-09-10T00:00:00.000Z",
};

describe("TaskForm", () => {
  it("provides accessible task fields and assignment options", () => {
    render(
      <TaskForm
        action={vi.fn()}
        projects={[{ id: "project-1", name: "Platform", key: "PLAT" }]}
        members={[{ userId: "user_12345", label: "You" }]}
      />,
    );
    expect(screen.getByRole("textbox", { name: "Task title" })).toBeRequired();
    expect(
      screen.getByRole("combobox", { name: "Project" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("combobox", { name: "Assignee" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("combobox", { name: "Status" })).toHaveValue(
      "TODO",
    );
    expect(
      screen.getByRole("button", { name: "Create task" }),
    ).toBeInTheDocument();
  });

  it("keeps the project immutable while editing and still submits its identifier", () => {
    const { container } = render(
      <TaskForm
        action={vi.fn()}
        task={existingTask}
        projects={[
          { id: existingTask.project_id, name: "Platform", key: "PLAT" },
          {
            id: "3f99a15f-e743-4bc2-a802-54f093c83b13",
            name: "Operations",
            key: "OPS",
          },
        ]}
        members={[{ userId: "user_12345", label: "You" }]}
      />,
    );

    expect(screen.getByRole("combobox", { name: "Project" })).toBeDisabled();
    expect(
      container.querySelector('input[type="hidden"][name="projectId"]'),
    ).toHaveValue(existingTask.project_id);
  });
});

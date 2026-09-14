import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { TaskFilters } from "./task-filters";

describe("TaskFilters", () => {
  it("renders organization-scoped filter controls with current values", () => {
    render(
      <TaskFilters
        values={{
          query: "release",
          status: "IN_REVIEW",
          priority: "HIGH",
          assignee: "user_12345",
          project: "11111111-1111-4111-8111-111111111111",
          due: "UPCOMING",
          sort: "due_asc",
        }}
        projects={[
          {
            id: "11111111-1111-4111-8111-111111111111",
            name: "Platform",
            key: "PLAT",
          },
        ]}
        members={[{ userId: "user_12345", label: "You" }]}
      />,
    );
    expect(screen.getByRole("searchbox", { name: "Search tasks" })).toHaveValue(
      "release",
    );
    expect(screen.getByRole("combobox", { name: "Status" })).toHaveValue(
      "IN_REVIEW",
    );
    expect(screen.getByRole("combobox", { name: "Priority" })).toHaveValue(
      "HIGH",
    );
    expect(screen.getByRole("combobox", { name: "Project" })).toHaveValue(
      "11111111-1111-4111-8111-111111111111",
    );
    expect(
      screen.getByRole("button", { name: "Apply filters" }),
    ).toBeInTheDocument();
  });
});

import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { EmptyState } from "./empty-state";

describe("EmptyState", () => {
  it("announces the empty collection and exposes the next action", () => {
    render(
      <EmptyState
        title="No projects yet"
        description="Create the first project."
        action={<a href="/new">Create project</a>}
      />,
    );
    expect(
      screen.getByRole("heading", { name: "No projects yet" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "Create project" }),
    ).toHaveAttribute("href", "/new");
  });
});

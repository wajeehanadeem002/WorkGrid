import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ProjectFilters } from "./project-filters";

describe("ProjectFilters", () => {
  it("renders labeled server-side search, status, and sort controls", () => {
    render(
      <ProjectFilters
        values={{ query: "roadmap", status: "ACTIVE", sort: "name_asc" }}
      />,
    );
    expect(
      screen.getByRole("searchbox", { name: "Search projects" }),
    ).toHaveValue("roadmap");
    expect(
      screen.getByRole("combobox", { name: "Project status" }),
    ).toHaveValue("ACTIVE");
    expect(screen.getByRole("combobox", { name: "Sort projects" })).toHaveValue(
      "name_asc",
    );
    expect(
      screen.getByRole("button", { name: "Apply filters" }),
    ).toBeInTheDocument();
  });
});

import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { PermissionGate } from "./permission-gate";

describe("PermissionGate", () => {
  it("renders permitted controls for administrators", () => {
    render(
      <PermissionGate role="admin" permission="project:create">
        <button>Create project</button>
      </PermissionGate>,
    );
    expect(
      screen.getByRole("button", { name: "Create project" }),
    ).toBeInTheDocument();
  });

  it("does not render a forbidden control for members", () => {
    render(
      <PermissionGate role="member" permission="project:create">
        <button>Create project</button>
      </PermissionGate>,
    );
    expect(
      screen.queryByRole("button", { name: "Create project" }),
    ).not.toBeInTheDocument();
  });
});

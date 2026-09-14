import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { FormFeedback } from "./form-feedback";

describe("FormFeedback", () => {
  it("uses an alert for errors", () => {
    render(
      <FormFeedback
        state={{
          status: "error",
          code: "VALIDATION",
          message: "Check the highlighted fields.",
        }}
      />,
    );
    expect(screen.getByRole("alert")).toHaveTextContent(
      "Check the highlighted fields.",
    );
  });

  it("uses a status region for success feedback", () => {
    render(
      <FormFeedback state={{ status: "success", message: "Project saved." }} />,
    );
    expect(screen.getByRole("status")).toHaveTextContent("Project saved.");
  });
});

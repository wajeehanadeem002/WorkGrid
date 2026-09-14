import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { AttachmentForm } from "./attachments/attachment-form";
import { CommentForm } from "./comments/comment-form";
import { ProjectForm } from "./projects/project-form";

describe("feature forms", () => {
  it("renders a labeled project form with professional workflow statuses", () => {
    render(<ProjectForm action={vi.fn()} />);

    expect(
      screen.getByRole("textbox", { name: "Project name" }),
    ).toBeRequired();
    expect(
      screen.getByRole("textbox", { name: "Project key" }),
    ).toHaveAttribute("maxlength", "10");
    expect(screen.getByRole("combobox", { name: "Status" })).toHaveValue(
      "PLANNED",
    );
    expect(screen.getByRole("option", { name: "On hold" })).toBeInTheDocument();
  });

  it("limits task comments and exposes pending-safe submission feedback", () => {
    render(<CommentForm action={vi.fn()} />);

    expect(
      screen.getByRole("textbox", { name: "Add a comment" }),
    ).toHaveAttribute("maxlength", "5000");
    expect(screen.getByRole("button", { name: "Add comment" })).toBeEnabled();
  });

  it("associates server comment validation errors with the textarea", async () => {
    const user = userEvent.setup();
    render(
      <CommentForm
        action={async () => ({
          status: "error",
          code: "VALIDATION",
          message: "Check the highlighted fields and try again.",
          fieldErrors: { body: ["Comment cannot be empty."] },
        })}
      />,
    );

    const textarea = screen.getByRole("textbox", { name: "Add a comment" });
    await user.type(textarea, " ");
    await user.click(screen.getByRole("button", { name: "Add comment" }));

    await waitFor(() =>
      expect(textarea).toHaveAttribute("aria-invalid", "true"),
    );
    const error = screen.getByText("Comment cannot be empty.");
    expect(textarea).toHaveAttribute("aria-describedby", error.id);
  });

  it("restricts the attachment picker to the documented allowlist", () => {
    render(<AttachmentForm action={vi.fn()} />);

    const fileInput = screen.getByLabelText("Upload attachment");
    expect(fileInput).toHaveAttribute("type", "file");
    expect(fileInput).toHaveAttribute(
      "accept",
      expect.stringContaining("application/pdf"),
    );
    expect(fileInput).not.toHaveAttribute(
      "accept",
      expect.stringContaining(".exe"),
    );
    expect(screen.getByText(/Maximum 4 MB/)).toBeInTheDocument();
  });
});

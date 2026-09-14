import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { ConfirmAction } from "./confirm-action";

describe("ConfirmAction", () => {
  it("gives every dialog unique accessible title and description references", () => {
    const { container } = render(
      <>
        <ConfirmAction
          title="Delete comment?"
          description="This cannot be undone."
          action={vi.fn()}
          triggerLabel="Delete comment"
          confirmLabel="Delete"
        />
        <ConfirmAction
          title="Delete attachment?"
          description="The file will be removed."
          action={vi.fn()}
          triggerLabel="Delete attachment"
          confirmLabel="Delete"
        />
      </>,
    );

    const dialogs = [...container.querySelectorAll("dialog")];
    const labelledBy = dialogs.map((dialog) =>
      dialog.getAttribute("aria-labelledby"),
    );
    const describedBy = dialogs.map((dialog) =>
      dialog.getAttribute("aria-describedby"),
    );

    expect(new Set(labelledBy).size).toBe(2);
    expect(new Set(describedBy).size).toBe(2);
    expect(
      labelledBy.every((id) => id && container.querySelector(`#${id}`)),
    ).toBe(true);
    expect(
      describedBy.every((id) => id && container.querySelector(`#${id}`)),
    ).toBe(true);
  });

  it("keeps an expected destructive-action failure inside the dialog", async () => {
    const user = userEvent.setup();
    render(
      <ConfirmAction
        title="Delete project?"
        description="This cannot be undone."
        action={async () => ({
          status: "error",
          code: "CONFLICT",
          message: "Remove the project's tasks before deleting it.",
        })}
        triggerLabel="Delete project"
        confirmLabel="Delete"
      />,
    );

    await user.click(screen.getByRole("button", { name: "Delete project" }));
    await user.click(screen.getByRole("button", { name: "Delete" }));

    await waitFor(() =>
      expect(
        screen.getByText("Remove the project's tasks before deleting it."),
      ).toBeInTheDocument(),
    );
    expect(screen.getByRole("dialog")).toHaveAttribute("open");
  });
});

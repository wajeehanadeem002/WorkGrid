import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("./actions", () => ({
  acceptInvitationAction: vi.fn(() => async () => ({ status: "idle" })),
}));

import { AcceptInvitationForm } from "./accept-invitation-form";

describe("AcceptInvitationForm", () => {
  it("shows the bound organization, email, role, and expiry before acceptance", () => {
    render(
      <AcceptInvitationForm
        token="secure-token"
        organizationName="Northstar"
        email="member@example.com"
        role="member"
        expiresAt="2026-09-18T12:00:00.000Z"
      />,
    );

    expect(screen.getByText("Northstar")).toBeInTheDocument();
    expect(screen.getByText("member@example.com")).toBeInTheDocument();
    expect(screen.getByText("member", { selector: "dd" })).toBeInTheDocument();
    expect(
      screen.getByText(/bound to the verified email/i),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Accept invitation" }),
    ).toBeEnabled();
  });
});

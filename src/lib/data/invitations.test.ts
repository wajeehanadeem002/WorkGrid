import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AuthenticatedContext } from "@/lib/supabase/server";
import { getInvitationPreview } from "./invitations";

describe("invitation preview boundary", () => {
  beforeEach(() => {
    process.env.WORKGRID_SERVER_PROOF_SECRET =
      "0123456789abcdef0123456789abcdef";
  });

  it("binds preview to the authenticated actor and verified Clerk email", async () => {
    const rpc = vi.fn(async () => ({
      data: {
        ok: true,
        organization_name: "Northstar",
        organization_slug: "northstar",
        email: "member@example.com",
        role: "member",
        expires_at: "2026-09-18T12:00:00.000Z",
      },
      error: null,
    }));
    const authenticated = {
      userId: "user_member",
      client: { rpc },
    } as unknown as AuthenticatedContext;

    await expect(
      getInvitationPreview(
        authenticated,
        "a-secure-invitation-token-that-is-long-enough",
        "member@example.com",
      ),
    ).resolves.toMatchObject({ ok: true, organizationName: "Northstar" });
    expect(rpc).toHaveBeenCalledWith(
      "preview_organization_invitation",
      expect.objectContaining({
        verified_email: "member@example.com",
        server_proof: expect.stringMatching(/^[a-f0-9]{64}$/),
      }),
    );
  });

  it("does not call the database without a verified primary email", async () => {
    const rpc = vi.fn();
    const authenticated = {
      userId: "user_member",
      client: { rpc },
    } as unknown as AuthenticatedContext;

    await expect(
      getInvitationPreview(authenticated, "a".repeat(43), null),
    ).resolves.toMatchObject({
      ok: false,
      message: expect.stringContaining("Verify"),
    });
    expect(rpc).not.toHaveBeenCalled();
  });
});

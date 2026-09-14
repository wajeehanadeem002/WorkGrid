import { beforeEach, describe, expect, it, vi } from "vitest";

const { authenticate, resolveContext, enforceLimit } = vi.hoisted(() => ({
  authenticate: vi.fn(),
  resolveContext: vi.fn(),
  enforceLimit: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({
  createAuthenticatedContext: authenticate,
}));
vi.mock("@/lib/auth/server-context", () => ({
  resolveOrganizationContextById: resolveContext,
}));
vi.mock("@/lib/security/rate-limit", () => ({
  enforceExportRateLimit: enforceLimit,
}));
vi.mock("@/lib/env", () => ({
  getPublicEnv: () => ({
    NEXT_PUBLIC_APP_URL: "https://workgrid.example",
    NEXT_PUBLIC_SUPABASE_URL: "https://sample.supabase.co",
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "sb_publishable_sample",
  }),
}));

import { POST } from "./[organizationId]/export/route";

const organizationId = "11111111-1111-4111-8111-111111111111";

describe("organization export Route Handler", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    const authenticated = { userId: "user_owner", client: {} };
    authenticate.mockResolvedValue(authenticated);
    resolveContext.mockResolvedValue({
      context: {
        userId: "user_owner",
        organization: {
          id: organizationId,
          name: "Northstar",
          slug: "northstar",
        },
        membership: { id: "member-1", userId: "user_owner", role: "owner" },
      },
      client: {},
    });
  });

  it("validates the requested export before consuming quota", async () => {
    const form = new FormData();
    form.set("format", "zip");
    form.set("resource", "tasks");
    const response = await POST(
      new Request(
        `https://workgrid.example/api/organizations/${organizationId}/export`,
        {
          method: "POST",
          headers: { Origin: "https://workgrid.example" },
          body: form,
        },
      ),
      { params: Promise.resolve({ organizationId }) },
    );

    expect(response.status).toBe(400);
    expect(enforceLimit).not.toHaveBeenCalled();
  });

  it("rejects cross-origin posts without consuming quota", async () => {
    const response = await POST(
      new Request(
        `https://workgrid.example/api/organizations/${organizationId}/export`,
        {
          method: "POST",
          headers: { Origin: "https://attacker.example" },
        },
      ),
      { params: Promise.resolve({ organizationId }) },
    );

    expect(response.status).toBe(403);
    expect(enforceLimit).not.toHaveBeenCalled();
  });

  it("lets Clerk/Next authentication control flow escape the broad route catch", async () => {
    const authError = new Error("clerk-control-flow");
    authenticate.mockRejectedValueOnce(authError);

    await expect(
      POST(
        new Request(
          `https://workgrid.example/api/organizations/${organizationId}/export`,
          {
            method: "POST",
          },
        ),
        { params: Promise.resolve({ organizationId }) },
      ),
    ).rejects.toBe(authError);
  });
});

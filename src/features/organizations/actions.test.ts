import { beforeEach, describe, expect, it, vi } from "vitest";
import { AppError } from "@/lib/security/errors";

const { authenticate, resolveContext, updateOrganizationName } = vi.hoisted(
  () => ({
    authenticate: vi.fn(),
    resolveContext: vi.fn(),
    updateOrganizationName: vi.fn(),
  }),
);

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/navigation", () => ({ redirect: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({
  createAuthenticatedContext: authenticate,
}));
vi.mock("@/lib/auth/server-context", () => ({
  resolveOrganizationContext: resolveContext,
}));
vi.mock("@/lib/data/organizations", () => ({ updateOrganizationName }));

import { updateOrganizationAction } from "./actions";

describe("updateOrganizationAction boundary", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    const client = {
      from: vi.fn(() => ({
        update: vi.fn(() => ({
          eq: vi.fn().mockResolvedValue({ error: null }),
        })),
      })),
    };
    authenticate.mockResolvedValue({ userId: "user_owner", client });
    resolveContext.mockResolvedValue({
      context: {
        userId: "user_owner",
        organization: {
          id: "11111111-1111-4111-8111-111111111111",
          name: "Northstar",
          slug: "northstar",
        },
        membership: { id: "member-1", userId: "user_owner", role: "owner" },
      },
      client,
    });
  });

  it("does not report success when a stale membership makes the update affect no row", async () => {
    updateOrganizationName.mockRejectedValue(
      new AppError("NOT_FOUND", "Resource not found."),
    );
    const formData = new FormData();
    formData.set("name", "Northstar updated");

    await expect(
      updateOrganizationAction("northstar", { status: "idle" }, formData),
    ).resolves.toEqual({
      status: "error",
      code: "NOT_FOUND",
      message: "Resource not found.",
    });
  });
});

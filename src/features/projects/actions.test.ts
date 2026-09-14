import { beforeEach, describe, expect, it, vi } from "vitest";
import { AppError } from "@/lib/security/errors";

const { authenticate, resolveContext, getProject, deleteProject } = vi.hoisted(
  () => ({
    authenticate: vi.fn(),
    resolveContext: vi.fn(),
    getProject: vi.fn(),
    deleteProject: vi.fn(),
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
vi.mock("@/lib/data/projects", () => ({
  createProject: vi.fn(),
  updateProject: vi.fn(),
  getProject,
  deleteProject,
}));

import { deleteProjectAction } from "./actions";

describe("deleteProjectAction boundary", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    const client = {};
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
    getProject.mockResolvedValue({
      id: "22222222-2222-4222-8222-222222222222",
    });
  });

  it("returns an expected reference conflict for the confirmation dialog", async () => {
    deleteProject.mockRejectedValue(
      new AppError("CONFLICT", "This item is still referenced by other work."),
    );

    await expect(
      deleteProjectAction(
        "northstar",
        "22222222-2222-4222-8222-222222222222",
        { status: "idle" },
        new FormData(),
      ),
    ).resolves.toEqual({
      status: "error",
      code: "CONFLICT",
      message: "This item is still referenced by other work.",
    });
  });

  it("does not turn an authentication redirect into an expected action error", async () => {
    const authError = new Error("clerk-control-flow");
    authenticate.mockRejectedValueOnce(authError);

    await expect(
      deleteProjectAction(
        "northstar",
        "22222222-2222-4222-8222-222222222222",
        { status: "idle" },
        new FormData(),
      ),
    ).rejects.toBe(authError);
  });
});

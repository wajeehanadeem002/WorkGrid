import { beforeEach, describe, expect, it, vi } from "vitest";

const events: string[] = [];
const rpc = vi.fn();
const upload = vi.fn();
const download = vi.fn();
const remove = vi.fn();

const client = {
  rpc,
  storage: {
    from: () => ({ upload, download, remove }),
  },
};

const context = {
  userId: "user_member",
  organization: {
    id: "11111111-1111-4111-8111-111111111111",
    name: "Northstar",
    slug: "northstar",
  },
  membership: {
    id: "member-1",
    userId: "user_member",
    role: "member" as const,
  },
};

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({
  createAuthenticatedContext: vi.fn(async () => {
    events.push("authenticate");
    return { userId: context.userId, client };
  }),
}));
vi.mock("@/lib/auth/server-context", () => ({
  resolveOrganizationContext: vi.fn(async () => {
    events.push("membership");
    return { context, client };
  }),
}));
vi.mock("@/lib/data/tasks", () => ({
  getTask: vi.fn(async () => {
    events.push("load-task");
    return {
      id: "22222222-2222-4222-8222-222222222222",
      project_id: "33333333-3333-4333-8333-333333333333",
    };
  }),
}));
vi.mock("@/lib/data/projects", () => ({ getProject: vi.fn(async () => ({})) }));
vi.mock("@/lib/data/attachments", () => ({
  getAttachment: vi.fn(async () => ({
    id: "44444444-4444-4444-8444-444444444444",
    organization_id: context.organization.id,
    project_id: "33333333-3333-4333-8333-333333333333",
    task_id: "22222222-2222-4222-8222-222222222222",
    uploaded_by: context.userId,
    storage_path:
      "11111111-1111-4111-8111-111111111111/33333333-3333-4333-8333-333333333333/22222222-2222-4222-8222-222222222222/44444444-4444-4444-8444-444444444444/brief.pdf",
    original_name: "brief.pdf",
    mime_type: "application/pdf",
    size_bytes: 8,
    content_sha256: "c".repeat(64),
    upload_status: "ready",
    deletion_started_at: null,
    created_at: "2026-09-11T00:00:00.000Z",
  })),
}));

import { deleteAttachmentAction, uploadAttachmentAction } from "./actions";
import { createAuthenticatedContext } from "@/lib/supabase/server";

describe("uploadAttachmentAction boundary", () => {
  beforeEach(() => {
    events.length = 0;
    vi.clearAllMocks();
    process.env.WORKGRID_SERVER_PROOF_SECRET =
      "0123456789abcdef0123456789abcdef";
    rpc.mockImplementation(async (name: string) => {
      events.push(`rpc:${name}`);
      if (name === "consume_upload_attempt") return { data: true, error: null };
      if (name === "reserve_attachment") {
        return {
          data: {
            ok: true,
            attachment_id: "44444444-4444-4444-8444-444444444444",
          },
          error: null,
        };
      }
      if (name === "seal_attachment_upload") {
        return { data: { ok: true }, error: null };
      }
      if (name === "finalize_attachment") {
        return { data: { ok: true }, error: null };
      }
      return { data: { ok: true }, error: null };
    });
    upload.mockResolvedValue({
      data: {
        id: "77777777-7777-4777-8777-777777777777",
        path: "brief.pdf",
        fullPath: "attachments/brief.pdf",
      },
      error: null,
    });
    download.mockResolvedValue({
      data: new Blob(["%PDF-1.7"], { type: "application/pdf" }),
      error: null,
    });
    remove.mockResolvedValue({ error: null });
  });

  it("authenticates and consumes the upload-attempt limit before reading file content", async () => {
    const file = new File(["%PDF-1.7"], "brief.pdf", {
      type: "application/pdf",
    });
    const originalSlice = file.slice.bind(file);
    vi.spyOn(file, "slice").mockImplementation((...args) => {
      events.push("inspect-content");
      return originalSlice(...args);
    });
    const formData = new FormData();
    formData.set("file", file);

    await expect(
      uploadAttachmentAction(
        "northstar",
        "22222222-2222-4222-8222-222222222222",
        { status: "idle" },
        formData,
      ),
    ).resolves.toMatchObject({ status: "success" });

    expect(events.slice(0, 4)).toEqual([
      "authenticate",
      "membership",
      "rpc:consume_upload_attempt",
      "load-task",
    ]);
    expect(events.indexOf("rpc:consume_upload_attempt")).toBeLessThan(
      events.indexOf("inspect-content"),
    );
    expect(rpc).toHaveBeenCalledWith(
      "reserve_attachment",
      expect.objectContaining({
        server_proof: expect.stringMatching(/^[a-f0-9]{64}$/),
      }),
    );
    expect(rpc).toHaveBeenCalledWith(
      "seal_attachment_upload",
      expect.objectContaining({
        target_storage_object_id: "77777777-7777-4777-8777-777777777777",
        server_proof: expect.stringMatching(/^[a-f0-9]{64}$/),
      }),
    );
    expect(download).toHaveBeenCalledOnce();
    expect(rpc).toHaveBeenCalledWith(
      "finalize_attachment",
      expect.objectContaining({
        target_storage_object_id: "77777777-7777-4777-8777-777777777777",
        server_proof: expect.stringMatching(/^[a-f0-9]{64}$/),
      }),
    );
  });

  it("does not inspect rejected upload bytes after the operation limit is exhausted", async () => {
    rpc.mockResolvedValueOnce({ data: false, error: null });
    const file = new File(["MZ executable"], "brief.pdf", {
      type: "application/pdf",
    });
    const slice = vi.spyOn(file, "slice");
    const formData = new FormData();
    formData.set("file", file);

    await expect(
      uploadAttachmentAction(
        "northstar",
        "22222222-2222-4222-8222-222222222222",
        { status: "idle" },
        formData,
      ),
    ).resolves.toMatchObject({ status: "error", code: "RATE_LIMITED" });
    expect(slice).not.toHaveBeenCalled();
    expect(events).not.toContain("load-task");
  });

  it("counts malformed task identifiers as upload attempts before validation", async () => {
    const formData = new FormData();
    formData.set(
      "file",
      new File(["%PDF-1.7"], "brief.pdf", { type: "application/pdf" }),
    );

    await expect(
      uploadAttachmentAction(
        "northstar",
        "not-a-task-id",
        { status: "idle" },
        formData,
      ),
    ).resolves.toMatchObject({ status: "error", code: "VALIDATION" });

    expect(events.slice(0, 3)).toEqual([
      "authenticate",
      "membership",
      "rpc:consume_upload_attempt",
    ]);
    expect(events).not.toContain("load-task");
  });

  it("does not convert Clerk authentication control flow into an ActionState", async () => {
    const authError = new Error("clerk-control-flow");
    vi.mocked(createAuthenticatedContext).mockRejectedValueOnce(authError);

    await expect(
      uploadAttachmentAction(
        "northstar",
        "22222222-2222-4222-8222-222222222222",
        { status: "idle" },
        new FormData(),
      ),
    ).rejects.toBe(authError);
  });

  it("removes unverifiable bytes and cancels pending metadata after finalization is rejected", async () => {
    rpc.mockImplementation(async (name: string) => {
      if (name === "consume_upload_attempt") return { data: true, error: null };
      if (name === "reserve_attachment") {
        return { data: { ok: true, attachment_id: "reserved" }, error: null };
      }
      if (name === "seal_attachment_upload") {
        return {
          data: { ok: false, code: "STORAGE_MISMATCH" },
          error: null,
        };
      }
      return { data: { ok: true }, error: null };
    });
    const formData = new FormData();
    formData.set(
      "file",
      new File(["%PDF-1.7"], "brief.pdf", { type: "application/pdf" }),
    );

    await expect(
      uploadAttachmentAction(
        "northstar",
        "22222222-2222-4222-8222-222222222222",
        { status: "idle" },
        formData,
      ),
    ).resolves.toMatchObject({ status: "error", code: "UNAVAILABLE" });
    expect(remove).toHaveBeenCalledOnce();
    expect(rpc).toHaveBeenCalledWith(
      "cancel_attachment_reservation",
      expect.objectContaining({
        server_proof: expect.stringMatching(/^[a-f0-9]{64}$/),
      }),
    );
  });

  it("never finalizes when the bytes read back from private Storage differ", async () => {
    download.mockResolvedValueOnce({
      data: new Blob(["MZ payload"], { type: "application/pdf" }),
      error: null,
    });
    const formData = new FormData();
    formData.set(
      "file",
      new File(["%PDF-1.7"], "brief.pdf", { type: "application/pdf" }),
    );

    await expect(
      uploadAttachmentAction(
        "northstar",
        "22222222-2222-4222-8222-222222222222",
        { status: "idle" },
        formData,
      ),
    ).resolves.toMatchObject({ status: "error", code: "UNAVAILABLE" });

    expect(rpc).toHaveBeenCalledWith(
      "seal_attachment_upload",
      expect.any(Object),
    );
    expect(rpc).not.toHaveBeenCalledWith(
      "finalize_attachment",
      expect.any(Object),
    );
    expect(rpc).toHaveBeenCalledWith(
      "cancel_attachment_reservation",
      expect.objectContaining({
        server_proof: expect.stringMatching(/^[a-f0-9]{64}$/),
      }),
    );
    expect(remove).toHaveBeenCalledOnce();
  });

  it("restores ready metadata and returns an in-dialog error when Storage deletion fails", async () => {
    rpc.mockImplementation(async (name: string) => {
      if (name === "begin_attachment_deletion") {
        return {
          data: {
            ok: true,
            storage_path:
              "11111111-1111-4111-8111-111111111111/33333333-3333-4333-8333-333333333333/22222222-2222-4222-8222-222222222222/44444444-4444-4444-8444-444444444444/brief.pdf",
          },
          error: null,
        };
      }
      if (name === "reconcile_attachment_deletion") {
        return { data: { ok: true, outcome: "RESTORED" }, error: null };
      }
      return { data: { ok: true }, error: null };
    });
    remove.mockResolvedValueOnce({ error: { message: "provider failure" } });

    await expect(
      deleteAttachmentAction(
        "northstar",
        "22222222-2222-4222-8222-222222222222",
        "44444444-4444-4444-8444-444444444444",
        { status: "idle" },
        new FormData(),
      ),
    ).resolves.toMatchObject({
      status: "error",
      code: "UNAVAILABLE",
      message: expect.stringContaining("metadata was restored"),
    });
  });
});

import { beforeEach, describe, expect, it, vi } from "vitest";
import { AppError } from "@/lib/security/errors";

const { authenticate, resolveContext, getAttachment, download } = vi.hoisted(
  () => ({
    authenticate: vi.fn(),
    resolveContext: vi.fn(),
    getAttachment: vi.fn(),
    download: vi.fn(),
  }),
);

const client = {
  storage: { from: vi.fn(() => ({ download })) },
};

vi.mock("@/lib/supabase/server", () => ({
  createAuthenticatedContext: authenticate,
}));
vi.mock("@/lib/auth/server-context", () => ({
  resolveOrganizationContextById: resolveContext,
}));
vi.mock("@/lib/data/attachments", () => ({ getAttachment }));

import { GET } from "./[organizationId]/attachments/[attachmentId]/route";

const organizationId = "11111111-1111-4111-8111-111111111111";
const attachmentId = "22222222-2222-4222-8222-222222222222";

function invokeRoute() {
  return GET(new Request("https://workgrid.example/download"), {
    params: Promise.resolve({ organizationId, attachmentId }),
  });
}

describe("attachment download Route Handler boundary", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authenticate.mockResolvedValue({ userId: "user_member", client });
    resolveContext.mockResolvedValue({
      context: {
        userId: "user_member",
        organization: { id: organizationId, slug: "northstar" },
        membership: { role: "member" },
      },
      client,
    });
    getAttachment.mockResolvedValue({
      id: attachmentId,
      organization_id: organizationId,
      storage_path: `${organizationId}/project/task/${attachmentId}/brief.pdf`,
      original_name: "brief.pdf",
      mime_type: "application/pdf",
    });
    download.mockResolvedValue({
      data: {
        size: 8,
        stream: () =>
          new ReadableStream({
            start(controller) {
              controller.enqueue(new TextEncoder().encode("%PDF-1.7"));
              controller.close();
            },
          }),
      },
      error: null,
    });
  });

  it("rechecks tenant-scoped ready metadata before streaming private bytes", async () => {
    const response = await invokeRoute();

    expect(resolveContext).toHaveBeenCalledWith(
      organizationId,
      expect.objectContaining({ userId: "user_member" }),
    );
    expect(getAttachment).toHaveBeenCalledWith(
      client,
      organizationId,
      attachmentId,
    );
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("private, no-store");
    expect(response.headers.get("content-disposition")).toContain(
      "attachment;",
    );
  });

  it("does not touch Storage when tenant-scoped metadata is unavailable", async () => {
    getAttachment.mockRejectedValueOnce(
      new AppError("NOT_FOUND", "Attachment not found."),
    );

    const response = await invokeRoute();

    expect(response.status).toBe(404);
    expect(download).not.toHaveBeenCalled();
  });

  it("lets Clerk authentication control flow escape the route error mapper", async () => {
    const controlFlow = new Error("clerk-control-flow");
    authenticate.mockRejectedValueOnce(controlFlow);

    await expect(invokeRoute()).rejects.toBe(controlFlow);
    expect(resolveContext).not.toHaveBeenCalled();
  });
});

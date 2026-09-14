import { describe, expect, it, vi } from "vitest";
import type { WorkGridClient } from "@/lib/supabase/server";
import { enforceExportRateLimit, enforceUploadRateLimit } from "./rate-limit";

describe("rate-limit enforcement", () => {
  it("continues when the database atomically accepts the request", async () => {
    const client = {
      rpc: async () => ({ data: true, error: null }),
    } as unknown as WorkGridClient;
    await expect(
      enforceExportRateLimit(client, "organization-1"),
    ).resolves.toBeUndefined();
  });

  it("returns a public rate-limit error when the window is exhausted", async () => {
    const client = {
      rpc: async () => ({ data: false, error: null }),
    } as unknown as WorkGridClient;
    await expect(
      enforceExportRateLimit(client, "organization-1"),
    ).rejects.toMatchObject({
      code: "RATE_LIMITED",
      message: "Too many requests. Please wait and try again.",
    });
  });

  it("uses a strict hourly limit for organization exports", async () => {
    const rpc = vi.fn(async () => ({ data: true, error: null }));
    const client = { rpc } as unknown as WorkGridClient;

    await enforceExportRateLimit(client, "organization-1");

    expect(rpc).toHaveBeenCalledWith("consume_export_attempt", {
      target_organization_id: "organization-1",
    });
  });

  it("uses a bounded upload-attempt function without caller-controlled keys or limits", async () => {
    const rpc = vi.fn(async () => ({ data: true, error: null }));
    const client = { rpc } as unknown as WorkGridClient;

    await enforceUploadRateLimit(client, "organization-1");

    expect(rpc).toHaveBeenCalledWith("consume_upload_attempt", {
      target_organization_id: "organization-1",
    });
  });
});

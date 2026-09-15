import { describe, expect, it, vi } from "vitest";

import {
  createCleanupHandler,
  type CleanupCandidate,
  type CleanupStore,
} from "./handler";

const validToken = "a".repeat(64);

function post(token = validToken, body?: unknown) {
  return new Request("http://localhost/functions/v1/cleanup-attachments", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-workgrid-cleanup-token": token,
    },
    body: JSON.stringify(body ?? {}),
  });
}

function candidate(index: number): CleanupCandidate {
  return {
    attachment_id: `00000000-0000-4000-8000-${index.toString().padStart(12, "0")}`,
    storage_path: `tenant/project/task/${index}/file.pdf`,
    cleanup_mode: "discarding",
  };
}

describe("cleanup attachment Edge Function handler", () => {
  it("rejects unsupported methods without constructing the elevated client", async () => {
    const createStore = vi.fn();
    const handler = createCleanupHandler({
      cleanupToken: () => validToken,
      createStore,
    });

    const response = await handler(
      new Request("http://localhost/functions/v1/cleanup-attachments"),
    );

    expect(response.status).toBe(405);
    expect(response.headers.get("allow")).toBe("POST");
    expect(createStore).not.toHaveBeenCalled();
  });

  it.each([undefined, "wrong-token", "x".repeat(257)])(
    "rejects a missing or invalid cron token before constructing the elevated client",
    async (token) => {
      const createStore = vi.fn();
      const handler = createCleanupHandler({
        cleanupToken: () => validToken,
        createStore,
      });
      const requestInit: RequestInit = { method: "POST" };
      if (token) {
        requestInit.headers = { "x-workgrid-cleanup-token": token };
      }
      const request = new Request(
        "http://localhost/functions/v1/cleanup-attachments",
        requestInit,
      );

      const response = await handler(request);

      expect(response.status).toBe(401);
      expect(createStore).not.toHaveBeenCalled();
    },
  );

  it("fails closed when the cleanup token is not configured", async () => {
    const createStore = vi.fn();
    const handler = createCleanupHandler({
      cleanupToken: () => undefined,
      createStore,
    });

    const response = await handler(post());

    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({ error: "Cleanup is unavailable." });
    expect(createStore).not.toHaveBeenCalled();
  });

  it("ignores caller input and processes only the claimed batch with five-wide concurrency", async () => {
    const claimed = Array.from({ length: 12 }, (_, index) => candidate(index));
    let active = 0;
    let maximumActive = 0;
    const deleteObject = vi.fn(async (storagePath: string) => {
      void storagePath;
      active += 1;
      maximumActive = Math.max(maximumActive, active);
      await new Promise((resolve) => setTimeout(resolve, 2));
      active -= 1;
    });
    const finalize = vi.fn(async () => "DELETED" as const);
    const store: CleanupStore = {
      claimBatch: vi.fn(async () => claimed),
      deleteObject,
      finalize,
    };
    const handler = createCleanupHandler({
      cleanupToken: () => validToken,
      createStore: () => store,
    });

    const response = await handler(
      post(validToken, {
        limit: 999999,
        paths: ["another-tenant/private.pdf"],
      }),
    );
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(store.claimBatch).toHaveBeenCalledWith();
    expect(deleteObject.mock.calls.map(([path]) => path)).toEqual(
      claimed.map(({ storage_path }) => storage_path),
    );
    expect(finalize).toHaveBeenCalledTimes(12);
    expect(maximumActive).toBeLessThanOrEqual(5);
    expect(payload).toEqual({
      claimed: 12,
      deleted: 12,
      restored: 0,
      retryPending: 0,
      failed: 0,
    });
    expect(JSON.stringify(payload)).not.toContain("tenant/project");
    expect(JSON.stringify(payload)).not.toContain("another-tenant");
  });

  it("finalizes every attempt and reports only aggregate outcomes after partial Storage failures", async () => {
    const claimed = [candidate(1), candidate(2), candidate(3), candidate(4)];
    const deleteObject = vi.fn(async (path: string) => {
      if (path.includes("/2/")) {
        throw new Error("private backend detail");
      }
    });
    const outcomes: Array<"DELETED" | "RESTORED" | "RETRY" | "CONFLICT"> = [
      "DELETED",
      "RETRY",
      "RESTORED",
      "CONFLICT",
    ];
    const finalize = vi.fn(async () => outcomes.shift() ?? "CONFLICT");
    const handler = createCleanupHandler({
      cleanupToken: () => validToken,
      createStore: () => ({
        claimBatch: async () => claimed,
        deleteObject,
        finalize,
      }),
    });

    const response = await handler(post());
    const body = await response.text();

    expect(response.status).toBe(200);
    expect(finalize).toHaveBeenCalledTimes(4);
    expect(JSON.parse(body)).toEqual({
      claimed: 4,
      deleted: 1,
      restored: 1,
      retryPending: 1,
      failed: 1,
    });
    expect(body).not.toContain("private backend detail");
    expect(body).not.toContain("file.pdf");
  });

  it("returns a generic failure when claiming fails", async () => {
    const handler = createCleanupHandler({
      cleanupToken: () => validToken,
      createStore: () => ({
        claimBatch: async () => {
          throw new Error("database credentials leaked here");
        },
        deleteObject: async () => undefined,
        finalize: async () => "CONFLICT" as const,
      }),
    });

    const response = await handler(post());
    const body = await response.text();

    expect(response.status).toBe(503);
    expect(body).toBe('{"error":"Cleanup failed safely."}');
    expect(body).not.toContain("credentials");
  });
});

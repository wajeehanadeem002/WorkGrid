import { afterEach, describe, expect, it, vi } from "vitest";
import { createTimeoutFetch } from "./timeout-fetch";

describe("createTimeoutFetch", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("aborts a request that exceeds the configured deadline", async () => {
    vi.useFakeTimers();
    const fetcher = vi.fn(
      (_input: RequestInfo | URL, init?: RequestInit) =>
        new Promise<Response>((_resolve, reject) => {
          init?.signal?.addEventListener("abort", () => {
            reject(init.signal?.reason);
          });
        }),
    );
    const boundedFetch = createTimeoutFetch(12_000, fetcher);

    const request = boundedFetch("https://example.test/storage");
    const rejection = expect(request).rejects.toMatchObject({
      name: "TimeoutError",
    });
    await vi.advanceTimersByTimeAsync(12_000);

    await rejection;
    expect(fetcher).toHaveBeenCalledOnce();
  });

  it("clears its deadline after a request completes", async () => {
    vi.useFakeTimers();
    const response = new Response(null, { status: 204 });
    const boundedFetch = createTimeoutFetch(
      12_000,
      vi.fn(async () => response),
    );

    await expect(boundedFetch("https://example.test/storage")).resolves.toBe(
      response,
    );

    expect(vi.getTimerCount()).toBe(0);
  });
});

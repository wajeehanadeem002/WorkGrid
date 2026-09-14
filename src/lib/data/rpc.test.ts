import { describe, expect, it } from "vitest";
import { requireRpcResult } from "./rpc";

describe("controlled database operation results", () => {
  it("returns typed fields only from a successful envelope", () => {
    expect(
      requireRpcResult({ ok: true, organization_id: "org-1" }, [
        "organization_id",
      ]),
    ).toEqual({ ok: true, organization_id: "org-1" });
  });

  it.each([
    ["RATE_LIMITED", "RATE_LIMITED"],
    ["FORBIDDEN", "FORBIDDEN"],
    ["NOT_FOUND", "NOT_FOUND"],
    ["CONFLICT", "CONFLICT"],
    ["VALIDATION", "VALIDATION"],
    ["STORAGE_MISMATCH", "UNAVAILABLE"],
    ["INVALID_INVITATION", "VALIDATION"],
    ["CONFIGURATION", "UNAVAILABLE"],
  ] as const)(
    "maps %s without returning database details",
    (databaseCode, appCode) => {
      expect(() =>
        requireRpcResult({ ok: false, code: databaseCode }),
      ).toThrow();
      try {
        requireRpcResult({ ok: false, code: databaseCode });
      } catch (error) {
        expect(error).toMatchObject({ code: appCode });
      }
    },
  );

  it("treats malformed database envelopes as unavailable", () => {
    expect(() => requireRpcResult({ debug: "internal relation name" })).toThrow(
      "temporarily unavailable",
    );
  });
});

import { describe, expect, it, vi } from "vitest";
import { AppError, databaseError, toActionState } from "./errors";
import { z } from "zod";

describe("public error handling", () => {
  it("preserves deliberately public operational errors", () => {
    expect(
      toActionState(
        new AppError("FORBIDDEN", "You cannot change this member."),
      ),
    ).toEqual({
      status: "error",
      code: "FORBIDDEN",
      message: "You cannot change this member.",
    });
  });

  it("does not expose database or provider details for unexpected errors", () => {
    const consoleError = vi
      .spyOn(console, "error")
      .mockImplementation(() => undefined);
    const result = toActionState(
      new Error(
        'duplicate key value violates unique constraint "organizations_slug_key"',
      ),
      "request-123",
    );

    expect(result).toEqual({
      status: "error",
      code: "UNEXPECTED",
      message: "Something went wrong. Please try again.",
      requestId: "request-123",
    });
    expect(consoleError).toHaveBeenCalledOnce();
    consoleError.mockRestore();
  });

  it("maps malformed external input to a validation response", () => {
    const parsed = z.object({ id: z.uuid() }).safeParse({ id: "other-tenant" });
    if (parsed.success) throw new Error("Fixture must be invalid");
    expect(toActionState(parsed.error)).toMatchObject({
      status: "error",
      code: "VALIDATION",
      message: "Check the highlighted fields and try again.",
    });
  });

  it("creates a stable unavailable error for provider failures", () => {
    expect(databaseError()).toMatchObject({
      code: "UNAVAILABLE",
      message: "The service is temporarily unavailable.",
    });
  });
});

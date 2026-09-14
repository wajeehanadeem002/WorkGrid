import { describe, expect, it, vi } from "vitest";
import { z } from "zod";
import { AppError } from "@/lib/security/errors";
import { routeErrorResponse } from "./route-errors";

describe("routeErrorResponse", () => {
  it("maps deliberate authorization errors to no-store HTTP responses", async () => {
    const response = routeErrorResponse(
      new AppError("FORBIDDEN", "You do not have permission."),
    );

    expect(response.status).toBe(403);
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    await expect(response.json()).resolves.toEqual({
      error: { code: "FORBIDDEN", message: "You do not have permission." },
    });
  });

  it("does not expose unexpected provider or database details", async () => {
    const consoleError = vi
      .spyOn(console, "error")
      .mockImplementation(() => undefined);
    const response = routeErrorResponse(
      new Error("password=secret; relation organization_members missing"),
    );
    const body = await response.json();

    expect(response.status).toBe(500);
    expect(JSON.stringify(body)).not.toContain("secret");
    expect(body.error).toMatchObject({
      code: "UNEXPECTED",
      message: "Something went wrong.",
    });
    expect(body.error.requestId).toEqual(expect.any(String));
    consoleError.mockRestore();
  });

  it("maps invalid route parameters without exposing schema internals", async () => {
    const validationError = z.uuid().safeParse("manipulated-id");
    if (validationError.success) throw new Error("Expected validation to fail");

    const response = routeErrorResponse(validationError.error);
    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      error: {
        code: "VALIDATION",
        message: "The request contains invalid values.",
      },
    });
  });
});

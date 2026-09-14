import { describe, expect, it } from "vitest";
import { mapDataError } from "./errors";

describe("database error mapping", () => {
  it("maps uniqueness failures to a public conflict without leaking constraints", () => {
    const error = mapDataError({
      code: "23505",
      message: 'duplicate key violates "projects_organization_id_key_key"',
      details: "Key (organization_id, key)=(secret, WEB) already exists",
      hint: null,
      name: "PostgrestError",
    });
    expect(error).toMatchObject({
      code: "CONFLICT",
      message: "That value is already in use.",
    });
    expect(error.message).not.toContain("secret");
  });

  it("maps missing rows without exposing query details", () => {
    expect(
      mapDataError({
        code: "PGRST116",
        message: "JSON object requested",
        details: null,
        hint: null,
        name: "PostgrestError",
      }),
    ).toMatchObject({
      code: "NOT_FOUND",
      message: "Resource not found.",
    });
  });

  it("maps database-enforced write limits to a stable public error", () => {
    expect(
      mapDataError({ code: "WG429", message: "internal counter details" }),
    ).toMatchObject({
      code: "RATE_LIMITED",
      message: "Too many requests. Please wait and try again.",
    });
  });
});

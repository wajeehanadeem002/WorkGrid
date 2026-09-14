import { describe, expect, it } from "vitest";
import { AppError } from "@/lib/security/errors";
import {
  assertOrganizationResource,
  loadOrganizationContext,
  requirePermission,
} from "./context";

const organization = {
  id: "11111111-1111-4111-8111-111111111111",
  name: "Northstar",
  slug: "northstar",
};

describe("loadOrganizationContext", () => {
  it("returns only a membership resolved for the authenticated subject", async () => {
    const context = await loadOrganizationContext(
      "user_12345",
      "northstar",
      async (userId, slug) => {
        expect(userId).toBe("user_12345");
        expect(slug).toBe("northstar");
        return {
          organization,
          membership: { id: "member-1", userId, role: "admin" },
        };
      },
    );

    expect(context.membership.role).toBe("admin");
  });

  it("conceals whether a manipulated tenant slug exists", async () => {
    await expect(
      loadOrganizationContext("user_12345", "other-tenant", async () => null),
    ).rejects.toMatchObject({
      code: "NOT_FOUND",
      message: "Organization not found.",
    });
  });
});

describe("resource authorization", () => {
  const context = {
    userId: "user_12345",
    organization,
    membership: {
      id: "member-1",
      userId: "user_12345",
      role: "member" as const,
    },
  };

  it("denies permissions that the membership role does not have", () => {
    expect(() => requirePermission(context, "project:create")).toThrowError(
      AppError,
    );
    expect(() => requirePermission(context, "project:create")).toThrow(
      "You do not have permission to perform this action.",
    );
  });

  it("allows permitted operations and same-tenant resources", () => {
    expect(requirePermission(context, "task:update")).toBe(context);
    expect(() =>
      assertOrganizationResource(context, context.organization.id),
    ).not.toThrow();
  });

  it("rejects resources from another organization", () => {
    expect(() =>
      assertOrganizationResource(
        context,
        "22222222-2222-4222-8222-222222222222",
      ),
    ).toThrow("Resource not found.");
  });
});

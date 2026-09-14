import { describe, expect, it } from "vitest";
import { selectVerifiedPrimaryEmail } from "./clerk-email";

describe("Clerk verified identity binding", () => {
  it("returns only the verified primary address", () => {
    expect(
      selectVerifiedPrimaryEmail({
        primaryEmailAddressId: "email_primary",
        emailAddresses: [
          {
            id: "email_other",
            emailAddress: "other@example.com",
            verification: { status: "verified" },
          },
          {
            id: "email_primary",
            emailAddress: " Owner@Example.com ",
            verification: { status: "verified" },
          },
        ],
      }),
    ).toBe("owner@example.com");
  });

  it("rejects an unverified or missing primary address", () => {
    expect(
      selectVerifiedPrimaryEmail({
        primaryEmailAddressId: "email_primary",
        emailAddresses: [
          {
            id: "email_primary",
            emailAddress: "pending@example.com",
            verification: { status: "unverified" },
          },
        ],
      }),
    ).toBeNull();
  });
});

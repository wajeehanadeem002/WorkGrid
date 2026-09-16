import { unstable_doesMiddlewareMatch } from "next/experimental/testing/server";
import { describe, expect, it } from "vitest";
import { config } from "./proxy";

describe("proxy matcher", () => {
  it("routes Clerk frontend API JavaScript assets through the proxy", () => {
    expect(
      unstable_doesMiddlewareMatch({
        config,
        nextConfig: {},
        url: "/__clerk/npm/@clerk/clerk-js@6/dist/clerk.browser.js",
      }),
    ).toBe(true);
  });

  it("continues to bypass ordinary Next.js static assets", () => {
    expect(
      unstable_doesMiddlewareMatch({
        config,
        nextConfig: {},
        url: "/_next/static/chunks/app.js",
      }),
    ).toBe(false);
  });
});

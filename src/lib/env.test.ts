import { describe, expect, it } from "vitest";
import { parsePublicEnv } from "./env";

describe("public environment validation", () => {
  it("accepts configured public endpoints and keys", () => {
    expect(
      parsePublicEnv({
        NEXT_PUBLIC_SUPABASE_URL: "https://sample.supabase.co",
        NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "sb_publishable_sample",
        NEXT_PUBLIC_APP_URL: "https://workgrid.example",
      }),
    ).toEqual({
      NEXT_PUBLIC_SUPABASE_URL: "https://sample.supabase.co",
      NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "sb_publishable_sample",
      NEXT_PUBLIC_APP_URL: "https://workgrid.example",
    });
  });

  it("rejects malformed configuration before a provider call", () => {
    expect(() =>
      parsePublicEnv({
        NEXT_PUBLIC_SUPABASE_URL: "not-a-url",
        NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "",
        NEXT_PUBLIC_APP_URL: "also-not-a-url",
      }),
    ).toThrow("WorkGrid environment configuration is invalid");
  });
});

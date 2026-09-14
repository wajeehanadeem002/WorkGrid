import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const css = readFileSync(resolve(process.cwd(), "src/app/globals.css"), "utf8");

describe("WorkGrid editorial theme", () => {
  it("uses the warm ivory and forest design tokens", () => {
    const root = css.match(/:root\s*\{([^}]*)\}/s)?.[1];

    expect(root).toContain("color-scheme: light");
    expect(root).toContain("--background: #f4f1e8");
    expect(root).toContain("--surface: #fffdf8");
    expect(root).toContain("--text: #10201d");
    expect(root).toContain("--accent: #075c4b");
  });

  it("gives the marketing headline an editorial serif voice", () => {
    const heading = css.match(/\.hero h1\s*\{([^}]*)\}/s)?.[1];

    expect(heading).toMatch(/font-family:\s*Georgia,/);
    expect(heading).toContain("font-weight: 500");
  });

  it("keeps the authenticated shell on light surfaces", () => {
    const sidebar = css.match(/\.sidebar\s*\{([^}]*)\}/s)?.[1];

    expect(sidebar).toContain("background: var(--surface)");
    expect(sidebar).toContain("color: var(--text)");
  });
});

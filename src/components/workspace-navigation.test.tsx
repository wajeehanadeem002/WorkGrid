import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

describe("authenticated shell navigation layout", () => {
  it("keeps mobile navigation out of the desktop grid by default", () => {
    const css = readFileSync(
      resolve(process.cwd(), "src/app/globals.css"),
      "utf8",
    );
    const style = document.createElement("style");
    style.textContent = css;
    document.head.append(style);
    const nav = document.createElement("nav");
    nav.className = "mobile-nav";
    document.body.append(nav);

    expect(getComputedStyle(nav).display).toBe("none");

    style.remove();
  });

  it("uses the compact navigation throughout tablet portrait widths", () => {
    const css = readFileSync(
      resolve(process.cwd(), "src/app/globals.css"),
      "utf8",
    );
    const baseRule = css.match(/\.mobile-header,\s*\.mobile-nav\s*\{([^}]*)\}/);
    const tabletBreakpoint = css.indexOf("@media (max-width: 900px)");
    const mobileBreakpoint = css.indexOf("@media (max-width: 760px)");
    const tabletRules = css.slice(tabletBreakpoint, mobileBreakpoint);

    expect(baseRule?.[1]).toContain("display: none");
    expect(tabletBreakpoint).toBeGreaterThan(-1);
    expect(tabletRules).toMatch(/\.app-shell\s*\{[^}]*display:\s*block;/s);
    expect(tabletRules).toMatch(/\.sidebar\s*\{[^}]*display:\s*none;/s);
    expect(tabletRules).toMatch(/\.mobile-nav\s*\{[^}]*display:\s*flex;/s);
    expect(css.slice(0, tabletBreakpoint)).not.toMatch(
      /\.mobile-nav\s*\{[^}]*display:\s*flex;/s,
    );
  });

  it("keeps every mobile destination reachable without a visible scrollbar", () => {
    const css = readFileSync(
      resolve(process.cwd(), "src/app/globals.css"),
      "utf8",
    );
    const tabletBreakpoint = css.indexOf("@media (max-width: 900px)");
    const mobileBreakpoint = css.indexOf("@media (max-width: 760px)");
    const tabletRules = css.slice(tabletBreakpoint, mobileBreakpoint);

    expect(tabletRules).toMatch(
      /\.mobile-nav\s*\{[^}]*overflow-x:\s*auto;[^}]*scrollbar-width:\s*none;[^}]*scroll-snap-type:\s*x proximity;[^}]*overscroll-behavior-inline:\s*contain;/s,
    );
    expect(tabletRules).toMatch(
      /\.mobile-nav::-webkit-scrollbar\s*\{[^}]*display:\s*none;/s,
    );
    expect(tabletRules).toMatch(
      /\.mobile-nav a\s*\{[^}]*scroll-snap-align:\s*start;/s,
    );
  });

  it("lets the final metric span the mobile grid only when it is unpaired", () => {
    const css = readFileSync(
      resolve(process.cwd(), "src/app/globals.css"),
      "utf8",
    );
    const mobileRules = css.slice(css.indexOf("@media (max-width: 760px)"));

    expect(mobileRules).toMatch(
      /\.metric-grid > \.metric:last-child:nth-child\(odd\)\s*\{[^}]*grid-column:\s*1\s*\/\s*-1;/s,
    );
  });
});

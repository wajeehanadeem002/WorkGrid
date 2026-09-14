import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

function readPngSize(path: string) {
  const image = readFileSync(resolve(process.cwd(), path));
  const pngSignature = image.subarray(0, 8).toString("hex");

  expect(pngSignature).toBe("89504e470d0a1a0a");

  return {
    width: image.readUInt32BE(16),
    height: image.readUInt32BE(20),
  };
}

describe("application icons", () => {
  it("provides a square browser favicon through the Next.js icon convention", () => {
    expect(readPngSize("src/app/icon.png")).toEqual({ width: 64, height: 64 });
  });

  it("provides an Apple touch icon", () => {
    expect(readPngSize("src/app/apple-icon.png")).toEqual({
      width: 180,
      height: 180,
    });
  });

  it("keeps a higher-resolution reusable brand mark", () => {
    expect(readPngSize("public/brand/workgrid-mark.png")).toEqual({
      width: 256,
      height: 256,
    });
  });
});

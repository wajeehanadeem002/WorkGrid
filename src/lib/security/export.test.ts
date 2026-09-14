import { describe, expect, it } from "vitest";
import { assertSameOrigin, parseExportInput, toCsv } from "./export";

describe("CSV export", () => {
  it("escapes formulas, quotes, commas, and newlines", () => {
    const csv = toCsv(
      [
        {
          name: '=HYPERLINK("https://bad.example")',
          note: "a,b\nline",
          count: 2,
        },
      ],
      ["name", "note", "count"],
    );

    expect(csv).toBe(
      'name,note,count\r\n"\'=HYPERLINK(""https://bad.example"")","a,b\nline",2\r\n',
    );
  });

  it("renders nullish values as empty fields", () => {
    expect(toCsv([{ value: null }, { value: undefined }], ["value"])).toBe(
      "value\r\n\r\n\r\n",
    );
  });
});

describe("export request boundary", () => {
  it("validates format and resource before quota can be consumed", () => {
    expect(parseExportInput({ format: "csv", resource: "tasks" })).toEqual({
      format: "csv",
      resource: "tasks",
    });
    expect(() =>
      parseExportInput({ format: "zip", resource: "tasks" }),
    ).toThrow();
    expect(() =>
      parseExportInput({ format: "csv", resource: "audit_logs" }),
    ).toThrow();
  });

  it("rejects cross-site state-changing export requests", () => {
    const request = new Request("https://workgrid.example/api/export", {
      method: "POST",
      headers: { Origin: "https://attacker.example" },
    });
    expect(() => assertSameOrigin(request, "https://workgrid.example")).toThrow(
      "origin",
    );
  });
});

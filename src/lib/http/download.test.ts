import { describe, expect, it } from "vitest";
import { createDownloadResponse } from "./download";

describe("createDownloadResponse", () => {
  it("streams private downloads with explicit metadata", async () => {
    const response = createDownloadResponse("id,title\n1,Review", {
      contentType: "text/csv; charset=utf-8",
      filename: "northstar-tasks.csv",
      truncated: false,
    });

    expect(response.body).toBeInstanceOf(ReadableStream);
    expect(response.headers.get("Cache-Control")).toBe("private, no-store");
    expect(response.headers.get("Content-Disposition")).toBe(
      "attachment; filename=\"northstar-tasks.csv\"; filename*=UTF-8''northstar-tasks.csv",
    );
    expect(response.headers.get("X-WorkGrid-Export-Truncated")).toBe("false");
    await expect(response.text()).resolves.toBe("id,title\n1,Review");
  });

  it("prevents header injection while preserving a UTF-8 download name", () => {
    const response = createDownloadResponse("safe", {
      contentType: "text/plain",
      filename: "Q3 résumé\r\nInjected.pdf",
      truncated: false,
    });
    const disposition = response.headers.get("Content-Disposition") ?? "";

    expect(disposition).not.toContain("\r");
    expect(disposition).not.toContain("\n");
    expect(disposition).toContain(
      "filename*=UTF-8''Q3%20r%C3%A9sum%C3%A9Injected.pdf",
    );
  });
});

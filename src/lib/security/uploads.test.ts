import { describe, expect, it } from "vitest";
import {
  MAX_ATTACHMENT_BYTES,
  buildStoragePath,
  normalizeOriginalFilename,
  sanitizeFilename,
  validateAttachmentContent,
  validateAttachmentFile,
  sha256Hex,
} from "./uploads";

describe("attachment upload policy", () => {
  it("accepts an allowlisted file within the size limit", () => {
    const file = new File(["report"], "Q3 report.pdf", {
      type: "application/pdf",
    });
    expect(validateAttachmentFile(file)).toEqual({ ok: true });
  });

  it("rejects executable and ambiguous file types", () => {
    const executable = new File(["MZ"], "payload.exe", {
      type: "application/octet-stream",
    });
    expect(validateAttachmentFile(executable)).toEqual({
      ok: false,
      message: "This file type is not allowed.",
    });
    expect(
      validateAttachmentFile({
        name: "payload.exe",
        type: "application/pdf",
        size: 200,
      }),
    ).toEqual({
      ok: false,
      message: "The file extension does not match its type.",
    });
  });

  it("rejects empty and oversized files", () => {
    expect(
      validateAttachmentFile(new File([], "empty.txt", { type: "text/plain" })),
    ).toEqual({
      ok: false,
      message: "Choose a non-empty file.",
    });

    const oversized = {
      name: "large.pdf",
      type: "application/pdf",
      size: MAX_ATTACHMENT_BYTES + 1,
    };
    expect(validateAttachmentFile(oversized)).toEqual({
      ok: false,
      message: "Files must be 4 MB or smaller.",
    });
  });

  it("rejects content whose signature does not match the declared safe type", async () => {
    const pdf = new File(["%PDF-1.7"], "brief.pdf", {
      type: "application/pdf",
    });
    const disguisedExecutable = new File(["MZ executable"], "brief.pdf", {
      type: "application/pdf",
    });

    await expect(validateAttachmentContent(pdf)).resolves.toEqual({ ok: true });
    await expect(
      validateAttachmentContent(disguisedExecutable),
    ).resolves.toEqual({
      ok: false,
      message: "The file content does not match its declared type.",
    });
  });

  it("recognizes each allowlisted binary and text signature", async () => {
    const cases: Array<[Blob & { type: string }, string]> = [
      [
        new File(
          [new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])],
          "a.png",
          { type: "image/png" },
        ),
        "PNG",
      ],
      [
        new File([new Uint8Array([0xff, 0xd8, 0xff, 0xe0])], "a.jpg", {
          type: "image/jpeg",
        }),
        "JPEG",
      ],
      [new File(["GIF89a"], "a.gif", { type: "image/gif" }), "GIF"],
      [
        new File(
          [
            new Uint8Array([
              0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0, 0x57, 0x45, 0x42, 0x50,
            ]),
          ],
          "a.webp",
          { type: "image/webp" },
        ),
        "WebP",
      ],
      [new File(["plain text"], "a.txt", { type: "text/plain" }), "text"],
      [new File(["column,value"], "a.csv", { type: "text/csv" }), "CSV"],
    ];

    for (const [file, label] of cases) {
      await expect(validateAttachmentContent(file), label).resolves.toEqual({
        ok: true,
      });
    }
    await expect(
      validateAttachmentContent(
        new File([new Uint8Array([0x61, 0x00, 0x62])], "binary.txt", {
          type: "text/plain",
        }),
      ),
    ).resolves.toMatchObject({ ok: false });
  });

  it("rejects binary control bytes anywhere in a text attachment", async () => {
    const payload = new Uint8Array(640);
    payload.fill(0x61);
    payload[600] = 0;

    await expect(
      validateAttachmentContent(
        new File([payload], "disguised-binary.txt", { type: "text/plain" }),
      ),
    ).resolves.toEqual({
      ok: false,
      message: "The file content does not match its declared type.",
    });
  });

  it("rejects invalid UTF-8 anywhere in a text attachment", async () => {
    const payload = new Uint8Array(640);
    payload.fill(0x61);
    payload[600] = 0xff;

    await expect(
      validateAttachmentContent(
        new File([payload], "invalid-utf8.csv", { type: "text/csv" }),
      ),
    ).resolves.toMatchObject({ ok: false });
  });

  it("rejects non-text control characters while scanning the complete file", async () => {
    const payload = new Uint8Array(640);
    payload.fill(0x61);
    payload[600] = 0x01;

    await expect(
      validateAttachmentContent(
        new File([payload], "binary-control.txt", { type: "text/plain" }),
      ),
    ).resolves.toMatchObject({ ok: false });
  });
});

describe("storage paths", () => {
  it("removes path traversal and unsafe filename characters", () => {
    expect(sanitizeFilename("../../Payroll (final).PDF")).toBe(
      "payroll-final.pdf",
    );
  });

  it("keeps a human-readable download name without paths or control characters", () => {
    expect(normalizeOriginalFilename("..\\..\\Q3\u0000 Report.PDF")).toBe(
      "Q3- Report.PDF",
    );
  });

  it("places an object inside immutable tenant and resource segments", () => {
    expect(
      buildStoragePath({
        organizationId: "11111111-1111-4111-8111-111111111111",
        projectId: "22222222-2222-4222-8222-222222222222",
        taskId: "33333333-3333-4333-8333-333333333333",
        objectId: "44444444-4444-4444-8444-444444444444",
        fileName: "Design notes.txt",
      }),
    ).toBe(
      "11111111-1111-4111-8111-111111111111/22222222-2222-4222-8222-222222222222/33333333-3333-4333-8333-333333333333/44444444-4444-4444-8444-444444444444/design-notes.txt",
    );
  });

  it("hashes the complete upload for the trusted finalization proof", async () => {
    await expect(sha256Hex(new Blob(["workgrid"]))).resolves.toBe(
      "0ad9345b0e7646746a40daf026daa5244e9619dbec67ce7225604e4f43708ed3",
    );
  });
});

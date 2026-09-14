import { describe, expect, it } from "vitest";
import {
  buildProofPayload,
  createServerProof,
  attachmentProofParts,
  parseServerProofSecret,
} from "./server-proof";

describe("server-only operation proofs", () => {
  it("length-prefixes UTF-8 values so fields cannot be confused with delimiters", () => {
    expect(buildProofPayload(["attachment", "org", "résumé.pdf"])).toBe(
      "10:attachment|3:org|12:résumé.pdf",
    );
  });

  it("produces the database-compatible HMAC without exposing the secret", () => {
    expect(
      createServerProof(
        "finalize-attachment",
        ["attachment", "org", "résumé.pdf"],
        "0123456789abcdef0123456789abcdef",
      ),
    ).toBe("7ef49bf1318d99159ebf17a0656c5792f23fa4fe9c2a99852da715c8d9a30f11");
  });

  it("rejects missing and weak shared proof secrets", () => {
    expect(() => parseServerProofSecret(undefined)).toThrow(
      "WORKGRID_SERVER_PROOF_SECRET",
    );
    expect(() => parseServerProofSecret("too-short")).toThrow(
      "WORKGRID_SERVER_PROOF_SECRET",
    );
  });

  it("binds an attachment proof to the actor, tenant, resource, metadata, and content digest", () => {
    expect(
      attachmentProofParts({
        actorId: "user_123",
        organizationId: "org",
        projectId: "project",
        taskId: "task",
        attachmentId: "attachment",
        storagePath: "org/project/task/attachment/file.pdf",
        originalName: "file.pdf",
        mimeType: "application/pdf",
        sizeBytes: 42,
        contentSha256: "abc123",
      }),
    ).toEqual([
      "user_123",
      "org",
      "project",
      "task",
      "attachment",
      "org/project/task/attachment/file.pdf",
      "file.pdf",
      "application/pdf",
      "42",
      "abc123",
    ]);
  });
});

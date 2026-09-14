import "server-only";

import { createHmac } from "node:crypto";
import { z } from "zod";

const serverProofSecretSchema = z.string().min(32).max(256);

export function parseServerProofSecret(value: string | undefined): string {
  const parsed = serverProofSecretSchema.safeParse(value);
  if (!parsed.success) {
    throw new Error(
      "WORKGRID_SERVER_PROOF_SECRET must be configured with at least 32 characters.",
    );
  }
  return parsed.data;
}

export function buildProofPayload(parts: readonly string[]): string {
  return parts
    .map((part) => `${Buffer.byteLength(part, "utf8")}:${part}`)
    .join("|");
}

export function createServerProof(
  purpose: string,
  parts: readonly string[],
  secret = parseServerProofSecret(process.env.WORKGRID_SERVER_PROOF_SECRET),
): string {
  return createHmac("sha256", secret)
    .update(`${purpose}:${buildProofPayload(parts)}`, "utf8")
    .digest("hex");
}

export interface AttachmentProofInput {
  actorId: string;
  organizationId: string;
  projectId: string;
  taskId: string | null;
  attachmentId: string;
  storagePath: string;
  originalName: string;
  mimeType: string;
  sizeBytes: number;
  contentSha256: string;
}

export function attachmentProofParts(input: AttachmentProofInput): string[] {
  return [
    input.actorId,
    input.organizationId,
    input.projectId,
    input.taskId ?? "",
    input.attachmentId,
    input.storagePath,
    input.originalName,
    input.mimeType.toLowerCase(),
    String(input.sizeBytes),
    input.contentSha256.toLowerCase(),
  ];
}

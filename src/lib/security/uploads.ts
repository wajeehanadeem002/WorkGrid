export const MAX_ATTACHMENT_BYTES = 4 * 1024 * 1024;

const extensionsByMimeType = {
  "application/pdf": ["pdf"],
  "text/plain": ["txt"],
  "text/csv": ["csv"],
  "image/png": ["png"],
  "image/jpeg": ["jpg", "jpeg"],
  "image/gif": ["gif"],
  "image/webp": ["webp"],
} as const;

export const ALLOWED_ATTACHMENT_TYPES = new Set(
  Object.keys(extensionsByMimeType),
);

interface FileDescriptor {
  name: string;
  type: string;
  size: number;
}

export type UploadValidation = { ok: true } | { ok: false; message: string };

export function validateAttachmentFile(file: FileDescriptor): UploadValidation {
  if (file.size <= 0) return { ok: false, message: "Choose a non-empty file." };
  if (file.size > MAX_ATTACHMENT_BYTES) {
    return { ok: false, message: "Files must be 4 MB or smaller." };
  }
  if (!ALLOWED_ATTACHMENT_TYPES.has(file.type.toLowerCase())) {
    return { ok: false, message: "This file type is not allowed." };
  }
  const mimeType = file.type.toLowerCase() as keyof typeof extensionsByMimeType;
  const extension = file.name.split(".").at(-1)?.toLowerCase() ?? "";
  if (
    !(extensionsByMimeType[mimeType] as readonly string[]).includes(extension)
  ) {
    return {
      ok: false,
      message: "The file extension does not match its type.",
    };
  }
  return { ok: true };
}

function startsWith(bytes: Uint8Array, signature: readonly number[]): boolean {
  return signature.every((value, index) => bytes[index] === value);
}

function isSafeUtf8Text(bytes: Uint8Array): boolean {
  try {
    const text = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
    return !/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f-\u009f]/u.test(text);
  } catch {
    return false;
  }
}

export async function validateAttachmentContent(
  file: Blob & { type: string },
): Promise<UploadValidation> {
  const type = file.type.toLowerCase();
  const isText = type === "text/plain" || type === "text/csv";
  const bytes = new Uint8Array(
    await (isText ? file.arrayBuffer() : file.slice(0, 512).arrayBuffer()),
  );
  const valid =
    (type === "application/pdf" &&
      startsWith(bytes, [0x25, 0x50, 0x44, 0x46, 0x2d])) ||
    (type === "image/png" &&
      startsWith(bytes, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) ||
    (type === "image/jpeg" && startsWith(bytes, [0xff, 0xd8, 0xff])) ||
    (type === "image/gif" &&
      (startsWith(bytes, [0x47, 0x49, 0x46, 0x38, 0x37, 0x61]) ||
        startsWith(bytes, [0x47, 0x49, 0x46, 0x38, 0x39, 0x61]))) ||
    (type === "image/webp" &&
      startsWith(bytes, [0x52, 0x49, 0x46, 0x46]) &&
      startsWith(bytes.slice(8), [0x57, 0x45, 0x42, 0x50])) ||
    (isText && bytes.length > 0 && isSafeUtf8Text(bytes));
  return valid
    ? { ok: true }
    : {
        ok: false,
        message: "The file content does not match its declared type.",
      };
}

export async function sha256Hex(file: Blob): Promise<string> {
  const bytes = await file.arrayBuffer();
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest), (byte) =>
    byte.toString(16).padStart(2, "0"),
  ).join("");
}

export function normalizeOriginalFilename(input: string): string {
  const basename =
    input.replaceAll("\\", "/").split("/").at(-1) ?? "attachment";
  const normalized = basename
    .normalize("NFKC")
    .replace(/[\u0000-\u001f\u007f/\\]/g, "-")
    .replace(/^[. ]+|[. ]+$/g, "")
    .slice(0, 255);
  return normalized || "attachment";
}

export function sanitizeFilename(input: string): string {
  const basename =
    input.replaceAll("\\", "/").split("/").at(-1) ?? "attachment";
  const dotIndex = basename.lastIndexOf(".");
  const hasExtension = dotIndex > 0 && dotIndex < basename.length - 1;
  const rawStem = hasExtension ? basename.slice(0, dotIndex) : basename;
  const rawExtension = hasExtension ? basename.slice(dotIndex + 1) : "";
  const stem = rawStem
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 100);
  const extension = rawExtension
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "")
    .slice(0, 10);
  const safeStem = stem || "attachment";
  return extension ? `${safeStem}.${extension}` : safeStem;
}

export function buildStoragePath(input: {
  organizationId: string;
  projectId: string;
  taskId?: string | null;
  objectId: string;
  fileName: string;
}): string {
  const resource = input.taskId ?? "project";
  return [
    input.organizationId,
    input.projectId,
    resource,
    input.objectId,
    sanitizeFilename(input.fileName),
  ].join("/");
}

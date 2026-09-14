import type { Json } from "@/lib/supabase/database.types";
import { AppError, type ErrorCode } from "@/lib/security/errors";

type RpcRecord = { [key: string]: Json | undefined };

const errorByRpcCode: Record<
  string,
  { code: Exclude<ErrorCode, "UNEXPECTED">; message: string }
> = {
  UNAUTHENTICATED: {
    code: "UNAUTHENTICATED",
    message: "Sign in to continue.",
  },
  FORBIDDEN: {
    code: "FORBIDDEN",
    message: "You do not have permission to perform this action.",
  },
  NOT_FOUND: {
    code: "NOT_FOUND",
    message: "The requested item was not found.",
  },
  CONFLICT: {
    code: "CONFLICT",
    message: "The item changed before the operation could be completed.",
  },
  VALIDATION: {
    code: "VALIDATION",
    message: "The request contains invalid values.",
  },
  RATE_LIMITED: {
    code: "RATE_LIMITED",
    message: "Too many requests. Please wait and try again.",
  },
  STORAGE_MISMATCH: {
    code: "UNAVAILABLE",
    message: "The stored file could not be verified. Please try again.",
  },
  STORAGE_OBJECT_EXISTS: {
    code: "CONFLICT",
    message: "The stored file must be removed before cleanup can finish.",
  },
  CONFIGURATION: {
    code: "UNAVAILABLE",
    message: "The service is not fully configured. Contact an administrator.",
  },
  INVALID_INVITATION: {
    code: "VALIDATION",
    message:
      "This invitation is invalid, expired, used, or belongs to another email address.",
  },
};

function isRpcRecord(value: Json | undefined): value is RpcRecord {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

export function requireRpcResult(
  data: Json | undefined,
  requiredFields: readonly string[] = [],
  messages: Partial<Record<string, string>> = {},
): RpcRecord & { ok: true } {
  if (!isRpcRecord(data)) {
    throw new AppError(
      "UNAVAILABLE",
      "The service is temporarily unavailable. Please try again.",
    );
  }
  if (data.ok !== true) {
    const rpcCode = typeof data.code === "string" ? data.code : "";
    const mapped = errorByRpcCode[rpcCode];
    if (!mapped) {
      throw new AppError(
        "UNAVAILABLE",
        "The service is temporarily unavailable. Please try again.",
      );
    }
    throw new AppError(mapped.code, messages[rpcCode] ?? mapped.message);
  }
  if (requiredFields.some((field) => data[field] === undefined)) {
    throw new AppError(
      "UNAVAILABLE",
      "The service is temporarily unavailable. Please try again.",
    );
  }
  return data as RpcRecord & { ok: true };
}

import { NextResponse } from "next/server";
import { AppError } from "@/lib/security/errors";
import { ZodError } from "zod";

const statusByCode = {
  VALIDATION: 400,
  UNAUTHENTICATED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  RATE_LIMITED: 429,
  UNAVAILABLE: 503,
} as const;

export function routeErrorResponse(error: unknown): NextResponse {
  if (error instanceof ZodError) {
    return NextResponse.json(
      {
        error: {
          code: "VALIDATION",
          message: "The request contains invalid values.",
        },
      },
      { status: 400, headers: { "Cache-Control": "no-store" } },
    );
  }
  if (error instanceof AppError) {
    return NextResponse.json(
      { error: { code: error.code, message: error.message } },
      {
        status: statusByCode[error.code],
        headers: { "Cache-Control": "no-store" },
      },
    );
  }
  const requestId = crypto.randomUUID();
  console.error("Unexpected WorkGrid route error", { requestId, error });
  return NextResponse.json(
    {
      error: {
        code: "UNEXPECTED",
        message: "Something went wrong.",
        requestId,
      },
    },
    { status: 500, headers: { "Cache-Control": "no-store" } },
  );
}

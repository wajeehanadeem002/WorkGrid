import { ZodError } from "zod";

export type ErrorCode =
  | "VALIDATION"
  | "UNAUTHENTICATED"
  | "FORBIDDEN"
  | "NOT_FOUND"
  | "CONFLICT"
  | "RATE_LIMITED"
  | "UNAVAILABLE"
  | "UNEXPECTED";

export interface ActionState {
  status: "idle" | "success" | "error";
  code?: ErrorCode;
  message?: string;
  fieldErrors?: Record<string, string[]>;
  requestId?: string;
  data?: Record<string, string>;
}

export const initialActionState: ActionState = { status: "idle" };

export class AppError extends Error {
  constructor(
    public readonly code: Exclude<ErrorCode, "UNEXPECTED">,
    message: string,
    public readonly fieldErrors?: Record<string, string[]>,
  ) {
    super(message);
    this.name = "AppError";
  }
}

export function toActionState(
  error: unknown,
  requestId = crypto.randomUUID(),
): ActionState {
  if (error instanceof AppError) {
    return {
      status: "error",
      code: error.code,
      message: error.message,
      ...(error.fieldErrors ? { fieldErrors: error.fieldErrors } : {}),
    };
  }

  if (error instanceof ZodError) {
    return {
      status: "error",
      code: "VALIDATION",
      message: "Check the highlighted fields and try again.",
      fieldErrors: error.flatten().fieldErrors as Record<string, string[]>,
    };
  }

  console.error("Unexpected WorkGrid error", { requestId, error });
  return {
    status: "error",
    code: "UNEXPECTED",
    message: "Something went wrong. Please try again.",
    requestId,
  };
}

export function databaseError(
  message = "The service is temporarily unavailable.",
): AppError {
  return new AppError("UNAVAILABLE", message);
}

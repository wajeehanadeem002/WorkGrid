import { AppError } from "@/lib/security/errors";

interface DataError {
  code: string;
  message: string;
  details?: string | null;
  hint?: string | null;
  name?: string;
}

export function mapDataError(error: DataError): AppError {
  if (error.code === "23505")
    return new AppError("CONFLICT", "That value is already in use.");
  if (error.code === "23503")
    return new AppError(
      "CONFLICT",
      "This item is still referenced by other work.",
    );
  if (error.code === "PGRST116" || error.code === "P0002") {
    return new AppError("NOT_FOUND", "Resource not found.");
  }
  if (error.code === "42501") {
    return new AppError(
      "FORBIDDEN",
      "You do not have permission to perform this action.",
    );
  }
  if (error.code === "WG429") {
    return new AppError(
      "RATE_LIMITED",
      "Too many requests. Please wait and try again.",
    );
  }
  return new AppError(
    "UNAVAILABLE",
    "The data service is temporarily unavailable.",
  );
}

export function assertData<T>(data: T | null, error: DataError | null): T {
  if (error) throw mapDataError(error);
  if (data === null) throw new AppError("NOT_FOUND", "Resource not found.");
  return data;
}

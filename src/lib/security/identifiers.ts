import { z } from "zod";
import { AppError } from "./errors";

const resourceIdSchema = z.uuid();

export function requireResourceId(value: string): string {
  if (!resourceIdSchema.safeParse(value).success) {
    throw new AppError("NOT_FOUND", "Resource not found.");
  }
  return value;
}

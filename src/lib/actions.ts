import type { z } from "zod";
import {
  AppError,
  type ActionState,
  toActionState,
} from "@/lib/security/errors";

export function valuesFromFormData(
  formData: FormData,
): Record<string, FormDataEntryValue> {
  return Object.fromEntries(formData.entries());
}

export function parseActionInput<Schema extends z.ZodType>(
  schema: Schema,
  formData: FormData,
): z.output<Schema> {
  const parsed = schema.safeParse(valuesFromFormData(formData));
  if (!parsed.success) {
    const flattened = parsed.error.flatten();
    throw new AppError(
      "VALIDATION",
      "Check the highlighted fields and try again.",
      flattened.fieldErrors as Record<string, string[]>,
    );
  }
  return parsed.data;
}

export async function actionResult(
  operation: () => Promise<ActionState>,
): Promise<ActionState> {
  try {
    return await operation();
  } catch (error) {
    return toActionState(error);
  }
}

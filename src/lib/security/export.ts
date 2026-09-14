import { z } from "zod";
import { AppError } from "./errors";

type CsvValue = string | number | boolean | null | undefined;

const exportInputSchema = z.discriminatedUnion("format", [
  z.object({ format: z.literal("json"), resource: z.literal("all") }),
  z.object({
    format: z.literal("csv"),
    resource: z.enum(["projects", "tasks"]),
  }),
]);

export type ExportInput = z.infer<typeof exportInputSchema>;

export function parseExportInput(input: {
  format: unknown;
  resource: unknown;
}): ExportInput {
  return exportInputSchema.parse(input);
}

export function assertSameOrigin(request: Request, appUrl: string): void {
  const origin = request.headers.get("origin");
  if (!origin || origin !== new URL(appUrl).origin) {
    throw new AppError("FORBIDDEN", "The request origin is not allowed.");
  }
}

function escapeCsvValue(value: CsvValue): string {
  if (value === null || value === undefined) return "";
  let rendered = String(value);
  if (/^[=+\-@\t\r]/.test(rendered)) rendered = `'${rendered}`;
  if (/[",\r\n]/.test(rendered)) {
    return `"${rendered.replaceAll('"', '""')}"`;
  }
  return rendered;
}

export function toCsv<Row extends Record<string, CsvValue>>(
  rows: readonly Row[],
  columns: readonly (keyof Row & string)[],
): string {
  const header = columns.map(escapeCsvValue).join(",");
  const body = rows.map((row) =>
    columns.map((column) => escapeCsvValue(row[column])).join(","),
  );
  return [header, ...body, ""].join("\r\n");
}

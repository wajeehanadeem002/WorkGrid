import type { WorkGridClient } from "@/lib/supabase/server";
import { AppError } from "./errors";
import { mapDataError } from "@/lib/data/errors";

async function enforceOperationLimit(
  client: WorkGridClient,
  rpc: "consume_export_attempt" | "consume_upload_attempt",
  organizationId: string,
): Promise<void> {
  const { data, error } = await client.rpc(rpc, {
    target_organization_id: organizationId,
  });
  if (error) throw mapDataError(error);
  if (!data)
    throw new AppError(
      "RATE_LIMITED",
      "Too many requests. Please wait and try again.",
    );
}

export function enforceExportRateLimit(
  client: WorkGridClient,
  organizationId: string,
): Promise<void> {
  return enforceOperationLimit(
    client,
    "consume_export_attempt",
    organizationId,
  );
}

export function enforceUploadRateLimit(
  client: WorkGridClient,
  organizationId: string,
): Promise<void> {
  return enforceOperationLimit(
    client,
    "consume_upload_attempt",
    organizationId,
  );
}

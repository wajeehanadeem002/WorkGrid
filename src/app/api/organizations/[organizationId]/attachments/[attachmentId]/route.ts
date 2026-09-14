import { resolveOrganizationContextById } from "@/lib/auth/server-context";
import { getAttachment } from "@/lib/data/attachments";
import { contentDisposition } from "@/lib/http/download";
import { routeErrorResponse } from "@/lib/http/route-errors";
import { AppError } from "@/lib/security/errors";
import { uuidSchema } from "@/features/shared/schemas";
import { createAuthenticatedContext } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  {
    params,
  }: { params: Promise<{ organizationId: string; attachmentId: string }> },
) {
  const authenticated = await createAuthenticatedContext();
  try {
    const raw = await params;
    const organizationId = uuidSchema.parse(raw.organizationId);
    const attachmentId = uuidSchema.parse(raw.attachmentId);
    const { context, client } = await resolveOrganizationContextById(
      organizationId,
      authenticated,
    );
    const attachment = await getAttachment(
      client,
      context.organization.id,
      attachmentId,
    );
    const { data, error } = await client.storage
      .from("attachments")
      .download(attachment.storage_path);
    if (error)
      throw new AppError(
        "UNAVAILABLE",
        "The attachment could not be downloaded. Please try again.",
      );
    return new Response(data.stream(), {
      headers: {
        "Content-Type": attachment.mime_type,
        "Content-Length": String(data.size),
        "Content-Disposition": contentDisposition(attachment.original_name),
        "Cache-Control": "private, no-store",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error) {
    return routeErrorResponse(error);
  }
}

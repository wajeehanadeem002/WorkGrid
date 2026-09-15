"use server";

import { revalidatePath } from "next/cache";
import { actionResult } from "@/lib/actions";
import { requirePermission } from "@/lib/auth/context";
import { resolveOrganizationContext } from "@/lib/auth/server-context";
import { getAttachment } from "@/lib/data/attachments";
import { mapDataError } from "@/lib/data/errors";
import { requireRpcResult } from "@/lib/data/rpc";
import { getProject } from "@/lib/data/projects";
import { getTask } from "@/lib/data/tasks";
import { AppError, type ActionState } from "@/lib/security/errors";
import {
  buildStoragePath,
  normalizeOriginalFilename,
  sha256Hex,
  validateAttachmentContent,
  validateAttachmentFile,
} from "@/lib/security/uploads";
import { uuidSchema } from "@/features/shared/schemas";
import {
  createAuthenticatedContext,
  type WorkGridClient,
} from "@/lib/supabase/server";
import { enforceUploadRateLimit } from "@/lib/security/rate-limit";
import {
  attachmentProofParts,
  createServerProof,
} from "@/lib/security/server-proof";

const ATTACHMENT_DELETE_TIMEOUT_MS = 12_000;

function isTimeoutError(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const candidate = error as {
    name?: unknown;
    cause?: unknown;
    originalError?: unknown;
  };
  if (candidate.name === "TimeoutError") return true;
  return [candidate.originalError, candidate.cause].some(
    (nested) =>
      Boolean(nested) &&
      typeof nested === "object" &&
      (nested as { name?: unknown }).name === "TimeoutError",
  );
}

async function discardUntrustedAttachment(
  client: WorkGridClient,
  attachmentId: string,
  actorId: string,
  storagePath: string,
): Promise<void> {
  const cancellation = {
    attachment_id: attachmentId,
    server_proof: createServerProof("cancel-attachment", [
      actorId,
      attachmentId,
      storagePath,
    ]),
  };

  // The first call seals any uploaded object into `discarding`, where it can
  // no longer be read or replaced by a client. The second removes metadata
  // only after Storage confirms that the object is absent. Cleanup is best
  // effort: stale rows remain explicitly untrusted for the reconciler.
  await client.rpc("cancel_attachment_reservation", cancellation);
  await client.storage.from("attachments").remove([storagePath]);
  await client.rpc("cancel_attachment_reservation", cancellation);
}

export async function uploadAttachmentAction(
  slug: string,
  taskId: string,
  _state: ActionState,
  formData: FormData,
): Promise<ActionState> {
  void _state;
  const authenticated = await createAuthenticatedContext();
  return actionResult(async () => {
    const { context, client } = await resolveOrganizationContext(
      slug,
      authenticated,
    );
    requirePermission(context, "attachment:create");
    await enforceUploadRateLimit(client, context.organization.id);
    const taskIdentifier = uuidSchema.parse(taskId);
    const task = await getTask(client, context.organization.id, taskIdentifier);
    await getProject(client, context.organization.id, task.project_id);

    const file = formData.get("file");
    if (!(file instanceof File))
      throw new AppError("VALIDATION", "Choose a file to upload.");
    const validation = validateAttachmentFile(file);
    if (!validation.ok) throw new AppError("VALIDATION", validation.message);
    const contentValidation = await validateAttachmentContent(file);
    if (!contentValidation.ok)
      throw new AppError("VALIDATION", contentValidation.message);

    const attachmentId = crypto.randomUUID();
    const originalName = normalizeOriginalFilename(file.name);
    const mimeType = file.type.toLowerCase();
    const contentSha256 = await sha256Hex(file);
    const storagePath = buildStoragePath({
      organizationId: context.organization.id,
      projectId: task.project_id,
      taskId: task.id,
      objectId: attachmentId,
      fileName: file.name,
    });
    const proofParts = attachmentProofParts({
      actorId: context.userId,
      organizationId: context.organization.id,
      projectId: task.project_id,
      taskId: task.id,
      attachmentId,
      storagePath,
      originalName,
      mimeType,
      sizeBytes: file.size,
      contentSha256,
    });
    const { data: reservation, error: reservationError } = await client.rpc(
      "reserve_attachment",
      {
        attachment_id: attachmentId,
        target_organization_id: context.organization.id,
        target_project_id: task.project_id,
        target_task_id: task.id,
        object_path: storagePath,
        download_name: originalName,
        declared_mime_type: mimeType,
        declared_size_bytes: file.size,
        declared_content_sha256: contentSha256,
        server_proof: createServerProof("reserve-attachment", proofParts),
      },
    );
    if (reservationError) throw mapDataError(reservationError);
    requireRpcResult(reservation, ["attachment_id"]);

    const { data: uploadedObject, error: uploadError } = await client.storage
      .from("attachments")
      .upload(storagePath, file, {
        contentType: mimeType,
        upsert: false,
        cacheControl: "3600",
      });
    if (uploadError) {
      await discardUntrustedAttachment(
        client,
        attachmentId,
        context.userId,
        storagePath,
      );
      throw new AppError(
        "UNAVAILABLE",
        "The file could not be uploaded. Please try again.",
      );
    }

    const storageObjectId = uuidSchema.safeParse(uploadedObject?.id);
    if (!storageObjectId.success) {
      await discardUntrustedAttachment(
        client,
        attachmentId,
        context.userId,
        storagePath,
      );
      throw new AppError(
        "UNAVAILABLE",
        "The stored file could not be verified. Please try again.",
      );
    }

    const sealedProofParts = [...proofParts, storageObjectId.data];
    const { data: sealed, error: sealError } = await client.rpc(
      "seal_attachment_upload",
      {
        attachment_id: attachmentId,
        target_storage_object_id: storageObjectId.data,
        server_proof: createServerProof("seal-attachment", sealedProofParts),
      },
    );
    if (sealError) {
      await discardUntrustedAttachment(
        client,
        attachmentId,
        context.userId,
        storagePath,
      );
      throw mapDataError(sealError);
    }
    try {
      requireRpcResult(sealed);
    } catch (error) {
      await discardUntrustedAttachment(
        client,
        attachmentId,
        context.userId,
        storagePath,
      );
      throw error;
    }

    const { data: storedObject, error: downloadError } = await client.storage
      .from("attachments")
      .download(storagePath);
    if (downloadError || !storedObject) {
      await discardUntrustedAttachment(
        client,
        attachmentId,
        context.userId,
        storagePath,
      );
      throw new AppError(
        "UNAVAILABLE",
        "The stored file could not be verified. Please try again.",
      );
    }

    const storedContent = new Blob([await storedObject.arrayBuffer()], {
      type: mimeType,
    });
    const [storedContentValidation, storedContentSha256] = await Promise.all([
      validateAttachmentContent(storedContent),
      sha256Hex(storedContent),
    ]);
    if (
      !storedContentValidation.ok ||
      storedContent.size !== file.size ||
      storedContentSha256 !== contentSha256
    ) {
      await discardUntrustedAttachment(
        client,
        attachmentId,
        context.userId,
        storagePath,
      );
      throw new AppError(
        "UNAVAILABLE",
        "The stored file failed integrity verification and was not accepted.",
      );
    }

    const { data: finalized, error: finalizeError } = await client.rpc(
      "finalize_attachment",
      {
        attachment_id: attachmentId,
        target_storage_object_id: storageObjectId.data,
        declared_content_sha256: contentSha256,
        server_proof: createServerProof(
          "finalize-attachment",
          sealedProofParts,
        ),
      },
    );
    if (finalizeError) {
      await discardUntrustedAttachment(
        client,
        attachmentId,
        context.userId,
        storagePath,
      );
      throw mapDataError(finalizeError);
    }
    try {
      requireRpcResult(finalized);
    } catch (error) {
      await discardUntrustedAttachment(
        client,
        attachmentId,
        context.userId,
        storagePath,
      );
      throw error;
    }

    revalidatePath(`/app/${slug}/tasks/${task.id}`);
    return { status: "success", message: "Attachment uploaded." };
  });
}

export async function deleteAttachmentAction(
  slug: string,
  taskId: string,
  attachmentId: string,
  _state: ActionState,
  _formData: FormData,
): Promise<ActionState> {
  void _state;
  void _formData;
  const authenticated = await createAuthenticatedContext({
    requestTimeoutMs: ATTACHMENT_DELETE_TIMEOUT_MS,
  });
  return actionResult(async () => {
    const task = uuidSchema.parse(taskId);
    const attachment = uuidSchema.parse(attachmentId);
    const { context, client } = await resolveOrganizationContext(
      slug,
      authenticated,
    );
    await getTask(client, context.organization.id, task);
    const metadata = await getAttachment(
      client,
      context.organization.id,
      attachment,
    );
    if (metadata.task_id !== task)
      throw new AppError("NOT_FOUND", "Attachment not found.");

    const { data: begun, error: beginError } = await client.rpc(
      "begin_attachment_deletion",
      { attachment_id: attachment },
    );
    if (beginError) throw mapDataError(beginError);
    const deletion = requireRpcResult(begun, ["storage_path"]);
    if (
      typeof deletion.storage_path !== "string" ||
      deletion.storage_path !== metadata.storage_path
    ) {
      throw new AppError("UNAVAILABLE", "The attachment could not be deleted.");
    }

    let storageError: unknown = null;
    try {
      const result = await client.storage
        .from("attachments")
        .remove([metadata.storage_path]);
      storageError = result.error;
    } catch (error) {
      storageError = error;
    }

    if (isTimeoutError(storageError)) {
      // A timed-out DELETE is ambiguous: the provider may still finish after
      // the client aborts. Keep metadata sealed as `deleting` so the trusted
      // cleanup flow can reconcile it without restoring a path that may soon
      // disappear.
      revalidatePath(`/app/${slug}/tasks/${task}`);
      return {
        status: "success",
        message:
          "Deletion is still being confirmed. The attachment will remain unavailable while storage is reconciled.",
      };
    }

    const { data: reconciled, error: reconcileError } = await client.rpc(
      "reconcile_attachment_deletion",
      { attachment_id: attachment },
    );
    if (reconcileError) throw mapDataError(reconcileError);
    const outcome = requireRpcResult(reconciled, ["outcome"]);
    if (outcome.outcome !== "DELETED") {
      throw new AppError(
        "UNAVAILABLE",
        "The private file could not be removed. Its metadata was restored so the download remains consistent.",
      );
    }
    if (storageError) {
      // The reconciliation confirmed that no object remains despite the
      // provider error, so completing metadata deletion is safe.
    }
    revalidatePath(`/app/${slug}/tasks/${task}`);
    return { status: "success", message: "Attachment deleted." };
  });
}

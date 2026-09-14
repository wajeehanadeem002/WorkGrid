import "server-only";

import { createHash } from "node:crypto";
import type { AuthenticatedContext } from "@/lib/supabase/server";
import { createServerProof } from "@/lib/security/server-proof";
import { mapDataError } from "./errors";

export type InvitationPreview =
  | {
      ok: true;
      organizationName: string;
      organizationSlug: string;
      email: string;
      role: "member" | "admin";
      expiresAt: string;
    }
  | { ok: false; message: string };

export async function getInvitationPreview(
  authenticated: AuthenticatedContext,
  token: string,
  verifiedEmail: string | null,
): Promise<InvitationPreview> {
  if (!verifiedEmail) {
    return {
      ok: false,
      message:
        "Verify your primary email address before accepting an invitation.",
    };
  }
  if (token.length < 32 || token.length > 200) {
    return { ok: false, message: "This invitation is invalid or expired." };
  }
  const tokenHash = createHash("sha256").update(token).digest("hex");
  const proof = createServerProof("preview-invitation", [
    authenticated.userId,
    verifiedEmail,
    tokenHash,
  ]);
  const { data, error } = await authenticated.client.rpc(
    "preview_organization_invitation",
    {
      invitation_token: token,
      verified_email: verifiedEmail,
      server_proof: proof,
    },
  );
  if (error) throw mapDataError(error);
  if (!data || typeof data !== "object" || Array.isArray(data)) {
    return { ok: false, message: "This invitation is unavailable." };
  }
  if (data.ok !== true) {
    return {
      ok: false,
      message:
        data.code === "RATE_LIMITED"
          ? "Too many invitation checks. Please wait and try again."
          : data.code === "CONFIGURATION"
            ? "Invitation verification is temporarily unavailable."
            : "This invitation is invalid, expired, used, or belongs to another email address.",
    };
  }
  if (
    typeof data.organization_name !== "string" ||
    typeof data.organization_slug !== "string" ||
    typeof data.email !== "string" ||
    (data.role !== "member" && data.role !== "admin") ||
    typeof data.expires_at !== "string"
  ) {
    return { ok: false, message: "This invitation is unavailable." };
  }
  return {
    ok: true,
    organizationName: data.organization_name,
    organizationSlug: data.organization_slug,
    email: data.email,
    role: data.role,
    expiresAt: data.expires_at,
  };
}

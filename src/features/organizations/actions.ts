"use server";

import { createHash } from "node:crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { actionResult, parseActionInput } from "@/lib/actions";
import { resolveOrganizationContext } from "@/lib/auth/server-context";
import { mapDataError } from "@/lib/data/errors";
import { requireRpcResult } from "@/lib/data/rpc";
import { getPublicEnv } from "@/lib/env";
import { AppError, type ActionState } from "@/lib/security/errors";
import { createServerProof } from "@/lib/security/server-proof";
import { createAuthenticatedContext } from "@/lib/supabase/server";
import { getVerifiedPrimaryEmail } from "@/lib/auth/clerk-user";
import { updateOrganizationName } from "@/lib/data/organizations";
import {
  invitationSchema,
  memberRoleSchema,
  organizationSchema,
  organizationSettingsSchema,
  uuidSchema,
} from "@/features/shared/schemas";

export async function createOrganizationAction(
  _state: ActionState,
  formData: FormData,
): Promise<ActionState> {
  void _state;
  const authenticated = await createAuthenticatedContext();
  let destination: string | null = null;
  const result = await actionResult(async () => {
    const input = parseActionInput(organizationSchema, formData);
    const { data, error } = await authenticated.client.rpc(
      "create_organization",
      {
        organization_name: input.name,
        organization_slug: input.slug,
      },
    );
    if (error) throw mapDataError(error);
    requireRpcResult(data, ["organization_id"], {
      CONFLICT: "That organization slug is already in use.",
    });
    destination = `/app/${input.slug}/dashboard?created=1`;
    return { status: "success", message: "Organization created." };
  });
  if (destination) redirect(destination);
  return result;
}

export async function updateOrganizationAction(
  slug: string,
  _state: ActionState,
  formData: FormData,
): Promise<ActionState> {
  void _state;
  const authenticated = await createAuthenticatedContext();
  return actionResult(async () => {
    const input = parseActionInput(organizationSettingsSchema, formData);
    const { context, client } = await resolveOrganizationContext(
      slug,
      authenticated,
    );
    if (context.membership.role !== "owner")
      throw new AppError(
        "FORBIDDEN",
        "Only an owner can change organization settings.",
      );
    await updateOrganizationName(client, context.organization.id, input.name);
    revalidatePath(`/app/${slug}`);
    return { status: "success", message: "Organization settings saved." };
  });
}

export async function inviteMemberAction(
  slug: string,
  _state: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const authenticated = await createAuthenticatedContext();
  return actionResult(async () => {
    const input = parseActionInput(invitationSchema, formData);
    const { context, client } = await resolveOrganizationContext(
      slug,
      authenticated,
    );
    if (context.membership.role === "member")
      throw new AppError("FORBIDDEN", "You cannot invite members.");
    if (context.membership.role === "admin" && input.role !== "member") {
      throw new AppError(
        "FORBIDDEN",
        "Administrators can invite members only.",
      );
    }
    const { data, error } = await client.rpc("create_organization_invitation", {
      target_organization_id: context.organization.id,
      invitation_email: input.email,
      invitation_role: input.role,
    });
    if (error) throw mapDataError(error);
    const created = requireRpcResult(data, ["token"], {
      CONFLICT: "A pending invitation already exists for this email address.",
    });
    if (typeof created.token !== "string") {
      throw new AppError("UNAVAILABLE", "The invitation could not be created.");
    }
    revalidatePath(`/app/${slug}/members`);
    return {
      status: "success",
      message:
        "Invitation created. Copy this link now; it will not be shown again.",
      data: {
        invitationUrl: `${getPublicEnv().NEXT_PUBLIC_APP_URL}/join/${created.token}`,
      },
    };
  });
}

export async function changeMemberRoleAction(
  slug: string,
  _state: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const authenticated = await createAuthenticatedContext();
  return actionResult(async () => {
    const input = parseActionInput(memberRoleSchema, formData);
    const { context, client } = await resolveOrganizationContext(
      slug,
      authenticated,
    );
    const { data, error } = await client.rpc(
      "change_organization_member_role",
      {
        target_organization_id: context.organization.id,
        target_membership_id: input.membershipId,
        target_role: input.role,
      },
    );
    if (error) throw mapDataError(error);
    requireRpcResult(data, [], {
      FORBIDDEN: "You cannot change this member's role.",
    });
    revalidatePath(`/app/${slug}/members`);
    return { status: "success", message: "Member role updated." };
  });
}

export async function removeMemberAction(
  slug: string,
  _state: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const authenticated = await createAuthenticatedContext();
  return actionResult(async () => {
    const membershipId = uuidSchema.parse(formData.get("membershipId"));
    const { context, client } = await resolveOrganizationContext(
      slug,
      authenticated,
    );
    const { data, error } = await client.rpc("remove_organization_member", {
      target_organization_id: context.organization.id,
      target_membership_id: membershipId,
    });
    if (error) throw mapDataError(error);
    requireRpcResult(data, [], {
      FORBIDDEN: "You cannot remove this member.",
    });
    revalidatePath(`/app/${slug}/members`);
    return { status: "success", message: "Member removed." };
  });
}

export async function revokeInvitationAction(
  slug: string,
  invitationId: string,
  _state: ActionState,
  _formData: FormData,
): Promise<ActionState> {
  void _state;
  void _formData;
  const authenticated = await createAuthenticatedContext();
  return actionResult(async () => {
    const id = uuidSchema.parse(invitationId);
    const { context, client } = await resolveOrganizationContext(
      slug,
      authenticated,
    );
    const { data, error } = await client.rpc("revoke_organization_invitation", {
      target_organization_id: context.organization.id,
      target_invitation_id: id,
    });
    if (error) throw mapDataError(error);
    requireRpcResult(data, [], {
      FORBIDDEN: "You cannot revoke this invitation.",
    });
    revalidatePath(`/app/${slug}/members`);
    return { status: "success", message: "Invitation revoked." };
  });
}

export async function acceptInvitationAction(
  token: string,
  _state: ActionState,
  _formData: FormData,
): Promise<ActionState> {
  void _state;
  void _formData;
  const authenticated = await createAuthenticatedContext();
  const verifiedEmail = await getVerifiedPrimaryEmail();
  let destination: string | null = null;
  const result = await actionResult(async () => {
    if (token.length < 32 || token.length > 200)
      throw new AppError("VALIDATION", "Invitation is invalid.");
    if (!verifiedEmail) {
      throw new AppError(
        "FORBIDDEN",
        "Verify your primary email address before accepting an invitation.",
      );
    }
    const tokenHash = createHash("sha256").update(token).digest("hex");
    const proof = createServerProof("accept-invitation", [
      authenticated.userId,
      verifiedEmail,
      tokenHash,
    ]);
    const { data, error } = await authenticated.client.rpc(
      "accept_organization_invitation",
      {
        invitation_token: token,
        verified_email: verifiedEmail,
        server_proof: proof,
      },
    );
    if (error) throw mapDataError(error);
    const accepted = requireRpcResult(data, ["organization_slug"]);
    if (typeof accepted.organization_slug !== "string") {
      throw new AppError(
        "UNAVAILABLE",
        "The invitation could not be accepted.",
      );
    }
    destination = `/app/${accepted.organization_slug}/dashboard?joined=1`;
    return { status: "success", message: "Invitation accepted." };
  });
  if (destination) redirect(destination);
  return result;
}

export async function removeMemberDirectAction(
  slug: string,
  membershipId: string,
  _state: ActionState,
  _formData: FormData,
): Promise<ActionState> {
  void _state;
  void _formData;
  const authenticated = await createAuthenticatedContext();
  return actionResult(async () => {
    const id = uuidSchema.parse(membershipId);
    const { context, client } = await resolveOrganizationContext(
      slug,
      authenticated,
    );
    const { data, error } = await client.rpc("remove_organization_member", {
      target_organization_id: context.organization.id,
      target_membership_id: id,
    });
    if (error) throw mapDataError(error);
    requireRpcResult(data, [], {
      FORBIDDEN: "You cannot remove this member.",
    });
    revalidatePath(`/app/${slug}/members`);
    return { status: "success", message: "Member removed." };
  });
}

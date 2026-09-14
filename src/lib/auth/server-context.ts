import "server-only";

import { loadOrganizationContext, type OrganizationContext } from "./context";
import { findOrganizationContext } from "@/lib/data/organizations";
import { findOrganizationContextById } from "@/lib/data/organizations";
import {
  createAuthenticatedContext,
  type AuthenticatedContext,
  type WorkGridClient,
} from "@/lib/supabase/server";

export async function resolveOrganizationContext(
  slug: string,
  authenticated?: AuthenticatedContext,
): Promise<{
  context: OrganizationContext;
  client: WorkGridClient;
}> {
  const { userId, client } =
    authenticated ?? (await createAuthenticatedContext());
  const context = await loadOrganizationContext(
    userId,
    slug,
    (actorId, organizationSlug) =>
      findOrganizationContext(client, actorId, organizationSlug),
  );
  return { context, client };
}

export async function resolveOrganizationContextById(
  organizationId: string,
  authenticated?: AuthenticatedContext,
): Promise<{
  context: OrganizationContext;
  client: WorkGridClient;
}> {
  const { userId, client } =
    authenticated ?? (await createAuthenticatedContext());
  const context = await loadOrganizationContext(
    userId,
    organizationId,
    (actorId, id) => findOrganizationContextById(client, actorId, id),
  );
  return { context, client };
}

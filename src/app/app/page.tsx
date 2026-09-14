import { redirect } from "next/navigation";
import { listOrganizations } from "@/lib/data/organizations";
import { createAuthenticatedContext } from "@/lib/supabase/server";

export default async function AppIndexPage() {
  const { userId, client } = await createAuthenticatedContext();
  const organizations = await listOrganizations(client, userId);
  if (organizations[0]) redirect(`/app/${organizations[0].slug}/dashboard`);
  redirect("/app/new-organization");
}

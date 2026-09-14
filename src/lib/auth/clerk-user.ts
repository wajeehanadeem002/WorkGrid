import "server-only";

import { currentUser } from "@clerk/nextjs/server";
import { selectVerifiedPrimaryEmail } from "./clerk-email";

export async function getVerifiedPrimaryEmail(): Promise<string | null> {
  const user = await currentUser();
  if (!user) return null;
  return selectVerifiedPrimaryEmail(user);
}

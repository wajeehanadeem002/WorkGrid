interface ClerkEmailIdentity {
  primaryEmailAddressId: string | null;
  emailAddresses: Array<{
    id: string;
    emailAddress: string;
    verification: { status: string | null } | null;
  }>;
}

export function selectVerifiedPrimaryEmail(
  user: ClerkEmailIdentity,
): string | null {
  const primary = user.emailAddresses.find(
    (email) => email.id === user.primaryEmailAddressId,
  );
  if (primary?.verification?.status !== "verified") return null;
  return primary.emailAddress.trim().toLowerCase();
}

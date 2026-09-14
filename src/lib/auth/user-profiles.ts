import "server-only";

import { clerkClient } from "@clerk/nextjs/server";

export interface UserProfile {
  userId: string;
  label: string;
  secondary: string | null;
}

export async function getUserProfiles(
  userIds: readonly string[],
): Promise<Map<string, UserProfile>> {
  const uniqueIds = [...new Set(userIds)].slice(0, 100);
  if (!uniqueIds.length) return new Map();
  try {
    const client = await clerkClient();
    const response = await client.users.getUserList({
      userId: uniqueIds,
      limit: 100,
    });
    return new Map(
      response.data.map((user) => {
        const email = user.primaryEmailAddress?.emailAddress ?? null;
        const label =
          user.fullName?.trim() ||
          user.username?.trim() ||
          email ||
          "Team member";
        return [
          user.id,
          { userId: user.id, label, secondary: email === label ? null : email },
        ];
      }),
    );
  } catch (error) {
    const requestId = crypto.randomUUID();
    console.error("Unable to load Clerk user profiles", { requestId, error });
    return new Map();
  }
}

export function userLabel(
  profiles: ReadonlyMap<string, UserProfile>,
  userId: string,
  currentUserId: string,
): string {
  if (userId === currentUserId) return "You";
  return profiles.get(userId)?.label ?? `Member ...${userId.slice(-6)}`;
}

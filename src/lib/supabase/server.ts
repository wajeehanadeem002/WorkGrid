import "server-only";

import { auth } from "@clerk/nextjs/server";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { getPublicEnv } from "@/lib/env";
import { createTimeoutFetch } from "@/lib/http/timeout-fetch";
import type { Database } from "./database.types";

export type WorkGridClient = SupabaseClient<Database>;
export interface AuthenticatedContext {
  userId: string;
  client: WorkGridClient;
}

interface AuthenticatedClientOptions {
  requestTimeoutMs?: number;
}

export async function requireAuthenticatedUserId(): Promise<string> {
  const { userId } = await auth.protect();
  return userId;
}

export async function createAuthenticatedClient(): Promise<WorkGridClient> {
  const session = await auth.protect();
  return createClientForSession(session.getToken);
}

function createClientForSession(
  getToken: () => Promise<string | null>,
  options: AuthenticatedClientOptions = {},
): WorkGridClient {
  const env = getPublicEnv();
  return createClient<Database>(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    {
      accessToken: getToken,
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false,
      },
      global: {
        headers: { "X-Client-Info": "workgrid-nextjs" },
        ...(options.requestTimeoutMs
          ? { fetch: createTimeoutFetch(options.requestTimeoutMs) }
          : {}),
      },
    },
  );
}

export async function createAuthenticatedContext(
  options: AuthenticatedClientOptions = {},
): Promise<AuthenticatedContext> {
  const session = await auth.protect();
  return {
    userId: session.userId,
    client: createClientForSession(session.getToken, options),
  };
}

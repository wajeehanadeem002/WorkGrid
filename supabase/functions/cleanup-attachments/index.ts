import { createClient } from "@supabase/supabase-js";

import {
  createCleanupHandler,
  type CleanupCandidate,
  type CleanupOutcome,
} from "./handler.ts";

declare const Deno: {
  env: { get: (name: string) => string | undefined };
  serve: (handler: (request: Request) => Response | Promise<Response>) => void;
};

function requiredEnvironment(name: string) {
  const value = Deno.env.get(name);
  if (!value) {
    throw new Error(`Missing required Edge Function configuration: ${name}`);
  }
  return value;
}

function elevatedSupabaseKey() {
  const secretKeys = Deno.env.get("SUPABASE_SECRET_KEYS");
  if (secretKeys) {
    try {
      const parsed = JSON.parse(secretKeys) as { default?: unknown };
      if (typeof parsed.default === "string" && parsed.default.length > 0) {
        return parsed.default;
      }
    } catch {
      throw new Error(
        "Invalid Supabase Edge Function secret-key configuration.",
      );
    }
  }

  return requiredEnvironment("SUPABASE_SERVICE_ROLE_KEY");
}

const handler = createCleanupHandler({
  cleanupToken: () => Deno.env.get("WORKGRID_CLEANUP_TOKEN"),
  createStore: () => {
    const supabase = createClient(
      requiredEnvironment("SUPABASE_URL"),
      elevatedSupabaseKey(),
      {
        auth: {
          autoRefreshToken: false,
          detectSessionInUrl: false,
          persistSession: false,
        },
      },
    );

    return {
      claimBatch: async () => {
        const { data, error } = await supabase.rpc(
          "claim_attachment_cleanup_batch",
        );
        if (error) {
          throw new Error("Attachment cleanup claim failed.");
        }
        return (data ?? []) as CleanupCandidate[];
      },
      deleteObject: async (storagePath: string) => {
        const { error } = await supabase.storage
          .from("attachments")
          .remove([storagePath]);
        if (error) {
          throw new Error("Attachment Storage deletion failed.");
        }
      },
      finalize: async (attachmentId: string) => {
        const { data, error } = await supabase.rpc(
          "finalize_attachment_cleanup",
          { target_attachment_id: attachmentId },
        );
        if (error) {
          throw new Error("Attachment cleanup finalization failed.");
        }
        const outcome = (data as { outcome?: unknown } | null)?.outcome;
        if (
          outcome === "DELETED" ||
          outcome === "RESTORED" ||
          outcome === "RETRY"
        ) {
          return outcome satisfies CleanupOutcome;
        }
        return "CONFLICT";
      },
    };
  },
});

Deno.serve(handler);

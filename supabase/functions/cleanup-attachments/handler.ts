export type CleanupMode = "deleting" | "discarding";
export type CleanupOutcome = "DELETED" | "RESTORED" | "RETRY" | "CONFLICT";

export type CleanupCandidate = {
  attachment_id: string;
  storage_path: string;
  cleanup_mode: CleanupMode;
};

export type CleanupStore = {
  claimBatch: () => Promise<CleanupCandidate[]>;
  deleteObject: (storagePath: string) => Promise<void>;
  finalize: (attachmentId: string) => Promise<CleanupOutcome>;
};

type CleanupHandlerDependencies = {
  cleanupToken: () => string | undefined;
  createStore: () => CleanupStore;
};

const CLEANUP_BATCH_SIZE = 50;
const CLEANUP_CONCURRENCY = 5;
const jsonHeaders = {
  "cache-control": "no-store",
  "content-type": "application/json; charset=utf-8",
};

function jsonResponse(body: unknown, status: number) {
  return new Response(JSON.stringify(body), { status, headers: jsonHeaders });
}

async function digest(value: string) {
  return new Uint8Array(
    await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value)),
  );
}

async function tokensMatch(candidate: string, expected: string) {
  const [candidateDigest, expectedDigest] = await Promise.all([
    digest(candidate),
    digest(expected),
  ]);
  let difference = 0;
  for (let index = 0; index < expectedDigest.length; index += 1) {
    difference |= candidateDigest[index]! ^ expectedDigest[index]!;
  }
  return difference === 0;
}

async function forEachWithConcurrency<T>(
  values: readonly T[],
  concurrency: number,
  operation: (value: T) => Promise<void>,
) {
  let nextIndex = 0;
  const workers = Array.from(
    { length: Math.min(concurrency, values.length) },
    async () => {
      while (nextIndex < values.length) {
        const currentIndex = nextIndex;
        nextIndex += 1;
        await operation(values[currentIndex]!);
      }
    },
  );
  await Promise.all(workers);
}

function isCandidate(value: CleanupCandidate) {
  return (
    typeof value.attachment_id === "string" &&
    value.attachment_id.length > 0 &&
    typeof value.storage_path === "string" &&
    value.storage_path.length > 0 &&
    (value.cleanup_mode === "deleting" || value.cleanup_mode === "discarding")
  );
}

export function createCleanupHandler({
  cleanupToken,
  createStore,
}: CleanupHandlerDependencies) {
  return async function cleanupAttachments(
    request: Request,
  ): Promise<Response> {
    if (request.method !== "POST") {
      return new Response(JSON.stringify({ error: "Method not allowed." }), {
        status: 405,
        headers: { ...jsonHeaders, allow: "POST" },
      });
    }

    const expectedToken = cleanupToken();
    if (!expectedToken || expectedToken.length < 32) {
      return jsonResponse({ error: "Cleanup is unavailable." }, 503);
    }

    const suppliedToken = request.headers.get("x-workgrid-cleanup-token");
    if (
      !suppliedToken ||
      suppliedToken.length > 256 ||
      !(await tokensMatch(suppliedToken, expectedToken))
    ) {
      return jsonResponse({ error: "Unauthorized." }, 401);
    }

    try {
      // Constructing the elevated client happens only after the dedicated
      // scheduler token has been authenticated.
      const store = createStore();
      const candidates = (await store.claimBatch())
        .filter(isCandidate)
        .slice(0, CLEANUP_BATCH_SIZE);
      const counts = {
        claimed: candidates.length,
        deleted: 0,
        restored: 0,
        retryPending: 0,
        failed: 0,
      };

      await forEachWithConcurrency(
        candidates,
        CLEANUP_CONCURRENCY,
        async (candidate) => {
          try {
            await store.deleteObject(candidate.storage_path);
          } catch {
            // Finalization checks authoritative Storage metadata. A failed or
            // ambiguous delete therefore remains safe and retryable.
          }

          try {
            const outcome = await store.finalize(candidate.attachment_id);
            if (outcome === "DELETED") {
              counts.deleted += 1;
            } else if (outcome === "RESTORED") {
              counts.restored += 1;
            } else if (outcome === "RETRY") {
              counts.retryPending += 1;
            } else {
              counts.failed += 1;
            }
          } catch {
            counts.failed += 1;
          }
        },
      );

      return jsonResponse(counts, 200);
    } catch {
      return jsonResponse({ error: "Cleanup failed safely." }, 503);
    }
  };
}

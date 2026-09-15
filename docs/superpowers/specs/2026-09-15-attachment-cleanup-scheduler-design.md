# Attachment Cleanup Scheduler Design

## Goal

Automate recovery and cleanup of interrupted private attachment operations without widening browser access, exposing Storage paths to arbitrary callers, or using direct SQL deletion against `storage.objects`.

## Trust boundaries

- Browsers continue to use the authenticated application flow and existing tenant-aware attachment RPCs.
- The scheduled Edge Function is the only cleanup worker. It authenticates a fixed cron request token and uses a Supabase elevated key only inside the function runtime.
- The Data API exposes two narrowly scoped cleanup RPCs. They accept no caller-controlled path or batch limit and are executable only by `service_role`.
- PostgreSQL selects cleanup candidates and confirms Storage state. The Edge Function deletes objects only through the official private Storage API.
- The cron request token and project URL are resolved from Supabase Vault at execution time. Secret values never appear in migrations, repository files, logs, or response bodies.

## Database workflow

`public.claim_attachment_cleanup_batch()` runs with a locked search path, `security definer`, and RLS disabled. It:

1. Converts stale `pending`/`verifying` uploads with existing Storage objects to `discarding`.
2. Removes stale object-free upload reservations and completed deletion metadata.
3. Deletes expired rate-limit windows in a bounded maintenance statement.
4. Claims at most 50 eligible `discarding` rows or timed-out `deleting` rows using `FOR UPDATE SKIP LOCKED` and refreshes their lease timestamp.
5. Returns only the attachment UUID, exact stored path, and cleanup mode to the trusted worker.

`public.finalize_attachment_cleanup(uuid)` locks one claimed row and checks `storage.objects`:

- if the object is absent, exactly one metadata row is deleted;
- if a `deleting` object remains, the row is restored to `ready` so reads are not permanently broken;
- if a `discarding` object remains, it stays untrusted and becomes retryable after the lease;
- any stale or invalid state returns a bounded result without leaking tenant details.

Both functions are revoked from `public`, `anon`, and `authenticated`, then granted only to `service_role`.

## Edge Function workflow

The `cleanup-attachments` function accepts only `POST`. It compares `x-workgrid-cleanup-token` with `WORKGRID_CLEANUP_TOKEN` using constant-time digest comparison before creating the elevated client. It ignores request bodies and caller parameters.

It claims one fixed server-controlled batch, processes at most five Storage deletions concurrently, and finalizes every attempted candidate. Finalization verifies actual Storage state, making duplicate invocation and partial failure retry-safe. Responses contain aggregate counts only; paths, keys, database messages, and stack traces are not returned.

## Scheduling

The migration enables `pg_cron`, `pg_net`, and Vault, then registers one named job on `*/15 * * * *`. The job obtains the function URL and cleanup token from Vault secret names and invokes the Edge Function with a fixed empty body and timeout. Missing Vault configuration causes a failed/no-op invocation rather than secret fallback in SQL.

## Failure behavior

- Concurrent workers cannot claim the same active lease.
- Storage deletion failure is followed by database finalization; an existing object keeps/restores a safe state and can be retried.
- Function crashes leave a timestamped lease that becomes eligible later.
- Object-free metadata is removed only after PostgreSQL confirms the object is absent.
- Ready attachments are never selected unless already transitioned to the explicit `deleting` state.

## Verification

- pgTAP covers grants, direct-client denial, fixed batch bounds, safe state selection, leasing, finalize outcomes, and rate-limit expiry cleanup.
- Vitest covers request authentication, method rejection, bounded concurrency, aggregate-only responses, and partial Storage failures through injected adapters.
- Existing application, lint, typecheck, build, and database checks remain required.

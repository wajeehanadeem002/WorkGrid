# Attachment cleanup and deletion

WorkGrid automates private attachment recovery with the Supabase Edge Function `cleanup-attachments`, invoked every 15 minutes by `pg_cron` through `pg_net`.

## Security boundary

- The browser never receives an elevated Supabase key, cleanup token, arbitrary cleanup path, or batch-size control.
- `public.claim_attachment_cleanup_batch()` accepts no arguments and returns at most 50 database-selected rows. `public.finalize_attachment_cleanup(uuid)` accepts only a claimed metadata identifier. Both RPCs are executable only by `service_role`.
- The Edge Function authenticates `x-workgrid-cleanup-token` before constructing its elevated Supabase client and processes at most five object removals concurrently.
- Storage objects are removed only with the official Supabase Storage API. Production code must never `DELETE` from `storage.objects` directly.
- Responses and logs contain aggregate outcomes only, never paths, tokens, elevated keys, database details, or stack traces.

## Lifecycle

The existing upload flow creates pending metadata through a server-proofed reservation RPC. A successful upload is sealed to the exact Storage object ID in `verifying`; the application downloads and validates the complete object before a separate proof can promote it to `ready`.

The scheduled worker performs these bounded operations:

1. Seal stale stored `pending`/`verifying` rows into non-readable `discarding` state. Interrupted bytes are never promoted to trusted content.
2. Remove old object-free reservations and metadata whose Storage object is already absent.
3. Delete up to 1,000 expired rate-limit windows.
4. Lease up to 50 `discarding` objects or timed-out `deleting` objects with `FOR UPDATE SKIP LOCKED`.
5. Remove each claimed object through `storage.from("attachments").remove(...)` with concurrency limited to five.
6. Finalize against authoritative `storage.objects` state. Missing objects delete exactly one metadata row; an existing trusted deletion is restored to `ready`; an existing untrusted discard remains `discarding` for retry.

A worker crash leaves a lease that expires after 10 minutes. The next invocation may reclaim it. A normal interactive deletion is not eligible until it has remained in `deleting` for 15 minutes, preventing the scheduler from racing the request that initiated it.

## Required hosted secrets

Create one random cleanup token with at least 32 bytes of entropy. Store the same value in both locations without printing it:

| Location             | Name                     | Value                                            |
| -------------------- | ------------------------ | ------------------------------------------------ |
| Edge Function secret | `WORKGRID_CLEANUP_TOKEN` | Random cleanup token                             |
| Supabase Vault       | `workgrid_cleanup_token` | The identical random cleanup token               |
| Supabase Vault       | `workgrid_project_url`   | The hosted project URL, without a trailing slash |

Use the Supabase Dashboard secret inputs or another non-echoing secret-management workflow. Do not place these values in `.env.local`, `.env.example`, migration SQL, shell history, CI variables used by the web application, or repository files. Supabase provides `SUPABASE_URL` and `SUPABASE_SECRET_KEYS` to the Edge Function runtime; the normal Next.js application does not need or use either elevated credential.

The function has `verify_jwt = false` because scheduled calls use the independent high-entropy cleanup token. Do not make the endpoint public without that header check.

## Deployment order (requires explicit deployment approval)

1. Provision the Edge Function cleanup token and both Vault values out of band.
2. Apply the reviewed migration that creates the service-role RPCs and cron schedule.
3. Deploy `cleanup-attachments`.
4. Invoke it once with the protected scheduler token and confirm an aggregate-only response.
5. Verify the cron job and inspect function/pg_net failures without querying or printing decrypted Vault values.

No deployment or hosted secret change is performed as part of ordinary local development.

## Monitoring and reconciliation

Monitor Edge Function failures, `cron.job_run_details`, and pg_net response status. Alert when repeated runs report failures or `discarding` rows remain beyond the retry window. Objects in the private bucket without attachment metadata should be reported for manual investigation; the worker intentionally refuses to delete paths that were not selected from attachment metadata.

The compatibility function `private.reconcile_stale_attachment_metadata()` remains database-owner-only for incident recovery and honors active cleanup leases. It is not exposed through the Data API.

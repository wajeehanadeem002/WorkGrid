# Attachment Cleanup Scheduler Implementation Plan

> Execution note: implement locally on `feature/attachment-cleanup-scheduler`. Commits, pushes, PRs, merges, remote migrations, secret changes, function deployment, and production deployment are deferred until separate user approval.

## Task 1: Add failing database security coverage

Create `supabase/tests/005_attachment_cleanup_scheduler.test.sql` covering function existence, role grants, unauthenticated/authenticated denial, fixed batch size, safe state selection, leases, finalize behavior, and expired rate-limit cleanup. Run pgTAP locally when Supabase/Docker is available and confirm the pre-migration failure.

## Task 2: Add cleanup migration

Create `supabase/migrations/20260915120000_attachment_cleanup_scheduler.sql` with required extensions, service-role-only claim/finalize functions, indexes/comments, and a Vault-backed 15-minute cron job. Never embed values or delete Storage rows in SQL. Run database lint and pgTAP.

## Task 3: Add failing Edge Function worker tests

Extend Vitest discovery to the pure Edge Function worker tests. Cover POST-only requests, missing/wrong token denial, constant-time credential comparison, no client-controlled batch parameters, five-wide concurrency, partial failures, and aggregate-only output. Confirm tests fail before implementation.

## Task 4: Implement Edge Function

Create a dependency-injected cleanup handler plus Deno entry point. Authenticate before constructing the elevated client, parse the default secret key safely, use official Storage `.remove()`, call fixed-argument RPCs, always reconcile attempted rows, bound concurrency, and return safe aggregate errors.

Configure the local function with JWT verification disabled because the function uses its dedicated random secret header. Run unit tests, lint, and typecheck.

## Task 5: Document operations and deployment gate

Update storage cleanup, security, and README documentation with the automated lifecycle, secret names, non-printing provisioning procedure, monitoring, retry behavior, and the explicit rule that only the Edge worker may hold an elevated key. Do not add cleanup secrets to `.env.example` because they are not application environment variables.

## Task 6: Complete verification

Run formatting check, lint, typecheck, all Vitest tests with coverage, production build, Supabase database lint, and pgTAP tests. If Docker/PostgreSQL is unavailable, report that exact limitation and do not claim database execution passed. Inspect Git diff/status and confirm no secrets, direct Storage SQL deletion, or prohibited Git/deployment action occurred.

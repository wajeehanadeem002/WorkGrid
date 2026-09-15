# WorkGrid

WorkGrid is a professional multi-tenant project-management SaaS built to demonstrate production-oriented full-stack engineering. Teams operate inside isolated organizations, coordinate projects and tasks, collaborate through comments and private attachments, and review an append-only activity history.

## Core features

- Clerk authentication with protected App Router routes
- Application-owned organizations, memberships, roles, and secure invitation links
- Owner, admin, and member permissions enforced on the server
- Project creation, editing, guarded deletion, search, status filters, sorting, and pagination
- Task creation, assignment, due dates, statuses, priorities, search, compound filters, and pagination
- Task comments and validated private attachments
- Dashboard metrics for projects, completion, assigned work, overdue work, and activity
- Append-only audit history for important organization and work changes
- Rate-limited JSON and CSV organization exports
- Responsive desktop, tablet, and mobile layouts with accessible forms and dialogs
- PostgreSQL RLS and composite tenant-safe constraints
- Unit, component, integration-boundary, and pgTAP security tests

## Technology

- Next.js 16 App Router and React 19
- Strict TypeScript 6
- Tailwind CSS 4
- Clerk 7
- Supabase PostgreSQL, Data API, and private Storage
- Zod 4
- Vitest 5 and React Testing Library
- pgTAP through the Supabase CLI
- ESLint 9 and Prettier 3
- GitHub Actions, Vercel, and npm

Versions are pinned in `package.json` and captured by `package-lock.json`. TypeScript 6 and ESLint 9 are intentionally used because the current Next.js lint dependency chain does not yet support the newer major releases.

## Architecture

WorkGrid is a modular Next.js monolith. Server Components perform reads, Server Actions perform mutations, and Route Handlers generate downloads and exports. The domain is separated into UI, validation, authorization, data access, security utilities, and database policy layers.

```text
Clerk identity
  → Next.js server authorization
  → Clerk-authenticated Supabase client
  → PostgreSQL RLS + constraints
  → private Storage policies
```

See [docs/architecture.md](docs/architecture.md) and [docs/security.md](docs/security.md) for the detailed design.

## Local setup

### Prerequisites

- Node.js 22.12 or newer; Node.js 24 is used by CI
- npm 11 or newer
- Docker Desktop for the local Supabase stack and database tests
- A Clerk application
- A Supabase project with Clerk enabled as a native third-party authentication provider

### Install

```powershell
npm install
Copy-Item .env.example .env.local
```

Fill `.env.local` with development credentials. Never commit `.env.local`.

Start the application:

```powershell
npm run dev
```

Open `http://localhost:3000`.

## Environment variables

| Variable                                          | Visibility    | Purpose                                               |
| ------------------------------------------------- | ------------- | ----------------------------------------------------- |
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`               | Browser-safe  | Clerk frontend application key                        |
| `CLERK_SECRET_KEY`                                | Server-only   | Clerk backend authentication                          |
| `NEXT_PUBLIC_CLERK_SIGN_IN_URL`                   | Browser-safe  | Sign-in route                                         |
| `NEXT_PUBLIC_CLERK_SIGN_UP_URL`                   | Browser-safe  | Sign-up route                                         |
| `NEXT_PUBLIC_CLERK_SIGN_IN_FALLBACK_REDIRECT_URL` | Browser-safe  | Post-sign-in destination                              |
| `NEXT_PUBLIC_CLERK_SIGN_UP_FALLBACK_REDIRECT_URL` | Browser-safe  | Post-sign-up destination                              |
| `NEXT_PUBLIC_SUPABASE_URL`                        | Browser-safe  | Supabase project URL                                  |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`            | Browser-safe  | RLS-constrained Supabase publishable key              |
| `NEXT_PUBLIC_APP_URL`                             | Browser-safe  | Trusted canonical origin for invitation links         |
| `WORKGRID_SERVER_PROOF_SECRET`                    | Server-only   | HMAC key for controlled attachment/invitation RPCs    |
| `CLERK_JWT_ISSUER`                                | Local tooling | Clerk issuer used when enabling the local integration |

No service-role key is required for normal application traffic. Scheduled cleanup has separate Supabase-managed secrets documented below; they do not belong in `.env.local` or `.env.example`.

## Clerk setup

1. Create a Clerk application and enable the desired sign-in methods.
2. Add the publishable and secret keys to `.env.local` and Vercel's encrypted environment variables.
3. In Clerk, activate the native Supabase integration. Clerk session tokens must include `role: authenticated`.
4. Copy the Clerk issuer domain into Supabase under **Authentication → Sign In / Providers → Third-Party Auth → Clerk**.
5. Allow the local and production origins in Clerk's redirect configuration.

WorkGrid uses Clerk user IDs as durable references and does not duplicate provider profile or credential data.

## Database setup

For a hosted Supabase project, review then apply the migrations:

```powershell
npx supabase link --project-ref your-project-ref
npx supabase db push
```

Linking and pushing mutate an external project; perform those operations only after review.

For local development with Docker Desktop running:

```powershell
npm run db:start
npm run db:reset
npm run db:test
```

The migrations create normalized tables, enums, indexes, composite foreign keys, controlled mutation functions, audit triggers, bounded fixed-window rate limits, RLS policies, and the private attachment bucket. Membership removal is a security-effective soft removal: access stops immediately while historical reporter, author, uploader, and audit references remain intact. In the same locked transaction, affected tasks are unassigned and the audit log retains the assignment change. This is a greenfield first-release migration set: the attachment hardening migration intentionally fails closed if pre-release attachment rows already exist, because their stored bytes have not passed the sealed verification lifecycle and must be migrated explicitly rather than silently trusted.

After applying/resetting migrations, generate a high-entropy value of at least 32 characters, set it as `WORKGRID_SERVER_PROOF_SECRET` in the application secret store, and provision the identical value out of band into the private database schema:

```sql
insert into private.workgrid_server_config (singleton, proof_secret)
values (true, :'workgrid_server_proof_secret')
on conflict (singleton) do update
set proof_secret = excluded.proof_secret;
```

Pass `workgrid_server_proof_secret` through a protected `psql` variable or deployment secret mechanism; do not paste or commit a production value in repository files, shell history, CI logs, or migration SQL. The application intentionally fails attachment and invitation proof generation when this value is missing. `anon` and `authenticated` have no access to the private schema.

Organization exports include the organization, membership roster, projects, tasks, comments, attachment metadata, and audit history. Downloads are streamed, and each resource is capped at 1,000 rows to bound function memory use; the JSON manifest, totals, and `X-WorkGrid-Export-Truncated` response header make any truncation explicit.

To test Clerk tokens against the local stack, enable `[auth.third_party.clerk]` in `supabase/config.toml` and set its domain to the development Clerk issuer.

## Storage setup

The migration creates a private `attachments` bucket with a 4 MiB limit and a narrow MIME allowlist. The application authenticates and consumes an upload attempt before content inspection, then validates the extension/MIME pair, binary file signature or complete UTF-8 text/CSV payload, and complete digest. Text validation rejects malformed UTF-8 and non-text control bytes anywhere in the file. Server HMAC proofs gate reservation, sealing, and finalization RPCs; direct clients cannot insert metadata or promote an attachment. After upload, the exact Storage object ID, size, and MIME are sealed into an immutable `verifying` state. The server then downloads the private object, validates its content again, hashes its complete stored bytes, and only then issues the final proof for `ready`. Rejected bytes enter a non-readable `discarding` cleanup state. The slightly larger Server Action request ceiling allows multipart overhead while remaining below Vercel's 4.5 MB Function payload limit. Downloads are streamed through an authenticated, tenant-authorized Route Handler, so a reusable Storage URL is never exposed. Do not make this bucket public.

The `cleanup-attachments` Supabase Edge Function removes interrupted or rejected uploads and retries timed-out deletions every 15 minutes. Its fixed-size service-role RPCs are not callable by browsers, its cron token is read from Vault, and object removal uses only the official Storage API. Provision `WORKGRID_CLEANUP_TOKEN` as an Edge Function secret and the matching `workgrid_cleanup_token` plus `workgrid_project_url` as Vault secrets. See [docs/storage-cleanup.md](docs/storage-cleanup.md) for the exact lifecycle, deployment gate, and monitoring procedure.

## Testing and quality checks

```powershell
npm test
npm run test:coverage
npm run format:check
npm run lint
npm run typecheck
npm run build
```

Database checks require Docker and the local Supabase stack:

```powershell
npm run db:lint
npm run db:test
```

The pgTAP suites explicitly verify tenant isolation, manipulated resource IDs, cross-tenant update/delete denial, role escalation denial, stale-session denial after membership removal, transactional unassignment, proofed pending-to-verifying-to-ready transitions, exact Storage object binding, direct Data API mutation denial, invitation email binding, bounded rate limits, cleanup/deletion states and worker leases, service-role-only cleanup RPCs, audit immutability, anonymous denial, and private Storage isolation.

The Vitest coverage gate measures deterministic authorization, validation, pagination, export-safety, upload-policy, error-mapping, and rate-limit code at high thresholds. Server Actions and provider adapters are exercised through query-contract tests and the database/RLS suite instead of being counted as uncovered framework glue.

## Security model

Every protected operation follows four gates:

1. Authenticate the Clerk subject.
2. Resolve active organization membership.
3. Enforce the required role.
4. Load nested resources with both their ID and active organization ID.

PostgreSQL RLS repeats the membership and role checks. Composite keys reject cross-tenant project/task/comment/attachment relationships. UI permission gates are never treated as security controls. See [docs/security.md](docs/security.md).

## Project structure

```text
.github/workflows/       CI checks
docs/                    Architecture, security, and operations notes
src/app/                 App Router pages, layouts, actions, and route handlers
src/components/          Shared accessible UI
src/features/            Domain forms, filters, actions, and views
src/lib/auth/            Permissions and tenant context
src/lib/data/            Supabase data access
src/lib/security/        Validation-adjacent security utilities
src/lib/supabase/        Authenticated client and database types
src/types/               Domain types
supabase/migrations/     Canonical PostgreSQL schema
supabase/tests/          pgTAP database and RLS tests
```

## Git workflow

```text
main (production)
  ↓
dev (development and integration)
  ↓
feature/* (individual changes)
```

Create feature branches from `dev` and target pull requests back to `dev`. CI must pass before merging. Promote a tested `dev` state to `main`; Vercel production deployment should track only `main`.

This repository began without commits. The initial review-ready working tree is held on the unborn `dev` branch so implementation does not occur on production `main`. After approval, create the first tested commit on `dev`; establish `main` only when that tested state is explicitly approved for production promotion.

## Deployment

1. Create Clerk and Supabase production projects.
2. Enable Clerk's native Supabase integration and apply the reviewed migrations.
3. Configure the private Storage bucket policies from the migration.
4. Provision the scheduled cleanup Edge Function/Vault secrets and deploy the function as described in [docs/storage-cleanup.md](docs/storage-cleanup.md).
5. Import the repository into Vercel and add all required web application environment variables.
6. Configure preview deployments for `dev` and feature pull requests.
7. Configure the production domain only for `main`.
8. Require the GitHub Actions checks before merging into `dev` or `main`.

No deployment command is embedded in CI. Vercel owns preview and production deployment policy after repository integration.

## Product constraints

WorkGrid intentionally excludes billing, chat, video, real-time collaboration, AI features, advanced automation, microservices, and Kubernetes. This keeps the codebase focused on secure multi-tenancy and reliable project operations.

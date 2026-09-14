# WorkGrid architecture

## Request path

```text
Browser
  → Next.js proxy (Clerk authentication)
  → Server Component / Server Action / Route Handler
  → Zod input validation
  → organization membership + role + resource authorization
  → Clerk-authenticated Supabase client
  → PostgreSQL constraints and Row Level Security
  → private Storage policy where applicable
```

WorkGrid intentionally uses one deployable Next.js application. The product does not need a second API service or an ORM to express its current domain. Server Components own reads, Server Actions own form mutations, and Route Handlers own file downloads and exports.

## Module boundaries

- `src/app` contains routing and request boundaries.
- `src/features` contains domain-specific forms, filters, presentation, and actions.
- `src/lib/auth` contains the role matrix and organization context guards.
- `src/lib/data` contains Supabase queries. Every resource lookup includes `organization_id`.
- `src/lib/security` contains pagination bounds, upload policy, rate limits, safe CSV serialization, and public errors.
- `src/lib/supabase` constructs authenticated clients and owns database types.
- `supabase/migrations` is the canonical database definition.
- `supabase/tests` proves database isolation independently of the UI.

## Authentication integration

Clerk is configured as a native third-party authentication provider in Supabase. The application passes the current Clerk session token through the Supabase client's `accessToken` callback. PostgreSQL reads the Clerk subject from `auth.jwt() ->> 'sub'`.

WorkGrid stores the Clerk subject only where a durable user reference is required. It does not copy passwords, sessions, profile photos, or other provider-owned identity data.

## Tenant context

Organization slugs make URLs readable, but they are not trusted. The server resolves a slug through an authenticated client, then loads the matching membership. IDs submitted by forms or URLs are resolved again with the active `organization_id`. Composite foreign keys prevent inconsistent organization/project/task relationships even when an application bug attempts one.

Memberships are soft-removed with `removed_at`. Active-context queries and database authorization helpers require that field to be null, so a still-valid Clerk session loses access immediately without breaking historical authorship and audit references.

## Caching

Organization data is request-specific and is not placed in a shared public cache. Mutations invalidate organization-scoped paths. Static public content may be cached by the Next.js/Vercel platform.

## Deployment model

Vercel builds the Next.js application. Supabase hosts PostgreSQL and the private Storage bucket. Clerk hosts authentication. CI verifies the application and database independently before `dev` can be promoted to `main`.

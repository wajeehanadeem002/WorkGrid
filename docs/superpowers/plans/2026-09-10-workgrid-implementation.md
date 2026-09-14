# WorkGrid Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:executing-plans` to implement this plan task-by-task. Steps use checkbox syntax for tracking.

**Goal:** Deliver a review-ready multi-tenant project-management SaaS with independently enforced application authorization and PostgreSQL RLS.

**Architecture:** A modular Next.js App Router application uses Clerk identity and Clerk-authenticated Supabase clients. Server-only domain services validate requests and enforce tenant and role boundaries; PostgreSQL constraints, RLS, and Storage policies provide defense in depth.

**Tech Stack:** Next.js 16, React 19, strict TypeScript 6, Tailwind CSS 4, Clerk 7, Supabase JS 2, Zod 4, Vitest 5, React Testing Library, pgTAP, ESLint 9, GitHub Actions, and Vercel.

**Spec:** `docs/superpowers/specs/2026-09-10-workgrid-design.md`

## Global constraints

- Do not commit, push, merge, deploy, delete the repository, or mutate external data.
- Do not create screenshots or QA artifacts.
- Keep all changes inside `D:\WorkGrid`.
- Use test-first development for application behavior.
- Never put secrets in tracked files.
- Do not use a service-role client for normal application operations.

---

### Task 1: Project foundation

**Files:** Root configuration, `src/app`, test configuration, CI workflow, and project documentation.

**Produces:** A strict, reproducible Next.js application with scripts for formatting, linting, typechecking, tests, database tests, and production builds.

- [x] Pin mutually compatible package versions and generate the npm lockfile.
- [x] Configure strict TypeScript, Tailwind, ESLint, Prettier, Vitest, and React Testing Library.
- [x] Add repository policy and environment-template files without secrets.
- [x] Add root layout, metadata, global theme tokens, public landing route, and global error/not-found/loading states.
- [x] Add GitHub Actions that fail on formatting, linting, types, tests, build, or database-test failure.

### Task 2: Database and tenant security

**Files:** `supabase/config.toml`, timestamped migrations, cleanup documentation, and pgTAP tests.

**Produces:** Normalized tenant schema, safe relationships, functions, indexes, audit triggers, rate limits, RLS, private Storage, and TypeScript database types.

- [x] Add pgTAP assertions for table shape, constraints, roles, tenant denial, audit immutability, and Storage isolation.
- [x] Implement enums, tables, checks, composite keys, and indexes.
- [x] Implement helper functions and RLS policies for every exposed table.
- [x] Implement the private bucket and Storage policies.
- [x] Add transactional functions for organization creation, invitation acceptance, and atomic rate limits.

### Task 3: Shared server security and domain utilities

**Files:** `src/lib/auth`, `src/lib/security`, `src/lib/supabase`, and corresponding tests.

**Produces:** Typed errors, actor guards, role checks, resource authorization, pagination, upload validation, safe filenames, and authenticated Supabase clients.

- [x] Write and run failing tests for role rules, owner protections, validation, pagination, uploads, exports, and sanitized errors.
- [x] Implement the minimum code that makes each test pass.
- [x] Implement Clerk-authenticated Supabase construction with injectable test boundaries.

### Task 4: Organizations and membership

**Files:** Organization/member schemas, data functions, actions, components, and routes.

**Produces:** Organization creation, selection, settings, member list, secure invite links, invitation acceptance, role changes, removal protections, account settings, and responsive workspace navigation.

- [x] Write and run failing service/component tests for membership, role escalation, forms, and manipulated organization IDs.
- [x] Implement organization and membership data functions, actions, pages, and route protection.

### Task 5: Projects and tasks

**Files:** Project/task schemas, services, actions, components, and routes.

**Produces:** Tenant-safe project and task CRUD, assignment, statuses, priorities, due dates, search, filters, sorting, pagination, details, and guarded deletion.

- [x] Write and run failing tests for validation, permissions, cross-tenant IDs, filters, forms, and states.
- [x] Implement organization-qualified project and task queries and mutations.
- [x] Implement responsive pages, forms, filters, tables/cards, loading, empty, error, success, pending, and confirmation states.

### Task 6: Dashboard, comments, attachments, and audit

**Files:** Dashboard/comment/attachment/audit schemas, services, actions, components, routes, and tests.

**Produces:** Aggregate dashboard metrics, comments, validated private uploads and downloads, deletion, rate limits, and activity/audit views.

- [x] Write and run failing tests for dashboard mapping, comment permissions, rate limits, file rules, safe paths, and private-download denial.
- [x] Implement aggregate queries and dashboard UI without N+1 queries.
- [x] Implement comments and the attachment reserve/upload/finalize lifecycle.
- [x] Implement sanitized audit queries and responsive activity UI.

### Task 7: Export, hardening, CI, and documentation

**Files:** Export route/services, security headers, README, architecture/security documentation, and workflow configuration.

**Produces:** Rate-limited tenant JSON/CSV exports, hardened headers, complete setup documentation, and a verified production build.

- [x] Write and run failing export authorization, escaping, tenant-isolation, and limit tests.
- [x] Implement tenant-scoped exports.
- [x] Add appropriate security headers.
- [x] Complete setup, security, Storage, testing, deployment, structure, and Git workflow documentation.
- [x] Run formatting, lint, typecheck, coverage, build, dependency, and HTTP smoke verification.
- [ ] Run database lint and pgTAP locally (blocked until Docker Desktop/local Supabase is available; CI runs both checks).

No plan step creates a commit, pushes, merges, deploys, deletes repository data, or creates screenshots.

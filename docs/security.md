# WorkGrid security model

## Tenant isolation

Organizations are the tenant boundary. Defense is applied at several independent layers:

1. Clerk protects authenticated routes and supplies a signed subject.
2. Server entry points resolve organization membership instead of trusting submitted organization identifiers.
3. The permission matrix enforces owner, admin, and member capabilities.
4. Resource queries include both the resource ID and active organization ID.
5. PostgreSQL RLS repeats membership and role checks for every exposed table.
6. Composite foreign keys prevent a task, comment, or attachment from pointing across organizations.
7. Private Storage policies resolve object paths through authorized attachment metadata.

Removing a membership sets `removed_at` instead of deleting the row. It takes effect on the next database request, even if the user's Clerk session is still valid, while preserving historical foreign keys for reported tasks, comments, uploads, and audit events. RLS and Storage policies require an active membership for reads, mutations, and object deletion.

## Role protections

- Owners can administer organization settings and roles.
- Admins can manage work and ordinary members, but cannot manage peer admins or assign, demote, or remove an owner.
- Members collaborate on tasks, comments, and attachments but cannot create or delete projects or access the audit log.
- Ownership transfer is deliberately absent. Owner rows are protected from update and deletion.

Frontend permission gates improve usability only. They are not considered authorization.

## Attachments

The `attachments` bucket is private. WorkGrid accepts only PDF, plain text, CSV, PNG, JPEG, GIF, and WebP, up to 4 MiB. MIME type and extension are checked before upload; binary formats require their expected signature, while text and CSV files receive a complete UTF-8 and control-byte scan rather than a prefix-only check. A database constraint independently rejects mismatched safe-type metadata. This ceiling keeps multipart Server Action requests below Vercel's 4.5 MB Function limit. Filenames are normalized and stored below organization, project, task, and random object-ID path segments.

Authentication and active membership are checked before upload validation, and a fixed upload-attempt allowance is consumed before file bytes are inspected. The application server validates the extension, MIME type, signature, and complete SHA-256 digest. It then HMAC-signs immutable reservation fields with `WORKGRID_SERVER_PROOF_SECRET`. A controlled `reserve_attachment` RPC verifies that proof before creating pending metadata. Direct Data API clients have no `INSERT` or `UPDATE` privilege on attachment metadata.

Storage accepts an object only when a matching controlled pending reservation belongs to the current member. A proofed sealing RPC binds the exact Storage object ID, size, and MIME metadata and changes `pending` to `verifying`. In that state the object is readable only to its uploader and cannot be replaced or deleted through direct authenticated Storage APIs. The application server re-downloads the private object, validates its signature, size, and complete SHA-256 digest, and only then creates a separate finalization proof. The final RPC rechecks active membership, exact object identity, metadata, proof, and affected-row count before changing `verifying` to `ready`. A direct client can upload bytes only to an existing unguessable pending path and cannot make those bytes trusted. Failed verification enters the non-readable `discarding` state until Storage and metadata cleanup reconcile safely. Downloads are streamed through an authenticated Route Handler that rechecks tenant membership and ready metadata on every request; reusable Storage URLs are not exposed.

Trusted-file deletion uses `ready -> deleting -> deleted/restored`. The database first records a controlled deleting state, Storage removal happens next, and reconciliation deletes metadata only after confirming that the object is absent. If Storage still contains the object, metadata returns to ready instead of becoming a broken download. Rejected upload cleanup uses `pending/verifying -> discarding -> deleted`; it never restores unverified bytes to ready. See [storage-cleanup.md](storage-cleanup.md) for retry and orphan handling.

## Invitations

Invitation links contain 256 bits of database-generated randomness. Only a SHA-256 hash is stored. Links expire after seven days and are single-use. Every invitation is bound to an email address. Before preview or acceptance, the server reads the signed-in user's verified primary Clerk email and HMAC-signs the actor, email, and token digest. The database verifies that proof and requires the verified email to match the invitation. The review screen shows the organization, intended email, role, and expiry before acceptance. Tokens remain secret bearer values and must still be transmitted carefully.

Admins can create member invitations. Only owners can create admin invitations or change roles. Ownership cannot be granted through an invitation.

## Rate limits

Organization creation, invitation creation/preview/acceptance, comments, uploads, and exports use atomic PostgreSQL fixed-window counters. The generic caller-configurable primitive is private and accepts only a closed operation set; authenticated clients can call only bounded operation-specific functions. Expected validation, conflict, invalid-token, and exhausted-limit outcomes return structured results so their counter transaction is not rolled back. Upload and export attempts are consumed in separate committed calls before expensive work. Keys hash the Clerk subject and a database-approved organization or global scope, preventing attacker-controlled operations or unlimited keys from creating unbounded rows. Expired windows should be removed by the cleanup job described in the Storage documentation.

## Error handling

Expected errors expose only a stable code and actionable message. Database constraints, provider responses, SQL details, and stack traces are logged only on the server. Unexpected errors include an opaque correlation ID in the response.

## Secrets

Only `NEXT_PUBLIC_` values are browser-visible. Clerk secret keys, database passwords, service-role keys, API tokens, and `WORKGRID_SERVER_PROOF_SECRET` must stay in local or platform secret stores. The proof secret must be at least 32 characters and the same value must be provisioned out of band into the single inaccessible row in `private.workgrid_server_config`. That schema is denied to `anon` and `authenticated`. WorkGrid's normal application path does not use a Supabase service-role key.

## Project visibility

Project access is organization-wide in this product version: every active organization member can view every project and its tasks. WorkGrid does not claim to provide project-specific ACLs. Project and task writes still follow the role matrix, server authorization, resource checks, and RLS tenant boundary.

## Browser security

Clerk middleware generates a per-request nonce and a strict Content Security Policy that includes the active Clerk Frontend API and bot-protection endpoints. WorkGrid adds `frame-ancestors 'none'`, `object-src 'none'`, a same-origin base URI, HSTS, a restrictive permissions policy, MIME sniffing protection, and a strict-origin referrer policy.

## Security regression process

Every discovered authorization or tenant-isolation defect must first receive a failing regression test. Application tests cover guards and validators; pgTAP covers RLS, constraints, cross-tenant denial, role escalation, audit immutability, and Storage isolation.

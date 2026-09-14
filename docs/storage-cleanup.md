# Attachment cleanup and deletion

WorkGrid creates pending metadata only through a server-proofed reservation RPC. A successful upload is first sealed to the exact Storage object ID in `verifying`, which prevents client replacement. The application re-downloads and hashes the complete private object, validates its content again, and only then supplies a separate proof that can promote it to `ready`.

A trusted scheduled job should run at least daily and:

1. Run `private.reconcile_stale_attachment_metadata()` as a database owner. It binds and moves stale stored `pending` objects and stale `verifying` rows to non-readable `discarding`, restores stale `deleting` rows to `ready` when their trusted object still exists, removes deletion/discard metadata when the object is absent, and cancels old object-free pending reservations.
2. For `discarding` rows that still have an object, remove the object through a narrowly scoped worker and run reconciliation again after the retry interval. Never mark these rows ready in bulk. A stale pending or verifying object must be discarded, not trusted without a fresh server read and proof.
3. Alert on objects in the `attachments` bucket with no matching metadata row; verify their age before deleting them.
4. Remove expired rows from `rate_limit_windows` where `expires_at < now()`.

Normal deletion first changes ready metadata to `deleting`, then removes the private object. Reconciliation deletes metadata only when `storage.objects` confirms the object is absent; otherwise it restores `ready`. This prevents ready metadata from permanently pointing to a missing object and gives transient failures an explicit retry state. The job must use a narrowly scoped server credential and must never expose that credential to the browser.

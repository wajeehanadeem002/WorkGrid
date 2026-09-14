begin;

select plan(52);

select hasnt_function(
  'public',
  'consume_rate_limit',
  array['text', 'text', 'integer', 'integer'],
  'the generic caller-configured rate-limit primitive is removed'
);

insert into private.workgrid_server_config (singleton, proof_secret)
values (true, '0123456789abcdef0123456789abcdef');

insert into public.organizations (id, name, slug, created_by)
values
  ('50000000-0000-4000-8000-000000000005', 'Secure tenant', 'secure-tenant', 'user_secure_owner'),
  ('60000000-0000-4000-8000-000000000006', 'Other tenant', 'other-tenant', 'user_other_owner');

insert into public.organization_members (id, organization_id, user_id, role)
values
  ('51000000-0000-4000-8000-000000000005', '50000000-0000-4000-8000-000000000005', 'user_secure_owner', 'owner'),
  ('51000000-0000-4000-8000-000000000006', '50000000-0000-4000-8000-000000000005', 'user_secure_uploader', 'member'),
  ('61000000-0000-4000-8000-000000000006', '60000000-0000-4000-8000-000000000006', 'user_other_owner', 'owner');

insert into public.projects (id, organization_id, name, key, created_by)
values
  ('55000000-0000-4000-8000-000000000005', '50000000-0000-4000-8000-000000000005', 'Secure project', 'SEC', 'user_secure_owner'),
  ('66000000-0000-4000-8000-000000000006', '60000000-0000-4000-8000-000000000006', 'Other project', 'OTH', 'user_other_owner');

insert into public.tasks (id, organization_id, project_id, title, assignee_id, reporter_id)
values
  ('55500000-0000-4000-8000-000000000005', '50000000-0000-4000-8000-000000000005', '55000000-0000-4000-8000-000000000005', 'Secure task', 'user_secure_uploader', 'user_secure_owner'),
  ('66600000-0000-4000-8000-000000000006', '60000000-0000-4000-8000-000000000006', '66000000-0000-4000-8000-000000000006', 'Other task', null, 'user_other_owner');

insert into public.attachments (
  id, organization_id, project_id, task_id, uploaded_by, storage_path,
  original_name, mime_type, size_bytes, content_sha256, created_at
)
values (
  '55550000-0000-4000-8000-000000000035',
  '50000000-0000-4000-8000-000000000005',
  '55000000-0000-4000-8000-000000000005',
  '55500000-0000-4000-8000-000000000005',
  'user_secure_uploader',
  '50000000-0000-4000-8000-000000000005/55000000-0000-4000-8000-000000000005/55500000-0000-4000-8000-000000000005/55550000-0000-4000-8000-000000000035/stale-cleanup.pdf',
  'stale-cleanup.pdf', 'application/pdf', 10, repeat('f', 64),
  now() - interval '2 hours'
);
insert into storage.objects (id, bucket_id, name, metadata)
values (
  '89898989-8989-4989-8989-898989898989',
  'attachments',
  '50000000-0000-4000-8000-000000000005/55000000-0000-4000-8000-000000000005/55500000-0000-4000-8000-000000000005/55550000-0000-4000-8000-000000000035/stale-cleanup.pdf',
  '{"mimetype":"application/pdf","size":10}'
);

select set_config(
  'workgrid.test.reserve_one',
  encode(extensions.hmac(
    'reserve-attachment:' || private.proof_payload(array[
      'user_secure_uploader',
      '50000000-0000-4000-8000-000000000005',
      '55000000-0000-4000-8000-000000000005',
      '55500000-0000-4000-8000-000000000005',
      '55550000-0000-4000-8000-000000000005',
      '50000000-0000-4000-8000-000000000005/55000000-0000-4000-8000-000000000005/55500000-0000-4000-8000-000000000005/55550000-0000-4000-8000-000000000005/verified.pdf',
      'verified.pdf', 'application/pdf', '10', repeat('c', 64)
    ]),
    '0123456789abcdef0123456789abcdef',
    'sha256'
  ), 'hex'),
  true
);
select set_config(
  'workgrid.test.seal_one',
  encode(extensions.hmac(
    'seal-attachment:' || private.proof_payload(array[
      'user_secure_uploader',
      '50000000-0000-4000-8000-000000000005',
      '55000000-0000-4000-8000-000000000005',
      '55500000-0000-4000-8000-000000000005',
      '55550000-0000-4000-8000-000000000005',
      '50000000-0000-4000-8000-000000000005/55000000-0000-4000-8000-000000000005/55500000-0000-4000-8000-000000000005/55550000-0000-4000-8000-000000000005/verified.pdf',
      'verified.pdf', 'application/pdf', '10', repeat('c', 64),
      '77777777-7777-4777-8777-777777777777'
    ]),
    '0123456789abcdef0123456789abcdef',
    'sha256'
  ), 'hex'),
  true
);
select set_config(
  'workgrid.test.finalize_one',
  encode(extensions.hmac(
    'finalize-attachment:' || private.proof_payload(array[
      'user_secure_uploader',
      '50000000-0000-4000-8000-000000000005',
      '55000000-0000-4000-8000-000000000005',
      '55500000-0000-4000-8000-000000000005',
      '55550000-0000-4000-8000-000000000005',
      '50000000-0000-4000-8000-000000000005/55000000-0000-4000-8000-000000000005/55500000-0000-4000-8000-000000000005/55550000-0000-4000-8000-000000000005/verified.pdf',
      'verified.pdf', 'application/pdf', '10', repeat('c', 64),
      '77777777-7777-4777-8777-777777777777'
    ]),
    '0123456789abcdef0123456789abcdef',
    'sha256'
  ), 'hex'),
  true
);
select set_config(
  'workgrid.test.reserve_two',
  encode(extensions.hmac(
    'reserve-attachment:' || private.proof_payload(array[
      'user_secure_uploader',
      '50000000-0000-4000-8000-000000000005',
      '55000000-0000-4000-8000-000000000005',
      '55500000-0000-4000-8000-000000000005',
      '55550000-0000-4000-8000-000000000015',
      '50000000-0000-4000-8000-000000000005/55000000-0000-4000-8000-000000000005/55500000-0000-4000-8000-000000000005/55550000-0000-4000-8000-000000000015/cancel.pdf',
      'cancel.pdf', 'application/pdf', '10', repeat('d', 64)
    ]),
    '0123456789abcdef0123456789abcdef',
    'sha256'
  ), 'hex'),
  true
);
select set_config(
  'workgrid.test.cancel_two',
  encode(extensions.hmac(
    'cancel-attachment:' || private.proof_payload(array[
      'user_secure_uploader',
      '55550000-0000-4000-8000-000000000015',
      '50000000-0000-4000-8000-000000000005/55000000-0000-4000-8000-000000000005/55500000-0000-4000-8000-000000000005/55550000-0000-4000-8000-000000000015/cancel.pdf'
    ]),
    '0123456789abcdef0123456789abcdef',
    'sha256'
  ), 'hex'),
  true
);
select set_config(
  'workgrid.test.reserve_three',
  encode(extensions.hmac(
    'reserve-attachment:' || private.proof_payload(array[
      'user_secure_uploader',
      '50000000-0000-4000-8000-000000000005',
      '55000000-0000-4000-8000-000000000005',
      '55500000-0000-4000-8000-000000000005',
      '55550000-0000-4000-8000-000000000025',
      '50000000-0000-4000-8000-000000000005/55000000-0000-4000-8000-000000000005/55500000-0000-4000-8000-000000000005/55550000-0000-4000-8000-000000000025/stale.pdf',
      'stale.pdf', 'application/pdf', '10', repeat('e', 64)
    ]),
    '0123456789abcdef0123456789abcdef',
    'sha256'
  ), 'hex'),
  true
);
select set_config(
  'workgrid.test.seal_three',
  encode(extensions.hmac(
    'seal-attachment:' || private.proof_payload(array[
      'user_secure_uploader',
      '50000000-0000-4000-8000-000000000005',
      '55000000-0000-4000-8000-000000000005',
      '55500000-0000-4000-8000-000000000005',
      '55550000-0000-4000-8000-000000000025',
      '50000000-0000-4000-8000-000000000005/55000000-0000-4000-8000-000000000005/55500000-0000-4000-8000-000000000005/55550000-0000-4000-8000-000000000025/stale.pdf',
      'stale.pdf', 'application/pdf', '10', repeat('e', 64),
      '88888888-8888-4888-8888-888888888888'
    ]),
    '0123456789abcdef0123456789abcdef',
    'sha256'
  ), 'hex'),
  true
);

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"user_secure_uploader","role":"authenticated"}', true);

select throws_ok(
  $$insert into public.attachments (id, organization_id, project_id, task_id, uploaded_by, storage_path, original_name, mime_type, size_bytes, content_sha256) values ('55550000-0000-4000-8000-000000000099', '50000000-0000-4000-8000-000000000005', '55000000-0000-4000-8000-000000000005', '55500000-0000-4000-8000-000000000005', 'user_secure_uploader', '50000000-0000-4000-8000-000000000005/55000000-0000-4000-8000-000000000005/55500000-0000-4000-8000-000000000005/55550000-0000-4000-8000-000000000099/bypass.pdf', 'bypass.pdf', 'application/pdf', 10, repeat('f', 64))$$,
  '42501', null,
  'direct authenticated clients cannot reserve attachment metadata'
);
select results_eq(
  $$select public.reserve_attachment('55550000-0000-4000-8000-000000000005', '50000000-0000-4000-8000-000000000005', '55000000-0000-4000-8000-000000000005', '55500000-0000-4000-8000-000000000005', '50000000-0000-4000-8000-000000000005/55000000-0000-4000-8000-000000000005/55500000-0000-4000-8000-000000000005/55550000-0000-4000-8000-000000000005/verified.pdf', 'verified.pdf', 'application/pdf', 10, repeat('c', 64), repeat('0', 64)) ->> 'code'$$,
  array['FORBIDDEN'],
  'a direct client cannot reserve trusted metadata without a server proof'
);
select results_eq(
  $$select public.reserve_attachment('55550000-0000-4000-8000-000000000005', '50000000-0000-4000-8000-000000000005', '55000000-0000-4000-8000-000000000005', '55500000-0000-4000-8000-000000000005', '50000000-0000-4000-8000-000000000005/55000000-0000-4000-8000-000000000005/55500000-0000-4000-8000-000000000005/55550000-0000-4000-8000-000000000005/verified.pdf', 'verified.pdf', 'application/pdf', 10, repeat('c', 64), current_setting('workgrid.test.reserve_one')) ->> 'ok'$$,
  array['true'],
  'a valid server proof creates a pending reservation'
);
select results_eq('select count(*)::bigint from public.attachments', array[0::bigint], 'pending metadata is not exposed through RLS');
select throws_ok(
  $$update public.attachments set upload_status = 'ready' where id = '55550000-0000-4000-8000-000000000005'$$,
  '42501', null,
  'direct authenticated clients cannot mark pending attachments ready'
);
select lives_ok(
  $$insert into storage.objects (id, bucket_id, name, metadata) values ('77777777-7777-4777-8777-777777777777', 'attachments', '50000000-0000-4000-8000-000000000005/55000000-0000-4000-8000-000000000005/55500000-0000-4000-8000-000000000005/55550000-0000-4000-8000-000000000005/verified.pdf', '{"mimetype":"application/pdf","size":10}')$$,
  'Storage accepts bytes only for a controlled pending reservation'
);
select results_eq(
  $$select count(*)::bigint from storage.objects where name like '%/verified.pdf'$$,
  array[0::bigint],
  'pending Storage objects cannot be read or listed directly'
);
select results_eq(
  $$select public.seal_attachment_upload('55550000-0000-4000-8000-000000000005', '77777777-7777-4777-8777-777777777777', repeat('0', 64)) ->> 'code'$$,
  array['FORBIDDEN'],
  'arbitrary uploaded bytes cannot enter verification without the server proof'
);
select results_eq(
  $$select public.seal_attachment_upload('55550000-0000-4000-8000-000000000005', '77777777-7777-4777-8777-777777777777', current_setting('workgrid.test.seal_one')) ->> 'ok'$$,
  array['true'],
  'a proof bound to the exact Storage object seals immutable bytes for verification'
);
select results_eq(
  $$select count(*)::bigint from storage.objects where name like '%/verified.pdf'$$,
  array[1::bigint],
  'only the uploader can read back a sealed verifying object'
);
select results_eq(
  $$select public.finalize_attachment('55550000-0000-4000-8000-000000000005', '77777777-7777-4777-8777-777777777777', repeat('c', 64), repeat('0', 64)) ->> 'code'$$,
  array['FORBIDDEN'],
  'a direct client cannot promote sealed bytes without the post-verification proof'
);
select results_eq(
  $$select public.finalize_attachment('55550000-0000-4000-8000-000000000005', '77777777-7777-4777-8777-777777777777', repeat('c', 64), current_setting('workgrid.test.finalize_one')) ->> 'ok'$$,
  array['true'],
  'finalization verifies the post-read proof and exact stored object identity'
);
select results_eq('select count(*)::bigint from public.attachments', array[1::bigint], 'ready metadata becomes visible after controlled finalization');
select results_eq('select count(*)::bigint from storage.objects where bucket_id = ''attachments''', array[1::bigint], 'the finalized private object is readable to its tenant');
select throws_ok(
  $$update public.attachments set upload_status = 'pending' where id = '55550000-0000-4000-8000-000000000005'$$,
  '42501', null,
  'direct clients cannot rewrite attachment state after finalization'
);
select throws_ok(
  $$delete from public.attachments where id = '55550000-0000-4000-8000-000000000005'$$,
  '42501', null,
  'direct clients cannot delete ready metadata before private Storage'
);
select results_eq(
  $$select public.begin_attachment_deletion('55550000-0000-4000-8000-000000000005') ->> 'ok'$$,
  array['true'],
  'authorized deletion first marks metadata as deleting'
);
select results_eq(
  $$delete from storage.objects where name like '%/verified.pdf' returning name$$,
  array['50000000-0000-4000-8000-000000000005/55000000-0000-4000-8000-000000000005/55500000-0000-4000-8000-000000000005/55550000-0000-4000-8000-000000000005/verified.pdf'],
  'private Storage deletion is allowed only after the deleting transition'
);
select results_eq(
  $$select public.reconcile_attachment_deletion('55550000-0000-4000-8000-000000000005') ->> 'outcome'$$,
  array['DELETED'],
  'reconciliation deletes metadata only after the object is absent'
);
select results_eq('select count(*)::bigint from public.attachments', array[0::bigint], 'deleted attachment metadata no longer exists');

select results_eq(
  $$select public.reserve_attachment('55550000-0000-4000-8000-000000000015', '50000000-0000-4000-8000-000000000005', '55000000-0000-4000-8000-000000000005', '55500000-0000-4000-8000-000000000005', '50000000-0000-4000-8000-000000000005/55000000-0000-4000-8000-000000000005/55500000-0000-4000-8000-000000000005/55550000-0000-4000-8000-000000000015/cancel.pdf', 'cancel.pdf', 'application/pdf', 10, repeat('d', 64), current_setting('workgrid.test.reserve_two')) ->> 'ok'$$,
  array['true'],
  'a second upload can be reserved'
);
select lives_ok(
  $$insert into storage.objects (id, bucket_id, name, metadata) values ('99999999-9999-4999-8999-999999999999', 'attachments', '50000000-0000-4000-8000-000000000005/55000000-0000-4000-8000-000000000005/55500000-0000-4000-8000-000000000005/55550000-0000-4000-8000-000000000015/cancel.pdf', '{"mimetype":"application/pdf","size":10}')$$,
  'unverified uploaded bytes can exist only behind a pending reservation'
);
select results_eq(
  $$select public.cancel_attachment_reservation('55550000-0000-4000-8000-000000000015', repeat('0', 64)) ->> 'code'$$,
  array['FORBIDDEN'],
  'a direct client cannot cancel a reservation without the server proof'
);
select results_eq(
  $$select public.cancel_attachment_reservation('55550000-0000-4000-8000-000000000015', current_setting('workgrid.test.cancel_two')) ->> 'ok'$$,
  array['true'],
  'failed-upload cleanup seals the object into a non-readable discarding state'
);
select results_eq(
  $$delete from storage.objects where name like '%/cancel.pdf' returning name$$,
  array['50000000-0000-4000-8000-000000000005/55000000-0000-4000-8000-000000000005/55500000-0000-4000-8000-000000000005/55550000-0000-4000-8000-000000000015/cancel.pdf'],
  'discarding bytes can be removed but cannot be downloaded'
);
select results_eq(
  $$select public.cancel_attachment_reservation('55550000-0000-4000-8000-000000000015', current_setting('workgrid.test.cancel_two')) ->> 'outcome'$$,
  array['DELETED'],
  'discarding metadata is removed only after Storage is empty'
);
select results_eq(
  $$select public.cancel_attachment_reservation('55550000-0000-4000-8000-000000000015', current_setting('workgrid.test.cancel_two')) ->> 'code'$$,
  array['NOT_FOUND'],
  'reservation cleanup verifies the affected row'
);

select results_eq(
  $$select public.reserve_attachment('55550000-0000-4000-8000-000000000025', '50000000-0000-4000-8000-000000000005', '55000000-0000-4000-8000-000000000005', '55500000-0000-4000-8000-000000000005', '50000000-0000-4000-8000-000000000005/55000000-0000-4000-8000-000000000005/55500000-0000-4000-8000-000000000005/55550000-0000-4000-8000-000000000025/stale.pdf', 'stale.pdf', 'application/pdf', 10, repeat('e', 64), current_setting('workgrid.test.reserve_three')) ->> 'ok'$$,
  array['true'],
  'a member can reserve before removal'
);
select lives_ok(
  $$insert into storage.objects (id, bucket_id, name, metadata) values ('88888888-8888-4888-8888-888888888888', 'attachments', '50000000-0000-4000-8000-000000000005/55000000-0000-4000-8000-000000000005/55500000-0000-4000-8000-000000000005/55550000-0000-4000-8000-000000000025/stale.pdf', '{"mimetype":"application/pdf","size":10}')$$,
  'the pre-removal upload reaches private Storage'
);

reset role;
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"user_secure_owner","role":"authenticated"}', true);
select results_eq(
  $$select public.remove_organization_member('50000000-0000-4000-8000-000000000005', id) ->> 'ok' from public.organization_members where user_id = 'user_secure_uploader'$$,
  array['true'],
  'owner removes the uploader through the locked RPC'
);
select results_eq(
  $$select assignee_id from public.tasks where id = '55500000-0000-4000-8000-000000000005'$$,
  array[null::text],
  'member removal atomically unassigns tasks'
);
select results_eq(
  $$update public.tasks set status = 'DONE' where id = '66600000-0000-4000-8000-000000000006' returning id$$,
  array[]::uuid[],
  'cross-tenant updates remain denied'
);
select results_eq(
  $$delete from public.projects where id = '66000000-0000-4000-8000-000000000006' returning id$$,
  array[]::uuid[],
  'cross-tenant deletes remain denied'
);

reset role;
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"user_secure_uploader","role":"authenticated"}', true);
select results_eq(
  $$select public.seal_attachment_upload('55550000-0000-4000-8000-000000000025', '88888888-8888-4888-8888-888888888888', current_setting('workgrid.test.seal_three')) ->> 'code'$$,
  array['NOT_FOUND'],
  'a removed member cannot seal a previously uploaded object with a stale session'
);
select results_eq('select count(*)::bigint from storage.objects where name like ''%/stale.pdf''', array[0::bigint], 'a removed member cannot read the pending object');

reset role;
select set_config('request.jwt.claims', '{}', true);
select results_eq(
  $$select marked_discarding from private.reconcile_stale_attachment_metadata()$$,
  array[1],
  'trusted cleanup seals a stale pending object into discarding after an interrupted upload'
);
select results_eq(
  $$select upload_status::text from public.attachments where id = '55550000-0000-4000-8000-000000000035'$$,
  array['discarding'],
  'interrupted upload bytes stay explicitly untrusted'
);
select results_eq(
  $$delete from storage.objects where name like '%/stale-cleanup.pdf' returning id$$,
  array['89898989-8989-4989-8989-898989898989'::uuid],
  'a trusted cleanup worker can remove the sealed orphan object'
);
update public.attachments
set deletion_started_at = now() - interval '20 minutes'
where id = '55550000-0000-4000-8000-000000000035';
select results_eq(
  $$select discarded_metadata from private.reconcile_stale_attachment_metadata()$$,
  array[1],
  'trusted cleanup removes untrusted metadata only after Storage is empty'
);
select results_eq(
  $$select count(*)::bigint from public.attachments where id = '55550000-0000-4000-8000-000000000035'$$,
  array[0::bigint],
  'interrupted upload cleanup leaves no orphan metadata'
);

reset role;
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"user_secure_owner","role":"authenticated"}', true);
select results_eq(
  $$select bool_and(public.consume_export_attempt('50000000-0000-4000-8000-000000000005')) from generate_series(1, 5)$$,
  array[true],
  'the fixed export allowance accepts five attempts'
);
select results_eq(
  $$select public.consume_export_attempt('50000000-0000-4000-8000-000000000005')$$,
  array[false],
  'the operation-specific export function rejects the sixth attempt'
);
select results_eq(
  $$select count(*)::bigint from public.rate_limit_windows where operation not in ('create_organization', 'create_invitation', 'preview_invitation', 'accept_invitation', 'create_comment', 'upload_attachment', 'export_data')$$,
  array[0::bigint],
  'attackers cannot create arbitrary rate-limit operation rows'
);
select results_eq(
  $$update public.organizations set name = 'Secure tenant updated' where id = '50000000-0000-4000-8000-000000000005' returning name$$,
  array['Secure tenant updated'],
  'an active owner can update the organization through the membership-lock trigger'
);

reset role;
set local role authenticated;
select set_config('request.jwt.claims', '{"role":"authenticated"}', true);
select results_eq(
  $$select public.change_organization_member_role('50000000-0000-4000-8000-000000000005', '51000000-0000-4000-8000-000000000005', 'admin') ->> 'code'$$,
  array['FORBIDDEN'],
  'a missing authenticated subject cannot exploit a null role check'
);
select results_eq(
  $$select public.remove_organization_member('50000000-0000-4000-8000-000000000005', '51000000-0000-4000-8000-000000000005') ->> 'code'$$,
  array['FORBIDDEN'],
  'a missing authenticated subject cannot remove a member'
);

reset role;
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"user_secure_owner","role":"authenticated"}', true);
select set_config(
  'workgrid.test.invitation_token',
  (public.create_organization_invitation('50000000-0000-4000-8000-000000000005', 'invited@example.com', 'member') ->> 'token'),
  true
);

reset role;
select set_config(
  'workgrid.test.invitation_wrong_proof',
  encode(extensions.hmac(
    'accept-invitation:' || private.proof_payload(array[
      'user_invitee',
      'wrong@example.com',
      encode(extensions.digest(current_setting('workgrid.test.invitation_token'), 'sha256'), 'hex')
    ]),
    '0123456789abcdef0123456789abcdef',
    'sha256'
  ), 'hex'),
  true
);
select set_config(
  'workgrid.test.invitation_good_proof',
  encode(extensions.hmac(
    'accept-invitation:' || private.proof_payload(array[
      'user_invitee',
      'invited@example.com',
      encode(extensions.digest(current_setting('workgrid.test.invitation_token'), 'sha256'), 'hex')
    ]),
    '0123456789abcdef0123456789abcdef',
    'sha256'
  ), 'hex'),
  true
);

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"user_invitee","role":"authenticated"}', true);
select results_eq(
  $$select public.accept_organization_invitation(current_setting('workgrid.test.invitation_token'), 'wrong@example.com', current_setting('workgrid.test.invitation_wrong_proof')) ->> 'code'$$,
  array['INVALID_INVITATION'],
  'a valid token cannot be accepted by a different verified email'
);
select results_eq(
  $$select public.accept_organization_invitation(current_setting('workgrid.test.invitation_token'), 'invited@example.com', repeat('0', 64)) ->> 'code'$$,
  array['INVALID_INVITATION'],
  'a direct client cannot accept an invitation without the server proof'
);
select results_eq(
  $$select public.accept_organization_invitation(current_setting('workgrid.test.invitation_token'), 'invited@example.com', current_setting('workgrid.test.invitation_good_proof')) ->> 'ok'$$,
  array['true'],
  'the intended verified email can accept once'
);
select results_eq(
  $$select public.accept_organization_invitation(current_setting('workgrid.test.invitation_token'), 'invited@example.com', current_setting('workgrid.test.invitation_good_proof')) ->> 'code'$$,
  array['INVALID_INVITATION'],
  'the same invitation cannot be accepted twice'
);
select results_eq(
  $$select role::text from public.organization_members where organization_id = '50000000-0000-4000-8000-000000000005' and user_id = 'user_invitee'$$,
  array['member'],
  'acceptance creates only the invited role'
);

select * from finish();
rollback;

begin;

select plan(34);

select has_column(
  'public', 'attachments', 'cleanup_claimed_at',
  'attachments track an internal cleanup lease'
);
select has_function(
  'public', 'claim_attachment_cleanup_batch', array[]::text[],
  'the worker has a fixed-argument claim RPC'
);
select hasnt_function(
  'public', 'claim_attachment_cleanup_batch', array['integer'],
  'callers cannot provide a cleanup batch limit'
);
select has_function(
  'public', 'finalize_attachment_cleanup', array['uuid'],
  'the worker finalizes only a claimed attachment identifier'
);
select results_eq(
  $$select has_function_privilege('service_role', 'public.claim_attachment_cleanup_batch()', 'EXECUTE')$$,
  array[true],
  'only the trusted service role can claim cleanup work'
);
select results_eq(
  $$select has_function_privilege('service_role', 'public.finalize_attachment_cleanup(uuid)', 'EXECUTE')$$,
  array[true],
  'the trusted service role can finalize claimed cleanup work'
);
select results_eq(
  $$select has_function_privilege('authenticated', 'public.claim_attachment_cleanup_batch()', 'EXECUTE')$$,
  array[false],
  'authenticated clients cannot claim cleanup work'
);
select results_eq(
  $$select has_function_privilege('anon', 'public.claim_attachment_cleanup_batch()', 'EXECUTE')$$,
  array[false],
  'anonymous clients cannot claim cleanup work'
);
select results_eq(
  $$select has_function_privilege('authenticated', 'public.finalize_attachment_cleanup(uuid)', 'EXECUTE')$$,
  array[false],
  'authenticated clients cannot finalize cleanup work'
);
select results_eq(
  $$select count(*)::bigint from cron.job where jobname = 'workgrid-attachment-cleanup'$$,
  array[1::bigint],
  'one named attachment cleanup cron job is installed'
);
select results_eq(
  $$select schedule from cron.job where jobname = 'workgrid-attachment-cleanup'$$,
  array['*/15 * * * *'],
  'attachment cleanup is scheduled every fifteen minutes'
);
select results_eq(
  $$select active from cron.job where jobname = 'workgrid-attachment-cleanup'$$,
  array[true],
  'the installed cleanup schedule is active'
);
select ok(
  (select command like '%workgrid_project_url%' and command like '%workgrid_cleanup_token%'
     from cron.job where jobname = 'workgrid-attachment-cleanup'),
  'the cron command resolves its URL and token from named Vault secrets'
);
select ok(
  (select command not like '%service_role%' and command not like '%supabase.co%'
     from cron.job where jobname = 'workgrid-attachment-cleanup'),
  'the cron command contains no elevated key or literal hosted URL'
);

set local role anon;
select throws_ok(
  $$select * from public.claim_attachment_cleanup_batch()$$,
  '42501', null,
  'anonymous Data API callers cannot invoke cleanup claims'
);
reset role;

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"attacker","role":"authenticated"}', true);
select throws_ok(
  $$select * from public.claim_attachment_cleanup_batch()$$,
  '42501', null,
  'authenticated Data API callers cannot invoke cleanup claims'
);
select throws_ok(
  $$select public.finalize_attachment_cleanup('70000000-0000-4000-8000-000000000001')$$,
  '42501', null,
  'authenticated Data API callers cannot finalize cleanup'
);
reset role;
select set_config('request.jwt.claims', '{}', true);

insert into public.organizations (id, name, slug, created_by)
values ('70000000-0000-4000-8000-000000000001', 'Cleanup tenant', 'cleanup-tenant', 'cleanup_owner');
insert into public.organization_members (id, organization_id, user_id, role)
values ('71000000-0000-4000-8000-000000000001', '70000000-0000-4000-8000-000000000001', 'cleanup_owner', 'owner');
insert into public.projects (id, organization_id, name, key, created_by)
values ('72000000-0000-4000-8000-000000000001', '70000000-0000-4000-8000-000000000001', 'Cleanup project', 'CLN', 'cleanup_owner');
insert into public.tasks (id, organization_id, project_id, title, reporter_id)
values ('73000000-0000-4000-8000-000000000001', '70000000-0000-4000-8000-000000000001', '72000000-0000-4000-8000-000000000001', 'Cleanup task', 'cleanup_owner');

insert into public.attachments (
  id, organization_id, project_id, task_id, uploaded_by, storage_path,
  original_name, mime_type, size_bytes, content_sha256, storage_object_id,
  upload_status, deletion_started_at, created_at
)
values
  ('74000000-0000-4000-8000-000000000001', '70000000-0000-4000-8000-000000000001', '72000000-0000-4000-8000-000000000001', '73000000-0000-4000-8000-000000000001', 'cleanup_owner', '70000000-0000-4000-8000-000000000001/72000000-0000-4000-8000-000000000001/73000000-0000-4000-8000-000000000001/74000000-0000-4000-8000-000000000001/ready.pdf', 'ready.pdf', 'application/pdf', 10, repeat('a', 64), '75000000-0000-4000-8000-000000000001', 'ready', null, now() - interval '2 hours'),
  ('74000000-0000-4000-8000-000000000002', '70000000-0000-4000-8000-000000000001', '72000000-0000-4000-8000-000000000001', '73000000-0000-4000-8000-000000000001', 'cleanup_owner', '70000000-0000-4000-8000-000000000001/72000000-0000-4000-8000-000000000001/73000000-0000-4000-8000-000000000001/74000000-0000-4000-8000-000000000002/retry.pdf', 'retry.pdf', 'application/pdf', 10, repeat('b', 64), '75000000-0000-4000-8000-000000000002', 'discarding', now() - interval '3 hours', now() - interval '3 hours'),
  ('74000000-0000-4000-8000-000000000003', '70000000-0000-4000-8000-000000000001', '72000000-0000-4000-8000-000000000001', '73000000-0000-4000-8000-000000000001', 'cleanup_owner', '70000000-0000-4000-8000-000000000001/72000000-0000-4000-8000-000000000001/73000000-0000-4000-8000-000000000001/74000000-0000-4000-8000-000000000003/delete.pdf', 'delete.pdf', 'application/pdf', 10, repeat('c', 64), '75000000-0000-4000-8000-000000000003', 'discarding', now() - interval '2 hours 59 minutes', now() - interval '3 hours'),
  ('74000000-0000-4000-8000-000000000004', '70000000-0000-4000-8000-000000000001', '72000000-0000-4000-8000-000000000001', '73000000-0000-4000-8000-000000000001', 'cleanup_owner', '70000000-0000-4000-8000-000000000001/72000000-0000-4000-8000-000000000001/73000000-0000-4000-8000-000000000001/74000000-0000-4000-8000-000000000004/restore.pdf', 'restore.pdf', 'application/pdf', 10, repeat('d', 64), '75000000-0000-4000-8000-000000000004', 'deleting', now() - interval '2 hours 58 minutes', now() - interval '3 hours'),
  ('74000000-0000-4000-8000-000000000005', '70000000-0000-4000-8000-000000000001', '72000000-0000-4000-8000-000000000001', '73000000-0000-4000-8000-000000000001', 'cleanup_owner', '70000000-0000-4000-8000-000000000001/72000000-0000-4000-8000-000000000001/73000000-0000-4000-8000-000000000001/74000000-0000-4000-8000-000000000005/recent.pdf', 'recent.pdf', 'application/pdf', 10, repeat('e', 64), '75000000-0000-4000-8000-000000000005', 'deleting', now() - interval '5 minutes', now() - interval '1 hour'),
  ('74000000-0000-4000-8000-000000000006', '70000000-0000-4000-8000-000000000001', '72000000-0000-4000-8000-000000000001', '73000000-0000-4000-8000-000000000001', 'cleanup_owner', '70000000-0000-4000-8000-000000000001/72000000-0000-4000-8000-000000000001/73000000-0000-4000-8000-000000000001/74000000-0000-4000-8000-000000000006/stale-pending.pdf', 'stale-pending.pdf', 'application/pdf', 10, repeat('f', 64), null, 'pending', null, now() - interval '2 hours'),
  ('74000000-0000-4000-8000-000000000007', '70000000-0000-4000-8000-000000000001', '72000000-0000-4000-8000-000000000001', '73000000-0000-4000-8000-000000000001', 'cleanup_owner', '70000000-0000-4000-8000-000000000001/72000000-0000-4000-8000-000000000001/73000000-0000-4000-8000-000000000001/74000000-0000-4000-8000-000000000007/empty-pending.pdf', 'empty-pending.pdf', 'application/pdf', 10, repeat('0', 64), null, 'pending', null, now() - interval '2 hours');

insert into storage.objects (id, bucket_id, name, metadata)
select storage_object_id, 'attachments', storage_path, jsonb_build_object('mimetype', mime_type, 'size', size_bytes)
from public.attachments
where id between '74000000-0000-4000-8000-000000000001' and '74000000-0000-4000-8000-000000000006'
  and storage_object_id is not null;
insert into storage.objects (id, bucket_id, name, metadata)
values ('75000000-0000-4000-8000-000000000006', 'attachments', '70000000-0000-4000-8000-000000000001/72000000-0000-4000-8000-000000000001/73000000-0000-4000-8000-000000000001/74000000-0000-4000-8000-000000000006/stale-pending.pdf', '{"mimetype":"application/pdf","size":10}');

insert into public.attachments (
  id, organization_id, project_id, task_id, uploaded_by, storage_path,
  original_name, mime_type, size_bytes, content_sha256, storage_object_id,
  upload_status, deletion_started_at, created_at
)
select
  ('76000000-0000-4000-8000-' || lpad(to_hex(number), 12, '0'))::uuid,
  '70000000-0000-4000-8000-000000000001',
  '72000000-0000-4000-8000-000000000001',
  '73000000-0000-4000-8000-000000000001',
  'cleanup_owner',
  '70000000-0000-4000-8000-000000000001/72000000-0000-4000-8000-000000000001/73000000-0000-4000-8000-000000000001/' || ('76000000-0000-4000-8000-' || lpad(to_hex(number), 12, '0'))::uuid || '/batch.pdf',
  'batch.pdf', 'application/pdf', 10, repeat('1', 64),
  ('77000000-0000-4000-8000-' || lpad(to_hex(number), 12, '0'))::uuid,
  'discarding', now() - interval '1 hour', now() - interval '2 hours'
from generate_series(1, 52) as numbers(number);
insert into storage.objects (id, bucket_id, name, metadata)
select storage_object_id, 'attachments', storage_path, '{"mimetype":"application/pdf","size":10}'::jsonb
from public.attachments where id::text like '76000000-%';

insert into public.rate_limit_windows (key_hash, operation, window_started_at, request_count, expires_at)
values
  (repeat('a', 64), 'export_data', now() - interval '2 hours', 1, now() - interval '1 hour'),
  (repeat('b', 64), 'export_data', now(), 1, now() + interval '1 hour');

set local role service_role;
create temporary table first_claim as
select * from public.claim_attachment_cleanup_batch();

select results_eq(
  $$select count(*)::bigint from first_claim$$,
  array[50::bigint],
  'the database controls the cleanup batch at fifty rows'
);
select results_eq(
  $$select count(*)::bigint from first_claim where cleanup_mode not in ('deleting', 'discarding')$$,
  array[0::bigint],
  'claims contain only explicit cleanup states'
);
select results_eq(
  $$select count(*)::bigint from first_claim where attachment_id = '74000000-0000-4000-8000-000000000001'$$,
  array[0::bigint],
  'ready attachments are never claimed'
);
select results_eq(
  $$select count(*)::bigint from first_claim where attachment_id = '74000000-0000-4000-8000-000000000005'$$,
  array[0::bigint],
  'a recent interactive deletion is not stolen by cleanup'
);
select results_eq(
  $$select upload_status::text || ':' || (storage_object_id is not null)::text from public.attachments where id = '74000000-0000-4000-8000-000000000006'$$,
  array['discarding:true'],
  'stale unverified Storage bytes are converted to an object-bound discarding state'
);
select results_eq(
  $$select count(*)::bigint from public.attachments where id = '74000000-0000-4000-8000-000000000007'$$,
  array[0::bigint],
  'old object-free pending reservations are removed'
);
select results_eq(
  $$select count(*)::bigint from public.rate_limit_windows where expires_at < now()$$,
  array[0::bigint],
  'expired rate-limit rows are removed during bounded maintenance'
);
select results_eq(
  $$select count(*)::bigint from public.rate_limit_windows where expires_at >= now()$$,
  array[1::bigint],
  'active rate-limit rows remain intact'
);
select results_eq(
  $$select public.finalize_attachment_cleanup('74000000-0000-4000-8000-000000000002') ->> 'outcome'$$,
  array['RETRY'],
  'a failed discard remains untrusted and retryable when Storage still exists'
);
select results_eq(
  $$select upload_status::text || ':' || (cleanup_claimed_at is null)::text from public.attachments where id = '74000000-0000-4000-8000-000000000002'$$,
  array['discarding:true'],
  'failed discard finalization releases its lease without becoming ready'
);
select results_eq(
  $$select public.finalize_attachment_cleanup('74000000-0000-4000-8000-000000000004') ->> 'outcome'$$,
  array['RESTORED'],
  'a failed trusted deletion restores readable metadata when Storage exists'
);
select results_eq(
  $$select upload_status::text || ':' || (deletion_started_at is null)::text from public.attachments where id = '74000000-0000-4000-8000-000000000004'$$,
  array['ready:true'],
  'restored deletion metadata is internally consistent'
);

reset role;
select set_config('storage.allow_delete_query', 'true', true);
select set_config('storage.operation', 'storage.object.delete_many', true);
delete from storage.objects where id = '75000000-0000-4000-8000-000000000003';
select set_config('storage.operation', '', true);
set local role service_role;
select results_eq(
  $$select public.finalize_attachment_cleanup('74000000-0000-4000-8000-000000000003') ->> 'outcome'$$,
  array['DELETED'],
  'metadata is deleted only after the official-API simulation removes Storage bytes'
);
select results_eq(
  $$select count(*)::bigint from public.attachments where id = '74000000-0000-4000-8000-000000000003'$$,
  array[0::bigint],
  'successful cleanup leaves no attachment metadata orphan'
);

create temporary table second_claim as
select * from public.claim_attachment_cleanup_batch();
select results_eq(
  $$select count(*)::bigint from first_claim first join second_claim second using (attachment_id) where first.attachment_id <> '74000000-0000-4000-8000-000000000002'$$,
  array[0::bigint],
  'active leases prevent concurrent reclaims of the same attachment'
);
select results_eq(
  $$select public.finalize_attachment_cleanup('74000000-0000-4000-8000-000000000001') ->> 'code'$$,
  array['NOT_FOUND'],
  'finalization cannot target an unclaimed ready attachment'
);
reset role;

select ok(
  position('delete from storage.objects' in lower(pg_get_functiondef('public.claim_attachment_cleanup_batch()'::regprocedure))) = 0
  and position('delete from storage.objects' in lower(pg_get_functiondef('public.finalize_attachment_cleanup(uuid)'::regprocedure))) = 0,
  'database cleanup functions never delete Storage objects through SQL'
);

select * from finish();
rollback;

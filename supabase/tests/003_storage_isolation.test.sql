begin;

select plan(8);

insert into public.organizations (id, name, slug, created_by)
values
  ('30000000-0000-4000-8000-000000000003', 'Gamma', 'gamma', 'user_gamma'),
  ('40000000-0000-4000-8000-000000000004', 'Delta', 'delta', 'user_delta');

insert into public.organization_members (organization_id, user_id, role)
values
  ('30000000-0000-4000-8000-000000000003', 'user_gamma', 'owner'),
  ('30000000-0000-4000-8000-000000000003', 'user_gamma_uploader', 'member'),
  ('40000000-0000-4000-8000-000000000004', 'user_delta', 'owner');

insert into public.projects (id, organization_id, name, key, created_by)
values
  ('33000000-0000-4000-8000-000000000003', '30000000-0000-4000-8000-000000000003', 'Gamma project', 'GAMMA', 'user_gamma'),
  ('44000000-0000-4000-8000-000000000004', '40000000-0000-4000-8000-000000000004', 'Delta project', 'DELTA', 'user_delta');

insert into public.attachments (id, organization_id, project_id, uploaded_by, storage_path, original_name, mime_type, size_bytes, content_sha256, storage_object_id, upload_status)
values
  ('33300000-0000-4000-8000-000000000003', '30000000-0000-4000-8000-000000000003', '33000000-0000-4000-8000-000000000003', 'user_gamma', '30000000-0000-4000-8000-000000000003/33000000-0000-4000-8000-000000000003/project/33300000-0000-4000-8000-000000000003/gamma.pdf', 'gamma.pdf', 'application/pdf', 10, repeat('0', 64), '73300000-0000-4000-8000-000000000003', 'ready'),
  ('33300000-0000-4000-8000-000000000006', '30000000-0000-4000-8000-000000000003', '33000000-0000-4000-8000-000000000003', 'user_gamma_uploader', '30000000-0000-4000-8000-000000000003/33000000-0000-4000-8000-000000000003/project/33300000-0000-4000-8000-000000000006/former-member.pdf', 'former-member.pdf', 'application/pdf', 10, repeat('0', 64), '73300000-0000-4000-8000-000000000006', 'ready'),
  ('44400000-0000-4000-8000-000000000004', '40000000-0000-4000-8000-000000000004', '44000000-0000-4000-8000-000000000004', 'user_delta', '40000000-0000-4000-8000-000000000004/44000000-0000-4000-8000-000000000004/project/44400000-0000-4000-8000-000000000004/delta.pdf', 'delta.pdf', 'application/pdf', 10, repeat('0', 64), '74400000-0000-4000-8000-000000000004', 'ready');

insert into storage.objects (id, bucket_id, name, metadata)
values
  ('73300000-0000-4000-8000-000000000003', 'attachments', '30000000-0000-4000-8000-000000000003/33000000-0000-4000-8000-000000000003/project/33300000-0000-4000-8000-000000000003/gamma.pdf', '{"mimetype":"application/pdf","size":10}'),
  ('73300000-0000-4000-8000-000000000006', 'attachments', '30000000-0000-4000-8000-000000000003/33000000-0000-4000-8000-000000000003/project/33300000-0000-4000-8000-000000000006/former-member.pdf', '{"mimetype":"application/pdf","size":10}'),
  ('74400000-0000-4000-8000-000000000004', 'attachments', '40000000-0000-4000-8000-000000000004/44000000-0000-4000-8000-000000000004/project/44400000-0000-4000-8000-000000000004/delta.pdf', '{"mimetype":"application/pdf","size":10}');

update public.organization_members
set removed_at = now()
where organization_id = '30000000-0000-4000-8000-000000000003'
  and user_id = 'user_gamma_uploader';

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"user_gamma","role":"authenticated"}', true);
-- The Storage API sets this transaction-local guard before deleting metadata.
-- Enabling it here lets pgTAP exercise WorkGrid's DELETE RLS policy instead of
-- being stopped first by Supabase's direct-SQL orphan-prevention trigger.
select set_config('storage.allow_delete_query', 'true', true);

select results_eq($$select count(*)::bigint from storage.objects where bucket_id = 'attachments'$$, array[2::bigint], 'storage listing is tenant isolated');
select results_eq($$select count(*)::bigint from public.attachments$$, array[2::bigint], 'attachment metadata is tenant isolated');
select results_eq($$select count(*)::bigint from storage.objects where name like '40000000-%'$$, array[0::bigint], 'modified storage path cannot cross tenants');
select throws_ok(
  $$insert into storage.objects (bucket_id, name, metadata) values ('attachments', '40000000-0000-4000-8000-000000000004/44000000-0000-4000-8000-000000000004/project/55500000-0000-4000-8000-000000000005/evil.pdf', '{"mimetype":"application/pdf","size":10}')$$,
  '42501',
  null,
  'member cannot upload to an unreserved cross-tenant path'
);
select results_eq(
  $$delete from storage.objects where name = '40000000-0000-4000-8000-000000000004/44000000-0000-4000-8000-000000000004/project/44400000-0000-4000-8000-000000000004/delta.pdf' returning name$$,
  array[]::text[],
  'member cannot delete another tenant storage object'
);

select set_config('request.jwt.claims', '{"sub":"user_delta","role":"authenticated"}', true);
select results_eq($$select count(*)::bigint from storage.objects where name like '30000000-%'$$, array[0::bigint], 'other tenant cannot read gamma object');

select set_config('request.jwt.claims', '{"sub":"user_gamma_uploader","role":"authenticated"}', true);
select results_eq($$select count(*)::bigint from storage.objects where bucket_id = 'attachments'$$, array[0::bigint], 'removed uploader cannot read storage with a stale token');
select results_eq(
  $$delete from storage.objects where name like '%former-member.pdf' returning name$$,
  array[]::text[],
  'removed uploader cannot delete storage with a stale token'
);

select * from finish();
rollback;

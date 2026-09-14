begin;

select plan(39);

insert into public.organizations (id, name, slug, created_by)
values
  ('10000000-0000-4000-8000-000000000001', 'Alpha', 'alpha', 'user_alpha'),
  ('20000000-0000-4000-8000-000000000002', 'Beta', 'beta', 'user_beta');

insert into public.organization_members (organization_id, user_id, role)
values
  ('10000000-0000-4000-8000-000000000001', 'user_alpha', 'owner'),
  ('10000000-0000-4000-8000-000000000001', 'user_member', 'member'),
  ('10000000-0000-4000-8000-000000000001', 'user_admin', 'admin'),
  ('10000000-0000-4000-8000-000000000001', 'user_peer_admin', 'admin'),
  ('10000000-0000-4000-8000-000000000001', 'user_removable', 'member'),
  ('20000000-0000-4000-8000-000000000002', 'user_beta', 'owner');

insert into public.organization_invitations (id, organization_id, email, role, token_hash, created_by, expires_at)
values
  ('13000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000001', 'admin@example.com', 'admin', repeat('a', 64), 'user_alpha', now() + interval '1 day'),
  ('14000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000001', 'member@example.com', 'member', repeat('b', 64), 'user_alpha', now() + interval '1 day');

insert into public.projects (id, organization_id, name, key, created_by)
values
  ('11000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000001', 'Alpha project', 'ALPHA', 'user_alpha'),
  ('22000000-0000-4000-8000-000000000002', '20000000-0000-4000-8000-000000000002', 'Beta project', 'BETA', 'user_beta');

insert into public.tasks (id, organization_id, project_id, title, reporter_id)
values
  ('11100000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000001', '11000000-0000-4000-8000-000000000001', 'Alpha task', 'user_alpha'),
  ('22200000-0000-4000-8000-000000000002', '20000000-0000-4000-8000-000000000002', '22000000-0000-4000-8000-000000000002', 'Beta task', 'user_beta');

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"user_alpha","role":"authenticated"}', true);

select results_eq('select count(*)::bigint from public.organizations', array[1::bigint], 'member sees one organization');
select results_eq('select count(*)::bigint from public.projects', array[1::bigint], 'member sees only tenant projects');
select results_eq('select count(*)::bigint from public.tasks', array[1::bigint], 'member sees only tenant tasks');
select results_eq($$select count(*)::bigint from public.projects where id = '22000000-0000-4000-8000-000000000002'$$, array[0::bigint], 'modified project id cannot cross tenants');
select results_eq($$select count(*)::bigint from public.tasks where id = '22200000-0000-4000-8000-000000000002'$$, array[0::bigint], 'modified task id cannot cross tenants');

select throws_ok(
  $$insert into public.tasks (organization_id, project_id, title, reporter_id) values ('10000000-0000-4000-8000-000000000001', '22000000-0000-4000-8000-000000000002', 'Cross tenant', 'user_alpha')$$,
  '23503',
  null,
  'composite foreign key rejects inconsistent task project'
);
select throws_ok(
  $$insert into public.tasks (organization_id, project_id, title, assignee_id, reporter_id) values ('10000000-0000-4000-8000-000000000001', '11000000-0000-4000-8000-000000000001', 'Cross tenant assignee', 'user_beta', 'user_alpha')$$,
  '23503',
  null,
  'composite foreign key rejects an assignee from another tenant'
);
select throws_ok(
  $$insert into public.comments (organization_id, task_id, author_id, body) values ('10000000-0000-4000-8000-000000000001', '22200000-0000-4000-8000-000000000002', 'user_alpha', 'Cross tenant comment')$$,
  '23503',
  null,
  'composite foreign key rejects a comment on another tenant task'
);
select throws_ok(
  $$insert into public.attachments (id, organization_id, project_id, task_id, uploaded_by, storage_path, original_name, mime_type, size_bytes) values ('33300000-0000-4000-8000-000000000003', '10000000-0000-4000-8000-000000000001', '11000000-0000-4000-8000-000000000001', '22200000-0000-4000-8000-000000000002', 'user_alpha', '10000000-0000-4000-8000-000000000001/11000000-0000-4000-8000-000000000001/22200000-0000-4000-8000-000000000002/33300000-0000-4000-8000-000000000003/cross.pdf', 'cross.pdf', 'application/pdf', 10)$$,
  '42501',
  null,
  'direct Data API attachment reservation is denied'
);
select throws_ok(
  $$insert into public.attachments (id, organization_id, project_id, uploaded_by, storage_path, original_name, mime_type, size_bytes) values ('33300000-0000-4000-8000-000000000004', '10000000-0000-4000-8000-000000000001', '11000000-0000-4000-8000-000000000001', 'user_alpha', '10000000-0000-4000-8000-000000000001/11000000-0000-4000-8000-000000000001/project/33300000-0000-4000-8000-000000000004/payload.exe', 'payload.exe', 'application/pdf', 10)$$,
  '42501',
  null,
  'direct Data API attachment metadata cannot bypass content validation'
);

select set_config('request.jwt.claims', '{"sub":"user_member","role":"authenticated"}', true);
select throws_ok(
  $$insert into public.projects (organization_id, name, key, created_by) values ('10000000-0000-4000-8000-000000000001', 'Escalation', 'ESC', 'user_member')$$,
  '42501',
  null,
  'member cannot create a project'
);

select lives_ok(
  $$insert into public.tasks (organization_id, project_id, title, reporter_id) values ('10000000-0000-4000-8000-000000000001', '11000000-0000-4000-8000-000000000001', 'Member task', 'user_member')$$,
  'member can create a task in own tenant'
);
select results_eq(
  $$select bool_and((public.create_comment('10000000-0000-4000-8000-000000000001', '11100000-0000-4000-8000-000000000001', 'Rate-limited comment ' || value) ->> 'ok')::boolean) from generate_series(1, 30) as series(value)$$,
  array[true],
  'database accepts comments within the operation-specific write limit'
);
select results_eq(
  $$select public.create_comment('10000000-0000-4000-8000-000000000001', '11100000-0000-4000-8000-000000000001', 'One too many') ->> 'code'$$,
  array['RATE_LIMITED'],
  'database counts and rejects the next direct RPC comment attempt'
);

select results_eq($$select public.create_organization('Rate organization one', 'rate-organization-one') ->> 'ok'$$, array['true'], 'first organization creation is within the limit');
select results_eq($$select public.create_organization('Rate organization two', 'rate-organization-two') ->> 'ok'$$, array['true'], 'second organization creation is within the limit');
select results_eq($$select public.create_organization('Rate organization three', 'rate-organization-three') ->> 'ok'$$, array['true'], 'third organization creation is within the limit');
select results_eq($$select public.create_organization('Rate organization four', 'rate-organization-four') ->> 'ok'$$, array['true'], 'fourth organization creation is within the limit');
select results_eq($$select public.create_organization('Rate organization five', 'rate-organization-five') ->> 'ok'$$, array['true'], 'fifth organization creation is within the limit');
select results_eq($$select public.create_organization('Rate organization six', 'rate-organization-six') ->> 'code'$$, array['RATE_LIMITED'], 'organization creation RPC cannot bypass its rate limit and records the rejection');

select set_config('request.jwt.claims', '{"sub":"user_alpha","role":"authenticated"}', true);
select results_eq($$select role::text from public.organization_members where user_id = 'user_alpha'$$, array['owner'], 'owner membership is visible');

select throws_ok(
  $$update public.tasks set created_at = now() - interval '1 year' where id = '11100000-0000-4000-8000-000000000001'$$,
  '23514',
  'created_at cannot be changed',
  'clients cannot rewrite resource creation history'
);

update public.tasks
set status = 'IN_PROGRESS', assignee_id = 'user_member'
where id = '11100000-0000-4000-8000-000000000001';
select results_eq(
  $$select count(*)::bigint from public.audit_logs where entity_id = '11100000-0000-4000-8000-000000000001' and action = 'task.status_changed'$$,
  array[1::bigint],
  'a status transition receives its own audit event'
);
select results_eq(
  $$select count(*)::bigint from public.audit_logs where entity_id = '11100000-0000-4000-8000-000000000001' and action = 'task.assigned'$$,
  array[1::bigint],
  'an assignment receives its own audit event even in a combined update'
);

select throws_ok(
  $$insert into public.organization_members (organization_id, user_id, role) values ('10000000-0000-4000-8000-000000000001', 'user_new_owner', 'owner')$$,
  '42501',
  null,
  'owner cannot create another owner through the data API'
);

select set_config('request.jwt.claims', '{"sub":"user_admin","role":"authenticated"}', true);
select results_eq(
  $$select public.revoke_organization_invitation('10000000-0000-4000-8000-000000000001', '13000000-0000-4000-8000-000000000001') ->> 'code'$$,
  array['FORBIDDEN'],
  'admin cannot revoke an admin invitation'
);
select results_eq(
  $$select public.revoke_organization_invitation('10000000-0000-4000-8000-000000000001', '14000000-0000-4000-8000-000000000001') ->> 'ok'$$,
  array['true'],
  'admin can revoke a member invitation'
);
select results_eq(
  $$select public.remove_organization_member('10000000-0000-4000-8000-000000000001', id) ->> 'code' from public.organization_members where user_id = 'user_peer_admin'$$,
  array['FORBIDDEN'],
  'admin cannot remove a peer admin'
);
select results_eq(
  $$select public.remove_organization_member('10000000-0000-4000-8000-000000000001', id) ->> 'ok' from public.organization_members where user_id = 'user_removable'$$,
  array['true'],
  'admin can soft-remove an ordinary member'
);

select set_config('request.jwt.claims', '{"sub":"user_alpha","role":"authenticated"}', true);
select results_eq(
  $$select public.remove_organization_member('10000000-0000-4000-8000-000000000001', id) ->> 'ok' from public.organization_members where organization_id = '10000000-0000-4000-8000-000000000001' and user_id = 'user_member'$$,
  array['true'],
  'owner can soft-remove a member without deleting historical authorship'
);
select results_eq(
  $$select assignee_id from public.tasks where id = '11100000-0000-4000-8000-000000000001'$$,
  array[null::text],
  'member removal transactionally unassigns affected tasks'
);
select results_eq(
  $$select count(*)::bigint from public.audit_logs where organization_id = '10000000-0000-4000-8000-000000000001' and action = 'member.removed' and metadata ->> 'user_id' = 'user_member'$$,
  array[1::bigint],
  'soft removal records an immutable member removal event'
);
select throws_ok(
  $$update public.tasks set assignee_id = 'user_member' where id = '11100000-0000-4000-8000-000000000001'$$,
  '23514',
  'Task assignee must be an active organization member',
  'removed members cannot be reassigned through a manipulated request'
);

select set_config('request.jwt.claims', '{"sub":"user_member","role":"authenticated"}', true);
select results_eq('select count(*)::bigint from public.organizations', array[0::bigint], 'a stale token cannot read the former tenant after removal');
select results_eq(
  $$update public.tasks set status = 'DONE' where organization_id = '10000000-0000-4000-8000-000000000001' returning id$$,
  array[]::uuid[],
  'a stale token cannot mutate tasks after membership removal'
);
select results_eq(
  $$delete from public.comments where organization_id = '10000000-0000-4000-8000-000000000001' and author_id = 'user_member' returning id$$,
  array[]::uuid[],
  'a stale token cannot delete historical comments after membership removal'
);

reset role;
select throws_ok(
  $$update public.audit_logs set action = 'tampered'$$,
  'P0001',
  'Audit logs are append-only',
  'audit rows cannot be updated'
);
select throws_ok(
  $$delete from public.audit_logs$$,
  'P0001',
  'Audit logs are append-only',
  'audit rows cannot be deleted'
);

set local role anon;
select set_config('request.jwt.claims', '{}', true);
select throws_ok(
  'select count(*)::bigint from public.organizations',
  '42501',
  null,
  'anonymous users cannot query organizations'
);

select * from finish();
rollback;

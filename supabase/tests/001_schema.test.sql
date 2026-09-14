begin;

select plan(33);

select has_extension('pgcrypto');
select has_extension('citext');
select has_extension('pg_trgm');

select has_table('public', 'organizations', 'organizations table exists');
select has_table('public', 'organization_members', 'organization members table exists');
select has_table('public', 'organization_invitations', 'organization invitations table exists');
select has_table('public', 'projects', 'projects table exists');
select has_table('public', 'tasks', 'tasks table exists');
select has_table('public', 'comments', 'comments table exists');
select has_table('public', 'attachments', 'attachments table exists');
select has_table('public', 'audit_logs', 'audit logs table exists');
select has_table('public', 'rate_limit_windows', 'rate limit windows table exists');

select col_is_pk('public', 'organizations', 'id', 'organizations use id as the primary key');
select col_is_pk('public', 'organization_members', 'id', 'organization members use id as the primary key');
select col_is_pk('public', 'projects', 'id', 'projects use id as the primary key');
select col_is_pk('public', 'tasks', 'id', 'tasks use id as the primary key');
select col_is_pk('public', 'comments', 'id', 'comments use id as the primary key');
select col_is_pk('public', 'attachments', 'id', 'attachments use id as the primary key');
select col_is_pk('public', 'audit_logs', 'id', 'audit logs use id as the primary key');
select has_column('public', 'organization_members', 'removed_at', 'members retain a soft-removal timestamp for historical integrity');
select col_not_null('public', 'organization_invitations', 'email', 'invitations are bound to an email');
select col_not_null('public', 'attachments', 'content_sha256', 'ready attachments retain the server-verified content digest');
select has_column('public', 'attachments', 'storage_object_id', 'verified attachments bind to the exact immutable Storage object');
select has_column('public', 'attachments', 'deletion_started_at', 'attachment deletion has a recoverable intermediate state');

select col_not_null('public', 'projects', 'organization_id');
select col_not_null('public', 'tasks', 'organization_id');
select col_not_null('public', 'comments', 'organization_id');
select col_not_null('public', 'attachments', 'organization_id');
select col_not_null('public', 'audit_logs', 'organization_id');

select ok((select relrowsecurity from pg_class where oid = 'public.organizations'::regclass), 'organizations enables RLS');
select ok((select relrowsecurity from pg_class where oid = 'public.tasks'::regclass), 'tasks enables RLS');
select ok((select relrowsecurity from pg_class where oid = 'public.audit_logs'::regclass), 'audit logs enable RLS');
select ok((select relrowsecurity from pg_class where oid = 'public.attachments'::regclass), 'attachments enable RLS');

select * from finish();
rollback;

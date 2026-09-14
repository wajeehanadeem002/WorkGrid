create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

do $$
begin
  if exists (select 1 from public.attachments) then
    raise exception 'Attachment security hardening requires an empty pre-release attachments table'
      using hint = 'Verify and migrate stored bytes explicitly before applying this greenfield migration to a database containing attachments.';
  end if;
end;
$$;

create table private.workgrid_server_config (
  singleton boolean primary key default true check (singleton),
  proof_secret text not null check (char_length(proof_secret) between 32 and 256)
);
revoke all on private.workgrid_server_config from public, anon, authenticated;

alter table public.organization_invitations
  alter column email set not null;
alter table public.organization_invitations
  add constraint organization_invitations_email_check
    check (char_length(email::text) between 3 and 254 and email::text ~* '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'),
  add constraint organization_invitations_expiry_window_check
    check (expires_at <= created_at + interval '7 days');
drop trigger if exists attachments_audit on public.attachments;

alter table public.attachments
  add column content_sha256 text,
  add column storage_object_id uuid,
  add column deletion_started_at timestamptz,
  add constraint attachments_content_hash_check
    check (content_sha256 is null or content_sha256 ~ '^[a-f0-9]{64}$');

update public.attachments
set content_sha256 = repeat('0', 64)
where content_sha256 is null;

update public.attachments
set storage_object_id = object.id
from storage.objects object
where public.attachments.storage_path = object.name
  and object.bucket_id = 'attachments'
  and public.attachments.storage_object_id is null;

alter table public.attachments
  add constraint attachments_state_check
    check (
      (upload_status = 'pending' and content_sha256 is not null and storage_object_id is null and deletion_started_at is null)
      or (upload_status = 'verifying' and content_sha256 is not null and storage_object_id is not null and deletion_started_at is null)
      or (upload_status = 'ready' and content_sha256 is not null and storage_object_id is not null and deletion_started_at is null)
      or (upload_status in ('deleting', 'discarding') and content_sha256 is not null and storage_object_id is not null and deletion_started_at is not null)
    ) not valid;
alter table public.attachments validate constraint attachments_state_check;
alter table public.attachments alter column content_sha256 set not null;

create index organization_invitations_org_email_active_idx
  on public.organization_invitations(organization_id, email, expires_at desc)
  where accepted_at is null;
create index attachments_cleanup_state_idx
  on public.attachments(upload_status, deletion_started_at, created_at)
  where upload_status <> 'ready';

drop trigger if exists invitations_rate_limit on public.organization_invitations;
drop trigger if exists comments_rate_limit on public.comments;
drop trigger if exists attachments_rate_limit on public.attachments;
drop function if exists public.enforce_insert_rate_limit();
drop function if exists public.create_organization(text, text);
drop function if exists public.accept_organization_invitation(text);
drop function if exists public.consume_rate_limit(text, text, integer, integer);

drop policy if exists members_insert_administrators on public.organization_members;
drop policy if exists members_update_roles_owners on public.organization_members;
drop policy if exists members_remove_administrators on public.organization_members;
drop policy if exists invitations_insert_administrators on public.organization_invitations;
drop policy if exists invitations_delete_administrators on public.organization_invitations;
drop policy if exists comments_insert_members on public.comments;
drop policy if exists attachments_insert_members on public.attachments;
drop policy if exists attachments_update_uploaders on public.attachments;
drop policy if exists attachments_delete_uploaders_or_admins on public.attachments;

revoke insert, update on public.organization_members from authenticated;
revoke insert, update, delete on public.organization_invitations from authenticated;
revoke insert on public.comments from authenticated;
revoke insert, update, delete on public.attachments from authenticated;

create or replace function private.proof_payload(parts text[])
returns text
language sql
immutable
set search_path = ''
as $$
  select coalesce(
    string_agg(octet_length(part.value)::text || ':' || part.value, '|' order by part.ordinality),
    ''
  )
  from unnest(parts) with ordinality as part(value, ordinality);
$$;

create or replace function private.verify_server_proof(
  proof_purpose text,
  proof_parts text[],
  supplied_proof text
)
returns boolean
language sql
stable
security definer
set search_path = private, extensions, pg_temp
set row_security = off
as $$
  select coalesce(bool_or(
    encode(
      extensions.hmac(
        proof_purpose || ':' || private.proof_payload(proof_parts),
        proof_secret,
        'sha256'
      ),
      'hex'
    ) = lower(supplied_proof)
  ), false)
  from private.workgrid_server_config
  where singleton
    and char_length(supplied_proof) = 64
    and supplied_proof ~ '^[a-fA-F0-9]{64}$';
$$;

create or replace function private.consume_actor_limit(
  actor text,
  operation_name text,
  scope_key text,
  request_limit integer,
  window_seconds integer
)
returns boolean
language plpgsql
security definer
set search_path = public, extensions, pg_temp
set row_security = off
as $$
declare
  hashed_key text;
  bucket timestamptz;
  resulting_count integer;
begin
  if actor is null or operation_name not in (
    'create_organization',
    'create_invitation',
    'preview_invitation',
    'accept_invitation',
    'create_comment',
    'upload_attachment',
    'export_data'
  ) then
    return false;
  end if;
  if request_limit not between 1 and 100 or window_seconds not between 60 and 86400 then
    return false;
  end if;

  hashed_key := encode(extensions.digest(actor || ':' || scope_key, 'sha256'), 'hex');
  bucket := to_timestamp(floor(extract(epoch from now()) / window_seconds) * window_seconds);

  insert into public.rate_limit_windows (key_hash, operation, window_started_at, request_count, expires_at)
  values (hashed_key, operation_name, bucket, 1, bucket + make_interval(secs => window_seconds * 2))
  on conflict (key_hash, operation, window_started_at)
  do update set request_count = public.rate_limit_windows.request_count + 1
  where public.rate_limit_windows.request_count < request_limit
  returning request_count into resulting_count;

  return resulting_count is not null and resulting_count <= request_limit;
end;
$$;

create or replace function public.enforce_active_actor_membership()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
set row_security = off
as $$
declare
  actor text := public.current_user_id();
  target_organization_id uuid;
  target_assignee_id text;
  actor_removed_at timestamptz;
  assignee_removed_at timestamptz;
begin
  if tg_table_name = 'organizations' then
    if tg_op = 'DELETE' then
      target_organization_id := old.id;
    else
      target_organization_id := new.id;
    end if;
  elsif tg_op = 'DELETE' then
    target_organization_id := old.organization_id;
  else
    target_organization_id := new.organization_id;
  end if;
  if actor is null then
    if tg_op = 'DELETE' then
      return old;
    end if;
    return new;
  end if;
  if tg_table_name = 'tasks' and tg_op <> 'DELETE' then
    target_assignee_id := new.assignee_id;
  end if;

  perform 1
  from public.organization_members
  where organization_id = target_organization_id
    and user_id = any(array_remove(array[actor, target_assignee_id], null))
  order by user_id
  for update;

  select removed_at into actor_removed_at
  from public.organization_members
  where organization_id = target_organization_id and user_id = actor;
  if not found or actor_removed_at is not null then
    raise exception 'Active organization membership required' using errcode = '42501';
  end if;
  if target_assignee_id is not null then
    select removed_at into assignee_removed_at
    from public.organization_members
    where organization_id = target_organization_id and user_id = target_assignee_id;
    if not found or assignee_removed_at is not null then
      raise exception 'Task assignee must be an active organization member' using errcode = '23514';
    end if;
  end if;
  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

create or replace function public.enforce_active_task_assignee()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
set row_security = off
as $$
declare
  assignee_removed_at timestamptz;
begin
  if new.assignee_id is null then
    return new;
  end if;

  select removed_at into assignee_removed_at
  from public.organization_members
  where organization_id = new.organization_id
    and user_id = new.assignee_id;

  if not found or assignee_removed_at is not null then
    raise exception 'Task assignee must be an active organization member' using errcode = '23514';
  end if;
  return new;
end;
$$;

create or replace function public.consume_upload_attempt(target_organization_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public, private, pg_temp
set row_security = off
as $$
declare
  actor text := public.current_user_id();
begin
  if actor is null or not public.is_organization_member(target_organization_id) then
    return false;
  end if;
  return private.consume_actor_limit(actor, 'upload_attachment', target_organization_id::text, 20, 3600);
end;
$$;

create or replace function public.consume_export_attempt(target_organization_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public, private, pg_temp
set row_security = off
as $$
declare
  actor text := public.current_user_id();
begin
  if actor is null or not public.has_organization_role(
    target_organization_id,
    array['admin', 'owner']::public.organization_role[]
  ) then
    return false;
  end if;
  return private.consume_actor_limit(actor, 'export_data', target_organization_id::text, 5, 3600);
end;
$$;

create or replace function public.create_organization(
  organization_name text,
  organization_slug text
)
returns jsonb
language plpgsql
security definer
set search_path = public, private, extensions, pg_temp
set row_security = off
as $$
declare
  actor text := public.current_user_id();
  organization_uuid uuid;
begin
  if actor is null then
    return jsonb_build_object('ok', false, 'code', 'UNAUTHENTICATED');
  end if;
  if not private.consume_actor_limit(actor, 'create_organization', 'global', 5, 3600) then
    return jsonb_build_object('ok', false, 'code', 'RATE_LIMITED');
  end if;
  if organization_name is null or organization_slug is null
    or char_length(btrim(organization_name)) not between 2 and 80
    or lower(organization_slug) !~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'
    or char_length(organization_slug) not between 2 and 50 then
    return jsonb_build_object('ok', false, 'code', 'VALIDATION');
  end if;

  begin
    insert into public.organizations (name, slug, created_by)
    values (btrim(organization_name), lower(organization_slug), actor)
    returning id into organization_uuid;

    insert into public.organization_members (organization_id, user_id, role)
    values (organization_uuid, actor, 'owner');
  exception when unique_violation then
    return jsonb_build_object('ok', false, 'code', 'CONFLICT');
  end;

  return jsonb_build_object('ok', true, 'organization_id', organization_uuid);
end;
$$;

create or replace function public.create_comment(
  target_organization_id uuid,
  target_task_id uuid,
  comment_body text
)
returns jsonb
language plpgsql
security definer
set search_path = public, private, pg_temp
set row_security = off
as $$
declare
  actor text := public.current_user_id();
  comment_uuid uuid;
begin
  if actor is null then
    return jsonb_build_object('ok', false, 'code', 'UNAUTHENTICATED');
  end if;
  perform 1 from public.organization_members
  where organization_id = target_organization_id
    and user_id = actor
    and removed_at is null
  for update;
  if not found then
    return jsonb_build_object('ok', false, 'code', 'NOT_FOUND');
  end if;
  if not private.consume_actor_limit(actor, 'create_comment', target_organization_id::text, 30, 60) then
    return jsonb_build_object('ok', false, 'code', 'RATE_LIMITED');
  end if;
  if comment_body is null or char_length(btrim(comment_body)) not between 1 and 5000 then
    return jsonb_build_object('ok', false, 'code', 'VALIDATION');
  end if;
  if not exists (
    select 1 from public.tasks
    where organization_id = target_organization_id and id = target_task_id
  ) then
    return jsonb_build_object('ok', false, 'code', 'NOT_FOUND');
  end if;

  insert into public.comments (organization_id, task_id, author_id, body)
  values (target_organization_id, target_task_id, actor, btrim(comment_body))
  returning id into comment_uuid;
  return jsonb_build_object('ok', true, 'comment_id', comment_uuid);
end;
$$;

create or replace function public.create_organization_invitation(
  target_organization_id uuid,
  invitation_email text,
  invitation_role text
)
returns jsonb
language plpgsql
security definer
set search_path = public, private, extensions, pg_temp
set row_security = off
as $$
declare
  actor text := public.current_user_id();
  actor_role public.organization_role;
  normalized_email text := lower(btrim(invitation_email));
  assigned_role public.organization_role;
  raw_token text;
  invitation_uuid uuid;
  expiry timestamptz := now() + interval '7 days';
begin
  select role into actor_role
  from public.organization_members
  where organization_id = target_organization_id
    and user_id = actor
    and removed_at is null
  for update;
  if actor is null or actor_role is null or actor_role not in ('admin', 'owner') then
    return jsonb_build_object('ok', false, 'code', 'FORBIDDEN');
  end if;
  if not private.consume_actor_limit(actor, 'create_invitation', target_organization_id::text, 10, 3600) then
    return jsonb_build_object('ok', false, 'code', 'RATE_LIMITED');
  end if;
  if invitation_email is null or invitation_role is null
    or normalized_email !~* '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'
    or char_length(normalized_email) not between 3 and 254
    or invitation_role not in ('member', 'admin') then
    return jsonb_build_object('ok', false, 'code', 'VALIDATION');
  end if;
  if actor_role = 'admin' and invitation_role <> 'member' then
    return jsonb_build_object('ok', false, 'code', 'FORBIDDEN');
  end if;
  assigned_role := invitation_role::public.organization_role;
  perform 1 from public.organizations
  where id = target_organization_id
  for update;
  if exists (
    select 1 from public.organization_invitations
    where organization_id = target_organization_id
      and email = normalized_email
      and accepted_at is null
      and expires_at > now()
  ) then
    return jsonb_build_object('ok', false, 'code', 'CONFLICT');
  end if;
  raw_token := rtrim(translate(encode(extensions.gen_random_bytes(32), 'base64'), '+/', '-_'), '=');

  begin
    insert into public.organization_invitations (
      organization_id, email, role, token_hash, created_by, expires_at
    ) values (
      target_organization_id,
      normalized_email,
      assigned_role,
      encode(extensions.digest(raw_token, 'sha256'), 'hex'),
      actor,
      expiry
    ) returning id into invitation_uuid;
  exception when unique_violation then
    return jsonb_build_object('ok', false, 'code', 'CONFLICT');
  end;

  return jsonb_build_object(
    'ok', true,
    'invitation_id', invitation_uuid,
    'token', raw_token,
    'expires_at', expiry
  );
end;
$$;

create or replace function public.preview_organization_invitation(
  invitation_token text,
  verified_email text,
  server_proof text
)
returns jsonb
language plpgsql
security definer
set search_path = public, private, extensions, pg_temp
set row_security = off
as $$
declare
  actor text := public.current_user_id();
  normalized_email text := lower(btrim(verified_email));
  token_digest text := encode(extensions.digest(invitation_token, 'sha256'), 'hex');
  invitation_row record;
begin
  if actor is null then
    return jsonb_build_object('ok', false, 'code', 'UNAUTHENTICATED');
  end if;
  if not private.consume_actor_limit(actor, 'preview_invitation', 'global', 60, 3600) then
    return jsonb_build_object('ok', false, 'code', 'RATE_LIMITED');
  end if;
  if not exists (select 1 from private.workgrid_server_config where singleton) then
    return jsonb_build_object('ok', false, 'code', 'CONFIGURATION');
  end if;
  if char_length(invitation_token) not between 32 and 200
    or char_length(normalized_email) not between 3 and 254
    or not private.verify_server_proof(
      'preview-invitation',
      array[actor, normalized_email, token_digest],
      server_proof
    ) then
    return jsonb_build_object('ok', false, 'code', 'INVALID_INVITATION');
  end if;

  select i.organization_id, o.name, o.slug, i.email::text, i.role, i.expires_at
  into invitation_row
  from public.organization_invitations i
  join public.organizations o on o.id = i.organization_id
  where i.token_hash = token_digest
    and lower(i.email::text) = normalized_email
    and i.accepted_at is null
    and i.expires_at > now();

  if invitation_row.organization_id is null then
    return jsonb_build_object('ok', false, 'code', 'INVALID_INVITATION');
  end if;
  return jsonb_build_object(
    'ok', true,
    'organization_id', invitation_row.organization_id,
    'organization_name', invitation_row.name,
    'organization_slug', invitation_row.slug,
    'email', invitation_row.email,
    'role', invitation_row.role,
    'expires_at', invitation_row.expires_at
  );
end;
$$;

create or replace function public.accept_organization_invitation(
  invitation_token text,
  verified_email text,
  server_proof text
)
returns jsonb
language plpgsql
security definer
set search_path = public, private, extensions, pg_temp
set row_security = off
as $$
declare
  actor text := public.current_user_id();
  normalized_email text := lower(btrim(verified_email));
  token_digest text := encode(extensions.digest(invitation_token, 'sha256'), 'hex');
  invitation_row public.organization_invitations%rowtype;
  organization_slug text;
begin
  if actor is null then
    return jsonb_build_object('ok', false, 'code', 'UNAUTHENTICATED');
  end if;
  if not private.consume_actor_limit(actor, 'accept_invitation', 'global', 20, 3600) then
    return jsonb_build_object('ok', false, 'code', 'RATE_LIMITED');
  end if;
  if not exists (select 1 from private.workgrid_server_config where singleton) then
    return jsonb_build_object('ok', false, 'code', 'CONFIGURATION');
  end if;
  if char_length(invitation_token) not between 32 and 200
    or char_length(normalized_email) not between 3 and 254
    or not private.verify_server_proof(
      'accept-invitation',
      array[actor, normalized_email, token_digest],
      server_proof
    ) then
    return jsonb_build_object('ok', false, 'code', 'INVALID_INVITATION');
  end if;

  select * into invitation_row
  from public.organization_invitations
  where token_hash = token_digest
    and lower(email::text) = normalized_email
    and accepted_at is null
    and expires_at > now()
  for update;

  if invitation_row.id is null then
    return jsonb_build_object('ok', false, 'code', 'INVALID_INVITATION');
  end if;

  insert into public.organization_members (organization_id, user_id, role)
  values (invitation_row.organization_id, actor, invitation_row.role)
  on conflict (organization_id, user_id) do update set
    role = case
      when public.organization_members.removed_at is null then public.organization_members.role
      else excluded.role
    end,
    removed_at = null;

  update public.organization_invitations
  set accepted_at = now(), accepted_by = actor
  where id = invitation_row.id;

  select slug::text into organization_slug
  from public.organizations
  where id = invitation_row.organization_id;
  return jsonb_build_object(
    'ok', true,
    'organization_id', invitation_row.organization_id,
    'organization_slug', organization_slug
  );
end;
$$;

create or replace function public.change_organization_member_role(
  target_organization_id uuid,
  target_membership_id uuid,
  target_role text
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
set row_security = off
as $$
declare
  actor text := public.current_user_id();
  actor_role public.organization_role;
  member_row public.organization_members%rowtype;
begin
  select role into actor_role from public.organization_members
  where organization_id = target_organization_id and user_id = actor and removed_at is null
  for update;
  if actor is null or actor_role is distinct from 'owner' then
    return jsonb_build_object('ok', false, 'code', 'FORBIDDEN');
  end if;
  if target_role is null or target_role not in ('member', 'admin') then
    return jsonb_build_object('ok', false, 'code', 'VALIDATION');
  end if;
  select * into member_row from public.organization_members
  where organization_id = target_organization_id and id = target_membership_id and removed_at is null
  for update;
  if member_row.id is null then
    return jsonb_build_object('ok', false, 'code', 'NOT_FOUND');
  end if;
  if member_row.role = 'owner' or member_row.user_id = actor then
    return jsonb_build_object('ok', false, 'code', 'FORBIDDEN');
  end if;
  update public.organization_members set role = target_role::public.organization_role
  where id = member_row.id and organization_id = target_organization_id;
  return jsonb_build_object('ok', true);
end;
$$;

create or replace function public.remove_organization_member(
  target_organization_id uuid,
  target_membership_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
set row_security = off
as $$
declare
  actor text := public.current_user_id();
  actor_role public.organization_role;
  member_row public.organization_members%rowtype;
  target_user_id text;
  unassigned_count integer;
begin
  select role into actor_role from public.organization_members
  where organization_id = target_organization_id and user_id = actor and removed_at is null;
  if actor is null or actor_role is null or actor_role not in ('admin', 'owner') then
    return jsonb_build_object('ok', false, 'code', 'FORBIDDEN');
  end if;
  select user_id into target_user_id from public.organization_members
  where organization_id = target_organization_id and id = target_membership_id;
  if target_user_id is null then
    return jsonb_build_object('ok', false, 'code', 'NOT_FOUND');
  end if;
  perform 1 from public.organization_members
  where organization_id = target_organization_id
    and user_id = any(array[actor, target_user_id])
  order by user_id
  for update;
  select role into actor_role from public.organization_members
  where organization_id = target_organization_id and user_id = actor and removed_at is null;
  if actor_role is null or actor_role not in ('admin', 'owner') then
    return jsonb_build_object('ok', false, 'code', 'FORBIDDEN');
  end if;
  select * into member_row from public.organization_members
  where organization_id = target_organization_id and id = target_membership_id and removed_at is null;
  if member_row.id is null then
    return jsonb_build_object('ok', false, 'code', 'NOT_FOUND');
  end if;
  if member_row.role = 'owner' or member_row.user_id = actor
    or (actor_role = 'admin' and member_row.role <> 'member') then
    return jsonb_build_object('ok', false, 'code', 'FORBIDDEN');
  end if;

  update public.tasks
  set assignee_id = null
  where organization_id = target_organization_id and assignee_id = member_row.user_id;
  get diagnostics unassigned_count = row_count;

  update public.organization_members
  set removed_at = now()
  where id = member_row.id and organization_id = target_organization_id and removed_at is null;
  if not found then
    return jsonb_build_object('ok', false, 'code', 'CONFLICT');
  end if;
  return jsonb_build_object('ok', true, 'unassigned_tasks', unassigned_count);
end;
$$;

create or replace function public.revoke_organization_invitation(
  target_organization_id uuid,
  target_invitation_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
set row_security = off
as $$
declare
  actor text := public.current_user_id();
  actor_role public.organization_role;
  invitation_role public.organization_role;
begin
  select role into actor_role from public.organization_members
  where organization_id = target_organization_id and user_id = actor and removed_at is null
  for update;
  if actor is null or actor_role is null or actor_role not in ('admin', 'owner') then
    return jsonb_build_object('ok', false, 'code', 'FORBIDDEN');
  end if;
  select role into invitation_role from public.organization_invitations
  where organization_id = target_organization_id and id = target_invitation_id and accepted_at is null
  for update;
  if invitation_role is null then
    return jsonb_build_object('ok', false, 'code', 'NOT_FOUND');
  end if;
  if actor_role = 'admin' and invitation_role <> 'member' then
    return jsonb_build_object('ok', false, 'code', 'FORBIDDEN');
  end if;
  delete from public.organization_invitations
  where organization_id = target_organization_id and id = target_invitation_id;
  if not found then
    return jsonb_build_object('ok', false, 'code', 'CONFLICT');
  end if;
  return jsonb_build_object('ok', true);
end;
$$;

create or replace function public.reserve_attachment(
  attachment_id uuid,
  target_organization_id uuid,
  target_project_id uuid,
  target_task_id uuid,
  object_path text,
  download_name text,
  declared_mime_type text,
  declared_size_bytes bigint,
  declared_content_sha256 text,
  server_proof text
)
returns jsonb
language plpgsql
security definer
set search_path = public, private, pg_temp
set row_security = off
as $$
declare
  actor text := public.current_user_id();
begin
  if actor is null then
    return jsonb_build_object('ok', false, 'code', 'NOT_FOUND');
  end if;
  perform 1 from public.organization_members
  where organization_id = target_organization_id
    and user_id = actor
    and removed_at is null
  for update;
  if not found then
    return jsonb_build_object('ok', false, 'code', 'NOT_FOUND');
  end if;
  if not exists (select 1 from private.workgrid_server_config where singleton) then
    return jsonb_build_object('ok', false, 'code', 'CONFIGURATION');
  end if;
  if not private.verify_server_proof(
    'reserve-attachment',
    array[
      actor,
      target_organization_id::text,
      target_project_id::text,
      coalesce(target_task_id::text, ''),
      attachment_id::text,
      object_path,
      download_name,
      lower(declared_mime_type),
      declared_size_bytes::text,
      lower(declared_content_sha256)
    ],
    server_proof
  ) then
    return jsonb_build_object('ok', false, 'code', 'FORBIDDEN');
  end if;
  if not exists (
    select 1 from public.projects
    where organization_id = target_organization_id and id = target_project_id
  ) or not exists (
    select 1 from public.tasks
    where organization_id = target_organization_id
      and project_id = target_project_id
      and id = target_task_id
  ) then
    return jsonb_build_object('ok', false, 'code', 'NOT_FOUND');
  end if;

  begin
    insert into public.attachments (
      id, organization_id, project_id, task_id, uploaded_by, storage_path,
      original_name, mime_type, size_bytes, content_sha256, upload_status
    ) values (
      attachment_id, target_organization_id, target_project_id, target_task_id,
      actor, object_path, download_name, lower(declared_mime_type),
      declared_size_bytes, lower(declared_content_sha256), 'pending'
    );
  exception
    when check_violation or foreign_key_violation or invalid_text_representation then
      return jsonb_build_object('ok', false, 'code', 'VALIDATION');
    when unique_violation then
      return jsonb_build_object('ok', false, 'code', 'CONFLICT');
  end;
  return jsonb_build_object('ok', true, 'attachment_id', attachment_id);
end;
$$;

create or replace function public.seal_attachment_upload(
  attachment_id uuid,
  target_storage_object_id uuid,
  server_proof text
)
returns jsonb
language plpgsql
security definer
set search_path = public, private, storage, pg_temp
set row_security = off
as $$
declare
  actor text := public.current_user_id();
  attachment_row public.attachments%rowtype;
  affected integer;
begin
  select * into attachment_row from public.attachments
  where id = attachment_id and uploaded_by = actor and upload_status = 'pending'
  for update;
  if actor is null or attachment_row.id is null then
    return jsonb_build_object('ok', false, 'code', 'NOT_FOUND');
  end if;
  perform 1 from public.organization_members
  where organization_id = attachment_row.organization_id
    and user_id = actor
    and removed_at is null
  for update;
  if not found then
    return jsonb_build_object('ok', false, 'code', 'NOT_FOUND');
  end if;
  if not exists (select 1 from private.workgrid_server_config where singleton) then
    return jsonb_build_object('ok', false, 'code', 'CONFIGURATION');
  end if;
  if target_storage_object_id is null
    or not private.verify_server_proof(
      'seal-attachment',
      array[
        actor,
        attachment_row.organization_id::text,
        attachment_row.project_id::text,
        coalesce(attachment_row.task_id::text, ''),
        attachment_row.id::text,
        attachment_row.storage_path,
        attachment_row.original_name,
        attachment_row.mime_type,
        attachment_row.size_bytes::text,
        attachment_row.content_sha256,
        target_storage_object_id::text
      ],
      server_proof
    ) then
    return jsonb_build_object('ok', false, 'code', 'FORBIDDEN');
  end if;
  if not exists (
    select 1 from storage.objects object
    where object.bucket_id = 'attachments'
      and object.name = attachment_row.storage_path
      and object.id = target_storage_object_id
      and coalesce(object.metadata ->> 'mimetype', object.metadata ->> 'contentType', '') = attachment_row.mime_type
      and coalesce(object.metadata ->> 'size', '') ~ '^[0-9]+$'
      and (object.metadata ->> 'size')::bigint = attachment_row.size_bytes
  ) then
    return jsonb_build_object('ok', false, 'code', 'STORAGE_MISMATCH');
  end if;

  update public.attachments
  set upload_status = 'verifying', storage_object_id = target_storage_object_id
  where id = attachment_row.id and upload_status = 'pending';
  get diagnostics affected = row_count;
  if affected <> 1 then
    return jsonb_build_object('ok', false, 'code', 'CONFLICT');
  end if;
  return jsonb_build_object('ok', true);
end;
$$;

create or replace function public.finalize_attachment(
  attachment_id uuid,
  target_storage_object_id uuid,
  declared_content_sha256 text,
  server_proof text
)
returns jsonb
language plpgsql
security definer
set search_path = public, private, storage, pg_temp
set row_security = off
as $$
declare
  actor text := public.current_user_id();
  attachment_row public.attachments%rowtype;
  affected integer;
begin
  select * into attachment_row from public.attachments
  where id = attachment_id and uploaded_by = actor and upload_status = 'verifying'
  for update;
  if actor is null or attachment_row.id is null then
    return jsonb_build_object('ok', false, 'code', 'NOT_FOUND');
  end if;
  perform 1 from public.organization_members
  where organization_id = attachment_row.organization_id
    and user_id = actor
    and removed_at is null
  for update;
  if not found then
    return jsonb_build_object('ok', false, 'code', 'NOT_FOUND');
  end if;
  if not exists (select 1 from private.workgrid_server_config where singleton) then
    return jsonb_build_object('ok', false, 'code', 'CONFIGURATION');
  end if;
  if target_storage_object_id is null
    or target_storage_object_id <> attachment_row.storage_object_id
    or declared_content_sha256 is null
    or lower(declared_content_sha256) <> attachment_row.content_sha256
    or not private.verify_server_proof(
      'finalize-attachment',
      array[
        actor,
        attachment_row.organization_id::text,
        attachment_row.project_id::text,
        coalesce(attachment_row.task_id::text, ''),
        attachment_row.id::text,
        attachment_row.storage_path,
        attachment_row.original_name,
        attachment_row.mime_type,
        attachment_row.size_bytes::text,
        attachment_row.content_sha256,
        attachment_row.storage_object_id::text
      ],
      server_proof
    ) then
    return jsonb_build_object('ok', false, 'code', 'FORBIDDEN');
  end if;
  if not exists (
    select 1 from storage.objects object
    where object.bucket_id = 'attachments'
      and object.name = attachment_row.storage_path
      and object.id = attachment_row.storage_object_id
      and coalesce(object.metadata ->> 'mimetype', object.metadata ->> 'contentType', '') = attachment_row.mime_type
      and coalesce(object.metadata ->> 'size', '') ~ '^[0-9]+$'
      and (object.metadata ->> 'size')::bigint = attachment_row.size_bytes
  ) then
    return jsonb_build_object('ok', false, 'code', 'STORAGE_MISMATCH');
  end if;

  update public.attachments
  set upload_status = 'ready'
  where id = attachment_row.id and upload_status = 'verifying';
  get diagnostics affected = row_count;
  if affected <> 1 then
    return jsonb_build_object('ok', false, 'code', 'CONFLICT');
  end if;
  return jsonb_build_object('ok', true);
end;
$$;

create or replace function public.cancel_attachment_reservation(
  attachment_id uuid,
  server_proof text
)
returns jsonb
language plpgsql
security definer
set search_path = public, private, storage, pg_temp
set row_security = off
as $$
declare
  actor text := public.current_user_id();
  attachment_row public.attachments%rowtype;
  observed_storage_object_id uuid;
  affected integer;
begin
  select * into attachment_row from public.attachments
  where id = attachment_id and uploaded_by = actor and upload_status in ('pending', 'verifying', 'discarding')
  for update;
  if actor is null or attachment_row.id is null then
    return jsonb_build_object('ok', false, 'code', 'NOT_FOUND');
  end if;
  if not exists (select 1 from private.workgrid_server_config where singleton) then
    return jsonb_build_object('ok', false, 'code', 'CONFIGURATION');
  end if;
  if not private.verify_server_proof(
    'cancel-attachment',
    array[actor, attachment_row.id::text, attachment_row.storage_path],
    server_proof
  ) then
    return jsonb_build_object('ok', false, 'code', 'FORBIDDEN');
  end if;
  perform 1 from public.organization_members
  where organization_id = attachment_row.organization_id
    and user_id = actor
    and removed_at is null
  for update;
  if not found then
    return jsonb_build_object('ok', false, 'code', 'NOT_FOUND');
  end if;
  select object.id into observed_storage_object_id
  from storage.objects object
  where object.bucket_id = 'attachments' and object.name = attachment_row.storage_path;
  if observed_storage_object_id is not null then
    update public.attachments
    set upload_status = 'discarding',
        storage_object_id = observed_storage_object_id,
        deletion_started_at = coalesce(deletion_started_at, now())
    where id = attachment_row.id and upload_status in ('pending', 'verifying', 'discarding');
    get diagnostics affected = row_count;
    if affected <> 1 then
      return jsonb_build_object('ok', false, 'code', 'CONFLICT');
    end if;
    return jsonb_build_object('ok', true, 'outcome', 'DISCARDING');
  end if;
  delete from public.attachments
  where id = attachment_row.id and upload_status in ('pending', 'verifying', 'discarding');
  get diagnostics affected = row_count;
  if affected <> 1 then
    return jsonb_build_object('ok', false, 'code', 'CONFLICT');
  end if;
  return jsonb_build_object('ok', true, 'outcome', 'DELETED');
end;
$$;

create or replace function public.begin_attachment_deletion(attachment_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
set row_security = off
as $$
declare
  actor text := public.current_user_id();
  attachment_row public.attachments%rowtype;
  actor_role public.organization_role;
  affected integer;
begin
  select * into attachment_row from public.attachments
  where id = attachment_id and upload_status = 'ready'
  for update;
  if actor is null or attachment_row.id is null then
    return jsonb_build_object('ok', false, 'code', 'NOT_FOUND');
  end if;
  select role into actor_role from public.organization_members
  where organization_id = attachment_row.organization_id and user_id = actor and removed_at is null
  for update;
  if actor_role is null then
    return jsonb_build_object('ok', false, 'code', 'NOT_FOUND');
  end if;
  if attachment_row.uploaded_by <> actor and actor_role = 'member' then
    return jsonb_build_object('ok', false, 'code', 'FORBIDDEN');
  end if;
  update public.attachments
  set upload_status = 'deleting', deletion_started_at = now()
  where id = attachment_row.id and upload_status = 'ready';
  get diagnostics affected = row_count;
  if affected <> 1 then
    return jsonb_build_object('ok', false, 'code', 'CONFLICT');
  end if;
  return jsonb_build_object(
    'ok', true,
    'storage_path', attachment_row.storage_path,
    'organization_id', attachment_row.organization_id,
    'task_id', attachment_row.task_id
  );
end;
$$;

create or replace function public.reconcile_attachment_deletion(attachment_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, storage, pg_temp
set row_security = off
as $$
declare
  actor text := public.current_user_id();
  attachment_row public.attachments%rowtype;
  actor_role public.organization_role;
begin
  select * into attachment_row from public.attachments
  where id = attachment_id and upload_status = 'deleting'
  for update;
  if actor is null or attachment_row.id is null then
    return jsonb_build_object('ok', false, 'code', 'NOT_FOUND');
  end if;
  select role into actor_role from public.organization_members
  where organization_id = attachment_row.organization_id and user_id = actor and removed_at is null
  for update;
  if actor_role is null then
    return jsonb_build_object('ok', false, 'code', 'NOT_FOUND');
  end if;
  if attachment_row.uploaded_by <> actor and actor_role = 'member' then
    return jsonb_build_object('ok', false, 'code', 'FORBIDDEN');
  end if;

  if exists (
    select 1 from storage.objects
    where bucket_id = 'attachments' and name = attachment_row.storage_path
  ) then
    update public.attachments
    set upload_status = 'ready', deletion_started_at = null
    where id = attachment_row.id and upload_status = 'deleting';
    if not found then
      return jsonb_build_object('ok', false, 'code', 'CONFLICT');
    end if;
    return jsonb_build_object('ok', true, 'outcome', 'RESTORED');
  end if;

  delete from public.attachments
  where id = attachment_row.id and upload_status = 'deleting';
  if not found then
    return jsonb_build_object('ok', false, 'code', 'CONFLICT');
  end if;
  return jsonb_build_object('ok', true, 'outcome', 'DELETED');
end;
$$;

create or replace function private.reconcile_stale_attachment_metadata()
returns table(
  marked_discarding integer,
  restored_ready integer,
  deleted_metadata integer,
  discarded_metadata integer,
  cancelled_reservations integer
)
language plpgsql
security definer
set search_path = public, storage, pg_temp
set row_security = off
as $$
begin
  update public.attachments attachment
  set upload_status = 'discarding',
      storage_object_id = object.id,
      deletion_started_at = now()
  from storage.objects object
  where attachment.upload_status in ('pending', 'verifying')
    and attachment.created_at < now() - interval '15 minutes'
    and object.bucket_id = 'attachments'
    and object.name = attachment.storage_path;
  get diagnostics marked_discarding = row_count;

  update public.attachments attachment
  set upload_status = 'ready', deletion_started_at = null
  where attachment.upload_status = 'deleting'
    and attachment.deletion_started_at < now() - interval '15 minutes'
    and exists (
      select 1 from storage.objects object
      where object.bucket_id = 'attachments' and object.name = attachment.storage_path
    );
  get diagnostics restored_ready = row_count;

  delete from public.attachments attachment
  where attachment.upload_status = 'deleting'
    and attachment.deletion_started_at < now() - interval '15 minutes'
    and not exists (
      select 1 from storage.objects object
      where object.bucket_id = 'attachments' and object.name = attachment.storage_path
    );
  get diagnostics deleted_metadata = row_count;

  delete from public.attachments attachment
  where attachment.upload_status = 'discarding'
    and attachment.deletion_started_at < now() - interval '15 minutes'
    and not exists (
      select 1 from storage.objects object
      where object.bucket_id = 'attachments' and object.name = attachment.storage_path
    );
  get diagnostics discarded_metadata = row_count;

  delete from public.attachments attachment
  where attachment.upload_status = 'pending'
    and attachment.created_at < now() - interval '1 hour'
    and not exists (
      select 1 from storage.objects object
      where object.bucket_id = 'attachments' and object.name = attachment.storage_path
    );
  get diagnostics cancelled_reservations = row_count;
  return next;
end;
$$;

drop trigger if exists attachments_audit on public.attachments;
create trigger attachments_ready_audit
after update on public.attachments
for each row
when (old.upload_status = 'verifying' and new.upload_status = 'ready')
execute function public.record_audit_event();
create trigger attachments_delete_audit
after delete on public.attachments
for each row
when (old.upload_status in ('ready', 'deleting'))
execute function public.record_audit_event();

create trigger organizations_require_active_actor
before update on public.organizations
for each row execute function public.enforce_active_actor_membership();
create trigger projects_require_active_actor
before insert or update or delete on public.projects
for each row execute function public.enforce_active_actor_membership();
create trigger tasks_require_active_actor
before insert or update or delete on public.tasks
for each row execute function public.enforce_active_actor_membership();
create trigger comments_require_active_actor
before insert or update or delete on public.comments
for each row execute function public.enforce_active_actor_membership();
create trigger attachments_require_active_actor
before insert or update or delete on public.attachments
for each row execute function public.enforce_active_actor_membership();

create or replace function public.can_read_storage_object(object_name text)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
set row_security = off
as $$
  select exists (
    select 1 from public.attachments
    where storage_path = object_name
      and public.is_organization_member(organization_id)
      and (
        upload_status in ('ready', 'deleting')
        or (upload_status = 'verifying' and uploaded_by = public.current_user_id())
      )
  );
$$;

create or replace function public.can_delete_storage_object(object_name text)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
set row_security = off
as $$
  select exists (
    select 1 from public.attachments
    where storage_path = object_name
      and public.is_organization_member(organization_id)
      and (
        (upload_status in ('pending', 'discarding') and uploaded_by = public.current_user_id())
        or (
          upload_status = 'deleting'
          and (
            uploaded_by = public.current_user_id()
            or public.has_organization_role(organization_id, array['admin', 'owner']::public.organization_role[])
          )
        )
      )
  );
$$;

revoke all on function private.proof_payload(text[]) from public, anon, authenticated;
revoke all on function private.verify_server_proof(text, text[], text) from public, anon, authenticated;
revoke all on function private.consume_actor_limit(text, text, text, integer, integer) from public, anon, authenticated;
revoke all on function private.reconcile_stale_attachment_metadata() from public, anon, authenticated;
revoke all on function public.enforce_active_actor_membership() from public;
revoke all on function public.consume_upload_attempt(uuid) from public;
revoke all on function public.consume_export_attempt(uuid) from public;
revoke all on function public.create_organization(text, text) from public;
revoke all on function public.create_comment(uuid, uuid, text) from public;
revoke all on function public.create_organization_invitation(uuid, text, text) from public;
revoke all on function public.preview_organization_invitation(text, text, text) from public;
revoke all on function public.accept_organization_invitation(text, text, text) from public;
revoke all on function public.change_organization_member_role(uuid, uuid, text) from public;
revoke all on function public.remove_organization_member(uuid, uuid) from public;
revoke all on function public.revoke_organization_invitation(uuid, uuid) from public;
revoke all on function public.reserve_attachment(uuid, uuid, uuid, uuid, text, text, text, bigint, text, text) from public;
revoke all on function public.seal_attachment_upload(uuid, uuid, text) from public;
revoke all on function public.finalize_attachment(uuid, uuid, text, text) from public;
revoke all on function public.cancel_attachment_reservation(uuid, text) from public;
revoke all on function public.begin_attachment_deletion(uuid) from public;
revoke all on function public.reconcile_attachment_deletion(uuid) from public;

grant execute on function public.consume_upload_attempt(uuid) to authenticated;
grant execute on function public.consume_export_attempt(uuid) to authenticated;
grant execute on function public.create_organization(text, text) to authenticated;
grant execute on function public.create_comment(uuid, uuid, text) to authenticated;
grant execute on function public.create_organization_invitation(uuid, text, text) to authenticated;
grant execute on function public.preview_organization_invitation(text, text, text) to authenticated;
grant execute on function public.accept_organization_invitation(text, text, text) to authenticated;
grant execute on function public.change_organization_member_role(uuid, uuid, text) to authenticated;
grant execute on function public.remove_organization_member(uuid, uuid) to authenticated;
grant execute on function public.revoke_organization_invitation(uuid, uuid) to authenticated;
grant execute on function public.reserve_attachment(uuid, uuid, uuid, uuid, text, text, text, bigint, text, text) to authenticated;
grant execute on function public.seal_attachment_upload(uuid, uuid, text) to authenticated;
grant execute on function public.finalize_attachment(uuid, uuid, text, text) to authenticated;
grant execute on function public.cancel_attachment_reservation(uuid, text) to authenticated;
grant execute on function public.begin_attachment_deletion(uuid) to authenticated;
grant execute on function public.reconcile_attachment_deletion(uuid) to authenticated;

comment on table private.workgrid_server_config is
  'Provision exactly one WORKGRID_SERVER_PROOF_SECRET value out of band. Never expose this schema through the Data API.';
comment on column public.attachments.content_sha256 is
  'SHA-256 computed by the authenticated application server after content inspection and bound to a server proof.';
comment on column public.attachments.deletion_started_at is
  'Marks a reversible ready-file deletion or an untrusted upload discard. A trusted cleanup job reconciles each state against storage.objects.';

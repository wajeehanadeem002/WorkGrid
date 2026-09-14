create extension if not exists pgcrypto with schema extensions;
create extension if not exists citext with schema extensions;
create extension if not exists pg_trgm with schema extensions;

create type public.organization_role as enum ('member', 'admin', 'owner');
create type public.project_status as enum ('PLANNED', 'ACTIVE', 'ON_HOLD', 'COMPLETED', 'ARCHIVED');
create type public.task_status as enum ('TODO', 'IN_PROGRESS', 'IN_REVIEW', 'DONE');
create type public.task_priority as enum ('LOW', 'MEDIUM', 'HIGH', 'URGENT');
create type public.attachment_status as enum ('pending', 'ready');

create table public.organizations (
  id uuid primary key default extensions.gen_random_uuid(),
  name text not null check (char_length(btrim(name)) between 2 and 80),
  slug extensions.citext not null unique check (slug::text ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$' and char_length(slug::text) between 2 and 50),
  created_by text not null check (char_length(created_by) between 5 and 255),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.organization_members (
  id uuid primary key default extensions.gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete restrict,
  user_id text not null check (char_length(user_id) between 5 and 255),
  role public.organization_role not null default 'member',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  removed_at timestamptz,
  unique (organization_id, user_id)
);

create table public.organization_invitations (
  id uuid primary key default extensions.gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete restrict,
  email extensions.citext,
  role public.organization_role not null default 'member' check (role <> 'owner'),
  token_hash text not null unique check (token_hash ~ '^[a-f0-9]{64}$'),
  created_by text not null,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null check (expires_at > created_at),
  accepted_at timestamptz,
  accepted_by text,
  constraint organization_invitations_creator_fk
    foreign key (organization_id, created_by)
    references public.organization_members(organization_id, user_id)
    on delete restrict,
  constraint organization_invitations_acceptance_check
    check ((accepted_at is null and accepted_by is null) or (accepted_at is not null and accepted_by is not null))
);

create table public.projects (
  id uuid primary key default extensions.gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete restrict,
  name text not null check (char_length(btrim(name)) between 2 and 100),
  key extensions.citext not null check (key::text ~ '^[A-Z][A-Z0-9]{1,9}$'),
  description text not null default '' check (char_length(description) <= 5000),
  status public.project_status not null default 'PLANNED',
  created_by text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, id),
  unique (organization_id, key),
  constraint projects_creator_fk
    foreign key (organization_id, created_by)
    references public.organization_members(organization_id, user_id)
    on delete restrict
);

create table public.tasks (
  id uuid primary key default extensions.gen_random_uuid(),
  organization_id uuid not null,
  project_id uuid not null,
  title text not null check (char_length(btrim(title)) between 2 and 200),
  description text not null default '' check (char_length(description) <= 20000),
  status public.task_status not null default 'TODO',
  priority public.task_priority not null default 'MEDIUM',
  assignee_id text,
  reporter_id text not null,
  due_date date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, id),
  unique (organization_id, project_id, id),
  constraint tasks_project_fk
    foreign key (organization_id, project_id)
    references public.projects(organization_id, id)
    on delete restrict,
  constraint tasks_assignee_fk
    foreign key (organization_id, assignee_id)
    references public.organization_members(organization_id, user_id)
    on delete restrict,
  constraint tasks_reporter_fk
    foreign key (organization_id, reporter_id)
    references public.organization_members(organization_id, user_id)
    on delete restrict
);

create table public.comments (
  id uuid primary key default extensions.gen_random_uuid(),
  organization_id uuid not null,
  task_id uuid not null,
  author_id text not null,
  body text not null check (char_length(btrim(body)) between 1 and 5000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, id),
  constraint comments_task_fk
    foreign key (organization_id, task_id)
    references public.tasks(organization_id, id)
    on delete restrict,
  constraint comments_author_fk
    foreign key (organization_id, author_id)
    references public.organization_members(organization_id, user_id)
    on delete restrict
);

create table public.attachments (
  id uuid primary key default extensions.gen_random_uuid(),
  organization_id uuid not null,
  project_id uuid not null,
  task_id uuid,
  uploaded_by text not null,
  storage_path text not null unique check (char_length(storage_path) between 10 and 600),
  original_name text not null check (char_length(original_name) between 1 and 255),
  mime_type text not null check (mime_type in ('application/pdf', 'text/plain', 'text/csv', 'image/png', 'image/jpeg', 'image/gif', 'image/webp')),
  size_bytes bigint not null check (size_bytes between 1 and 4194304),
  upload_status public.attachment_status not null default 'pending',
  created_at timestamptz not null default now(),
  unique (organization_id, id),
  constraint attachments_extension_matches_mime_check check (
    (mime_type = 'application/pdf' and lower(original_name) ~ '\.pdf$')
    or (mime_type = 'text/plain' and lower(original_name) ~ '\.txt$')
    or (mime_type = 'text/csv' and lower(original_name) ~ '\.csv$')
    or (mime_type = 'image/png' and lower(original_name) ~ '\.png$')
    or (mime_type = 'image/jpeg' and lower(original_name) ~ '\.(jpg|jpeg)$')
    or (mime_type = 'image/gif' and lower(original_name) ~ '\.gif$')
    or (mime_type = 'image/webp' and lower(original_name) ~ '\.webp$')
  ),
  constraint attachments_project_fk
    foreign key (organization_id, project_id)
    references public.projects(organization_id, id)
    on delete restrict,
  constraint attachments_task_fk
    foreign key (organization_id, project_id, task_id)
    references public.tasks(organization_id, project_id, id)
    on delete restrict,
  constraint attachments_storage_prefix_check
    check (
      split_part(storage_path, '/', 1) = organization_id::text
      and split_part(storage_path, '/', 2) = project_id::text
      and split_part(storage_path, '/', 3) = coalesce(task_id::text, 'project')
      and split_part(storage_path, '/', 4) = id::text
      and split_part(storage_path, '/', 5) <> ''
    )
);

create table public.audit_logs (
  id uuid primary key default extensions.gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete restrict,
  actor_id text,
  action text not null check (action ~ '^[a-z]+(?:\.[a-z_]+)+$'),
  entity_type text not null check (entity_type in ('organization', 'member', 'invitation', 'project', 'task', 'comment', 'attachment')),
  entity_id uuid,
  metadata jsonb not null default '{}'::jsonb check (jsonb_typeof(metadata) = 'object'),
  created_at timestamptz not null default now()
);

create table public.rate_limit_windows (
  key_hash text not null check (key_hash ~ '^[a-f0-9]{64}$'),
  operation text not null check (operation ~ '^[a-z_]{2,50}$'),
  window_started_at timestamptz not null,
  request_count integer not null check (request_count > 0),
  expires_at timestamptz not null,
  primary key (key_hash, operation, window_started_at)
);

create index organization_members_user_idx on public.organization_members(user_id, organization_id);
create index invitations_org_active_idx on public.organization_invitations(organization_id, expires_at) where accepted_at is null;
create index projects_org_status_updated_idx on public.projects(organization_id, status, updated_at desc, id);
create index projects_name_trgm_idx on public.projects using gin (name extensions.gin_trgm_ops);
create index tasks_org_project_updated_idx on public.tasks(organization_id, project_id, updated_at desc, id);
create index tasks_org_status_priority_idx on public.tasks(organization_id, status, priority, updated_at desc);
create index tasks_org_assignee_idx on public.tasks(organization_id, assignee_id, status) where assignee_id is not null;
create index tasks_org_due_idx on public.tasks(organization_id, due_date, status) where due_date is not null;
create index tasks_title_trgm_idx on public.tasks using gin (title extensions.gin_trgm_ops);
create index comments_task_created_idx on public.comments(organization_id, task_id, created_at, id);
create index attachments_task_created_idx on public.attachments(organization_id, task_id, created_at desc) where task_id is not null;
create index audit_logs_org_created_idx on public.audit_logs(organization_id, created_at desc, id);
create index audit_logs_org_entity_idx on public.audit_logs(organization_id, entity_type, entity_id, created_at desc);
create index rate_limit_expiry_idx on public.rate_limit_windows(expires_at);

create or replace function public.current_user_id()
returns text
language sql
stable
set search_path = ''
as $$
  select nullif(auth.jwt() ->> 'sub', '');
$$;

create or replace function public.is_organization_member(target_organization_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
set row_security = off
as $$
  select exists (
    select 1
    from public.organization_members
    where organization_id = target_organization_id
      and user_id = public.current_user_id()
      and removed_at is null
  );
$$;

create or replace function public.organization_role_for(target_organization_id uuid)
returns public.organization_role
language sql
stable
security definer
set search_path = public, pg_temp
set row_security = off
as $$
  select role
  from public.organization_members
  where organization_id = target_organization_id
    and user_id = public.current_user_id()
    and removed_at is null;
$$;

create or replace function public.has_organization_role(
  target_organization_id uuid,
  allowed_roles public.organization_role[]
)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
set row_security = off
as $$
  select coalesce(public.organization_role_for(target_organization_id) = any(allowed_roles), false);
$$;

create or replace function public.safe_uuid(value text)
returns uuid
language plpgsql
immutable
set search_path = ''
as $$
begin
  return value::uuid;
exception when invalid_text_representation then
  return null;
end;
$$;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger organizations_set_updated_at before update on public.organizations
for each row execute function public.set_updated_at();
create trigger organization_members_set_updated_at before update on public.organization_members
for each row execute function public.set_updated_at();
create trigger projects_set_updated_at before update on public.projects
for each row execute function public.set_updated_at();
create trigger tasks_set_updated_at before update on public.tasks
for each row execute function public.set_updated_at();
create trigger comments_set_updated_at before update on public.comments
for each row execute function public.set_updated_at();

create or replace function public.prevent_identity_reassignment()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
declare
  field_name text;
  old_row jsonb := to_jsonb(old);
  new_row jsonb := to_jsonb(new);
begin
  foreach field_name in array tg_argv loop
    if old_row -> field_name is distinct from new_row -> field_name then
      raise exception '% cannot be changed', field_name using errcode = '23514';
    end if;
  end loop;
  return new;
end;
$$;

create trigger organizations_protect_identity before update on public.organizations
for each row execute function public.prevent_identity_reassignment('id', 'slug', 'created_by', 'created_at');
create trigger members_protect_identity before update on public.organization_members
for each row execute function public.prevent_identity_reassignment('id', 'organization_id', 'user_id', 'created_at');
create trigger invitations_protect_identity before update on public.organization_invitations
for each row execute function public.prevent_identity_reassignment('id', 'organization_id', 'token_hash', 'created_by', 'role', 'created_at');
create trigger projects_protect_identity before update on public.projects
for each row execute function public.prevent_identity_reassignment('id', 'organization_id', 'created_by', 'created_at');
create trigger tasks_protect_identity before update on public.tasks
for each row execute function public.prevent_identity_reassignment('id', 'organization_id', 'project_id', 'reporter_id', 'created_at');
create trigger comments_protect_identity before update on public.comments
for each row execute function public.prevent_identity_reassignment('id', 'organization_id', 'task_id', 'author_id', 'created_at');
create trigger attachments_protect_identity before update on public.attachments
for each row execute function public.prevent_identity_reassignment('id', 'organization_id', 'project_id', 'task_id', 'uploaded_by', 'storage_path', 'original_name', 'mime_type', 'size_bytes', 'created_at');

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

  if found and assignee_removed_at is not null then
    raise exception 'Task assignee must be an active organization member' using errcode = '23514';
  end if;
  return new;
end;
$$;

create trigger tasks_require_active_assignee before insert or update of organization_id, assignee_id on public.tasks
for each row execute function public.enforce_active_task_assignee();

create or replace function public.prevent_audit_mutation()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  raise exception 'Audit logs are append-only';
end;
$$;

create trigger audit_logs_append_only before update or delete on public.audit_logs
for each row execute function public.prevent_audit_mutation();

create or replace function public.record_audit_event()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
set row_security = off
as $$
declare
  row_data jsonb := case when tg_op = 'DELETE' then to_jsonb(old) else to_jsonb(new) end;
  previous_data jsonb := case when tg_op = 'UPDATE' then to_jsonb(old) else '{}'::jsonb end;
  organization_value uuid := (row_data ->> 'organization_id')::uuid;
  entity_value uuid := nullif(row_data ->> 'id', '')::uuid;
  action_value text;
  metadata_value jsonb := '{}'::jsonb;
begin
  if tg_table_name = 'organizations' then
    organization_value := (row_data ->> 'id')::uuid;
    action_value := case tg_op when 'INSERT' then 'organization.created' when 'UPDATE' then 'organization.updated' else 'organization.deleted' end;
    metadata_value := jsonb_build_object('name', row_data ->> 'name');
  elsif tg_table_name = 'organization_members' then
    action_value := case
      when tg_op = 'INSERT' then 'member.added'
      when tg_op = 'DELETE' then 'member.removed'
      when previous_data ->> 'removed_at' is null and row_data ->> 'removed_at' is not null then 'member.removed'
      when previous_data ->> 'removed_at' is not null and row_data ->> 'removed_at' is null then 'member.added'
      when previous_data ->> 'role' is distinct from row_data ->> 'role' then 'member.role_changed'
      else 'member.updated'
    end;
    metadata_value := jsonb_strip_nulls(jsonb_build_object('user_id', row_data ->> 'user_id', 'role', row_data ->> 'role', 'previous_role', previous_data ->> 'role'));
  elsif tg_table_name = 'organization_invitations' then
    action_value := case when tg_op = 'INSERT' then 'invitation.created' when tg_op = 'DELETE' then 'invitation.revoked' else 'invitation.accepted' end;
    metadata_value := jsonb_build_object('role', row_data ->> 'role');
  elsif tg_table_name = 'projects' then
    action_value := case tg_op when 'INSERT' then 'project.created' when 'UPDATE' then 'project.updated' else 'project.deleted' end;
    metadata_value := jsonb_build_object('name', row_data ->> 'name', 'key', row_data ->> 'key', 'status', row_data ->> 'status');
  elsif tg_table_name = 'tasks' then
    if tg_op = 'UPDATE' then
      if previous_data ->> 'status' is distinct from row_data ->> 'status' then
        insert into public.audit_logs (organization_id, actor_id, action, entity_type, entity_id, metadata)
        values (
          organization_value,
          public.current_user_id(),
          'task.status_changed',
          'task',
          entity_value,
          jsonb_build_object('previous_status', previous_data ->> 'status', 'status', row_data ->> 'status')
        );
      end if;
      if previous_data ->> 'assignee_id' is distinct from row_data ->> 'assignee_id' then
        insert into public.audit_logs (organization_id, actor_id, action, entity_type, entity_id, metadata)
        values (
          organization_value,
          public.current_user_id(),
          'task.assigned',
          'task',
          entity_value,
          jsonb_strip_nulls(jsonb_build_object('previous_assignee_id', previous_data ->> 'assignee_id', 'assignee_id', row_data ->> 'assignee_id'))
        );
      end if;
      if (previous_data - 'updated_at' - 'status' - 'assignee_id') is distinct from (row_data - 'updated_at' - 'status' - 'assignee_id') then
        insert into public.audit_logs (organization_id, actor_id, action, entity_type, entity_id, metadata)
        values (
          organization_value,
          public.current_user_id(),
          'task.updated',
          'task',
          entity_value,
          jsonb_strip_nulls(jsonb_build_object('title', row_data ->> 'title', 'priority', row_data ->> 'priority', 'due_date', row_data ->> 'due_date'))
        );
      end if;
      return new;
    end if;
    action_value := case when tg_op = 'INSERT' then 'task.created' else 'task.deleted' end;
    metadata_value := jsonb_strip_nulls(jsonb_build_object('title', row_data ->> 'title', 'status', row_data ->> 'status', 'priority', row_data ->> 'priority', 'assignee_id', row_data ->> 'assignee_id'));
  elsif tg_table_name = 'comments' then
    action_value := case when tg_op = 'INSERT' then 'comment.added' when tg_op = 'DELETE' then 'comment.deleted' else 'comment.updated' end;
    metadata_value := jsonb_build_object('task_id', row_data ->> 'task_id');
  elsif tg_table_name = 'attachments' then
    if tg_op = 'INSERT' then
      return new;
    end if;
    action_value := case when tg_op = 'DELETE' then 'attachment.deleted' else 'attachment.uploaded' end;
    metadata_value := jsonb_build_object('task_id', row_data ->> 'task_id', 'mime_type', row_data ->> 'mime_type', 'size_bytes', row_data ->> 'size_bytes');
  else
    if tg_op = 'DELETE' then
      return old;
    end if;
    return new;
  end if;

  insert into public.audit_logs (organization_id, actor_id, action, entity_type, entity_id, metadata)
  values (
    organization_value,
    public.current_user_id(),
    action_value,
    case tg_table_name
      when 'organizations' then 'organization'
      when 'organization_members' then 'member'
      when 'organization_invitations' then 'invitation'
      when 'projects' then 'project'
      when 'tasks' then 'task'
      when 'comments' then 'comment'
      when 'attachments' then 'attachment'
    end,
    entity_value,
    metadata_value
  );
  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

create trigger organizations_audit after insert or update on public.organizations
for each row execute function public.record_audit_event();
create trigger members_audit after insert or update or delete on public.organization_members
for each row execute function public.record_audit_event();
create trigger invitations_audit after insert or update or delete on public.organization_invitations
for each row execute function public.record_audit_event();
create trigger projects_audit after insert or update or delete on public.projects
for each row execute function public.record_audit_event();
create trigger tasks_audit after insert or update or delete on public.tasks
for each row execute function public.record_audit_event();
create trigger comments_audit after insert or update or delete on public.comments
for each row execute function public.record_audit_event();
create trigger attachments_audit after update or delete on public.attachments
for each row execute function public.record_audit_event();

alter table public.organizations enable row level security;
alter table public.organization_members enable row level security;
alter table public.organization_invitations enable row level security;
alter table public.projects enable row level security;
alter table public.tasks enable row level security;
alter table public.comments enable row level security;
alter table public.attachments enable row level security;
alter table public.audit_logs enable row level security;
alter table public.rate_limit_windows enable row level security;

create policy organizations_select_members on public.organizations for select to authenticated
using (public.is_organization_member(id));
create policy organizations_update_owners on public.organizations for update to authenticated
using (public.has_organization_role(id, array['owner']::public.organization_role[]))
with check (public.has_organization_role(id, array['owner']::public.organization_role[]));

create policy members_select_members on public.organization_members for select to authenticated
using (removed_at is null and public.is_organization_member(organization_id));
create policy members_insert_administrators on public.organization_members for insert to authenticated
with check (
  removed_at is null
  and
  role <> 'owner'
  and (
    public.has_organization_role(organization_id, array['owner']::public.organization_role[])
    or (public.has_organization_role(organization_id, array['admin']::public.organization_role[]) and role = 'member')
  )
);
create policy members_update_roles_owners on public.organization_members for update to authenticated
using (removed_at is null and public.has_organization_role(organization_id, array['owner']::public.organization_role[]) and role <> 'owner')
with check (removed_at is null and public.has_organization_role(organization_id, array['owner']::public.organization_role[]) and role <> 'owner');
create policy members_remove_administrators on public.organization_members for update to authenticated
using (
  removed_at is null
  and
  role <> 'owner'
  and user_id <> public.current_user_id()
  and (
    public.has_organization_role(organization_id, array['owner']::public.organization_role[])
    or (public.has_organization_role(organization_id, array['admin']::public.organization_role[]) and role = 'member')
  )
)
with check (
  removed_at is not null
  and role <> 'owner'
  and user_id <> public.current_user_id()
  and (
    public.has_organization_role(organization_id, array['owner']::public.organization_role[])
    or (public.has_organization_role(organization_id, array['admin']::public.organization_role[]) and role = 'member')
  )
);

create policy invitations_select_administrators on public.organization_invitations for select to authenticated
using (public.has_organization_role(organization_id, array['admin', 'owner']::public.organization_role[]));
create policy invitations_insert_administrators on public.organization_invitations for insert to authenticated
with check (
  created_by = public.current_user_id()
  and (
    public.has_organization_role(organization_id, array['owner']::public.organization_role[])
    or (public.has_organization_role(organization_id, array['admin']::public.organization_role[]) and role = 'member')
  )
);
create policy invitations_delete_administrators on public.organization_invitations for delete to authenticated
using (
  public.has_organization_role(organization_id, array['owner']::public.organization_role[])
  or (public.has_organization_role(organization_id, array['admin']::public.organization_role[]) and role = 'member')
);

create policy projects_select_members on public.projects for select to authenticated
using (public.is_organization_member(organization_id));
create policy projects_insert_administrators on public.projects for insert to authenticated
with check (created_by = public.current_user_id() and public.has_organization_role(organization_id, array['admin', 'owner']::public.organization_role[]));
create policy projects_update_administrators on public.projects for update to authenticated
using (public.has_organization_role(organization_id, array['admin', 'owner']::public.organization_role[]))
with check (public.has_organization_role(organization_id, array['admin', 'owner']::public.organization_role[]));
create policy projects_delete_administrators on public.projects for delete to authenticated
using (public.has_organization_role(organization_id, array['admin', 'owner']::public.organization_role[]));

create policy tasks_select_members on public.tasks for select to authenticated
using (public.is_organization_member(organization_id));
create policy tasks_insert_members on public.tasks for insert to authenticated
with check (reporter_id = public.current_user_id() and public.is_organization_member(organization_id));
create policy tasks_update_members on public.tasks for update to authenticated
using (public.is_organization_member(organization_id))
with check (public.is_organization_member(organization_id));
create policy tasks_delete_administrators on public.tasks for delete to authenticated
using (public.has_organization_role(organization_id, array['admin', 'owner']::public.organization_role[]));

create policy comments_select_members on public.comments for select to authenticated
using (public.is_organization_member(organization_id));
create policy comments_insert_members on public.comments for insert to authenticated
with check (author_id = public.current_user_id() and public.is_organization_member(organization_id));
create policy comments_update_authors on public.comments for update to authenticated
using (author_id = public.current_user_id())
with check (author_id = public.current_user_id() and public.is_organization_member(organization_id));
create policy comments_delete_authors_or_admins on public.comments for delete to authenticated
using (
  public.is_organization_member(organization_id)
  and (
    author_id = public.current_user_id()
    or public.has_organization_role(organization_id, array['admin', 'owner']::public.organization_role[])
  )
);

create policy attachments_select_members on public.attachments for select to authenticated
using (upload_status = 'ready' and public.is_organization_member(organization_id));
create policy attachments_insert_members on public.attachments for insert to authenticated
with check (uploaded_by = public.current_user_id() and upload_status = 'pending' and public.is_organization_member(organization_id));
create policy attachments_update_uploaders on public.attachments for update to authenticated
using (uploaded_by = public.current_user_id() and upload_status = 'pending')
with check (uploaded_by = public.current_user_id() and upload_status = 'ready' and public.is_organization_member(organization_id));
create policy attachments_delete_uploaders_or_admins on public.attachments for delete to authenticated
using (
  public.is_organization_member(organization_id)
  and (
    uploaded_by = public.current_user_id()
    or public.has_organization_role(organization_id, array['admin', 'owner']::public.organization_role[])
  )
);

create policy audit_logs_select_administrators on public.audit_logs for select to authenticated
using (public.has_organization_role(organization_id, array['admin', 'owner']::public.organization_role[]));

grant usage on schema public to anon, authenticated;
grant usage on type public.organization_role, public.project_status, public.task_status, public.task_priority, public.attachment_status to authenticated;
grant select, update on public.organizations to authenticated;
grant select, insert, update on public.organization_members to authenticated;
grant select, insert, delete on public.organization_invitations to authenticated;
grant select, insert, update, delete on public.projects, public.tasks, public.comments, public.attachments to authenticated;
grant select on public.audit_logs to authenticated;

create or replace function public.consume_rate_limit(
  rate_key text,
  rate_operation text,
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
  actor text := public.current_user_id();
  hashed_key text;
  bucket timestamptz;
  resulting_count integer;
begin
  if actor is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;
  if request_limit not between 1 and 1000 or window_seconds not between 1 and 86400 or rate_operation !~ '^[a-z_]{2,50}$' then
    raise exception 'Invalid rate limit configuration' using errcode = '22023';
  end if;

  hashed_key := encode(extensions.digest(actor || ':' || rate_key, 'sha256'), 'hex');
  bucket := to_timestamp(floor(extract(epoch from now()) / window_seconds) * window_seconds);

  insert into public.rate_limit_windows (key_hash, operation, window_started_at, request_count, expires_at)
  values (hashed_key, rate_operation, bucket, 1, bucket + make_interval(secs => window_seconds * 2))
  on conflict (key_hash, operation, window_started_at)
  do update set request_count = public.rate_limit_windows.request_count + 1
  where public.rate_limit_windows.request_count < request_limit
  returning request_count into resulting_count;

  return resulting_count is not null and resulting_count <= request_limit;
end;
$$;

create or replace function public.create_organization(organization_name text, organization_slug text)
returns uuid
language plpgsql
security definer
set search_path = public, extensions, pg_temp
set row_security = off
as $$
declare
  actor text := public.current_user_id();
  organization_uuid uuid;
begin
  if actor is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;
  if char_length(btrim(organization_name)) not between 2 and 80 then
    raise exception 'Invalid organization name' using errcode = '22023';
  end if;
  if lower(organization_slug) !~ '^[a-z0-9]+(?:-[a-z0-9]+)*$' or char_length(organization_slug) not between 2 and 50 then
    raise exception 'Invalid organization slug' using errcode = '22023';
  end if;
  if not public.consume_rate_limit('global', 'create_organization', 5, 3600) then
    raise exception 'Rate limit exceeded' using errcode = 'WG429';
  end if;

  insert into public.organizations (name, slug, created_by)
  values (btrim(organization_name), lower(organization_slug), actor)
  returning id into organization_uuid;

  insert into public.organization_members (organization_id, user_id, role)
  values (organization_uuid, actor, 'owner');

  return organization_uuid;
end;
$$;

create or replace function public.accept_organization_invitation(invitation_token text)
returns uuid
language plpgsql
security definer
set search_path = public, extensions, pg_temp
set row_security = off
as $$
declare
  actor text := public.current_user_id();
  invitation_row public.organization_invitations%rowtype;
begin
  if actor is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;
  if char_length(invitation_token) < 32 then
    raise exception 'Invitation is invalid' using errcode = '22023';
  end if;
  if not public.consume_rate_limit('global', 'accept_invitation', 20, 3600) then
    raise exception 'Rate limit exceeded' using errcode = 'WG429';
  end if;

  select * into invitation_row
  from public.organization_invitations
  where token_hash = encode(extensions.digest(invitation_token, 'sha256'), 'hex')
    and accepted_at is null
    and expires_at > now()
  for update;

  if invitation_row.id is null then
    raise exception 'Invitation is invalid or expired' using errcode = 'P0002';
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

  return invitation_row.organization_id;
end;
$$;

create or replace function public.enforce_insert_rate_limit()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
set row_security = off
as $$
declare
  allowed boolean;
begin
  if public.current_user_id() is null then
    return new;
  end if;
  if tg_table_name = 'organization_invitations' then
    allowed := public.consume_rate_limit(new.organization_id::text, 'invite_member', 10, 3600);
  elsif tg_table_name = 'comments' then
    allowed := public.consume_rate_limit(new.organization_id::text, 'create_comment', 30, 60);
  elsif tg_table_name = 'attachments' then
    allowed := public.consume_rate_limit(new.organization_id::text, 'upload_attachment', 20, 3600);
  else
    allowed := true;
  end if;
  if not coalesce(allowed, false) then
    raise exception 'Rate limit exceeded' using errcode = 'WG429';
  end if;
  return new;
end;
$$;

create trigger invitations_rate_limit before insert on public.organization_invitations
for each row execute function public.enforce_insert_rate_limit();
create trigger comments_rate_limit before insert on public.comments
for each row execute function public.enforce_insert_rate_limit();
create trigger attachments_rate_limit before insert on public.attachments
for each row execute function public.enforce_insert_rate_limit();

revoke all on function public.create_organization(text, text) from public;
revoke all on function public.accept_organization_invitation(text) from public;
revoke all on function public.consume_rate_limit(text, text, integer, integer) from public;
revoke all on function public.enforce_insert_rate_limit() from public;
revoke all on function public.current_user_id() from public;
revoke all on function public.is_organization_member(uuid) from public;
revoke all on function public.organization_role_for(uuid) from public;
revoke all on function public.has_organization_role(uuid, public.organization_role[]) from public;
revoke all on function public.safe_uuid(text) from public;
revoke all on function public.set_updated_at() from public;
revoke all on function public.prevent_identity_reassignment() from public;
revoke all on function public.prevent_audit_mutation() from public;
revoke all on function public.record_audit_event() from public;
revoke all on function public.enforce_active_task_assignee() from public;
grant execute on function public.create_organization(text, text) to authenticated;
grant execute on function public.accept_organization_invitation(text) to authenticated;
grant execute on function public.consume_rate_limit(text, text, integer, integer) to authenticated;
grant execute on function public.current_user_id(), public.is_organization_member(uuid), public.organization_role_for(uuid), public.has_organization_role(uuid, public.organization_role[]), public.safe_uuid(text) to authenticated;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'attachments',
  'attachments',
  false,
  4194304,
  array['application/pdf', 'text/plain', 'text/csv', 'image/png', 'image/jpeg', 'image/gif', 'image/webp']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

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
      and upload_status = 'ready'
      and public.is_organization_member(organization_id)
  );
$$;

create or replace function public.can_upload_storage_object(object_name text)
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
      and upload_status = 'pending'
      and uploaded_by = public.current_user_id()
      and public.is_organization_member(organization_id)
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
        uploaded_by = public.current_user_id()
        or public.has_organization_role(organization_id, array['admin', 'owner']::public.organization_role[])
      )
  );
$$;

revoke all on function public.can_read_storage_object(text) from public;
revoke all on function public.can_upload_storage_object(text) from public;
revoke all on function public.can_delete_storage_object(text) from public;
grant execute on function public.can_read_storage_object(text), public.can_upload_storage_object(text), public.can_delete_storage_object(text) to authenticated;

create policy attachment_objects_select on storage.objects for select to authenticated
using (bucket_id = 'attachments' and public.can_read_storage_object(name));
create policy attachment_objects_insert on storage.objects for insert to authenticated
with check (bucket_id = 'attachments' and public.can_upload_storage_object(name));
create policy attachment_objects_delete on storage.objects for delete to authenticated
using (bucket_id = 'attachments' and public.can_delete_storage_object(name));

comment on table public.rate_limit_windows is 'Fixed-window counters. Remove rows where expires_at < now() from a trusted scheduled job.';
comment on table public.attachments is 'Rows left pending for over one hour are safe cleanup candidates when no matching storage.objects row exists.';

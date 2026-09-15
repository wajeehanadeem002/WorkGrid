create extension if not exists pg_cron with schema pg_catalog;
create extension if not exists pg_net with schema extensions;
create extension if not exists supabase_vault with schema vault;

alter table public.attachments
  add column cleanup_claimed_at timestamptz;

alter table public.attachments
  add constraint attachments_cleanup_lease_check
  check (
    cleanup_claimed_at is null
    or upload_status in ('deleting', 'discarding')
  );

create index attachments_cleanup_queue_idx
  on public.attachments(upload_status, cleanup_claimed_at, deletion_started_at, created_at, id)
  where upload_status in ('pending', 'verifying', 'deleting', 'discarding');

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
      deletion_started_at = now(),
      cleanup_claimed_at = null
  from storage.objects object
  where attachment.upload_status in ('pending', 'verifying')
    and attachment.created_at < now() - interval '15 minutes'
    and attachment.cleanup_claimed_at is null
    and object.bucket_id = 'attachments'
    and object.name = attachment.storage_path;
  get diagnostics marked_discarding = row_count;

  update public.attachments attachment
  set upload_status = 'ready',
      deletion_started_at = null,
      cleanup_claimed_at = null
  where attachment.upload_status = 'deleting'
    and attachment.deletion_started_at < now() - interval '15 minutes'
    and (
      attachment.cleanup_claimed_at is null
      or attachment.cleanup_claimed_at < now() - interval '10 minutes'
    )
    and exists (
      select 1 from storage.objects object
      where object.bucket_id = 'attachments' and object.name = attachment.storage_path
    );
  get diagnostics restored_ready = row_count;

  delete from public.attachments attachment
  where attachment.upload_status = 'deleting'
    and attachment.deletion_started_at < now() - interval '15 minutes'
    and (
      attachment.cleanup_claimed_at is null
      or attachment.cleanup_claimed_at < now() - interval '10 minutes'
    )
    and not exists (
      select 1 from storage.objects object
      where object.bucket_id = 'attachments' and object.name = attachment.storage_path
    );
  get diagnostics deleted_metadata = row_count;

  delete from public.attachments attachment
  where attachment.upload_status = 'discarding'
    and attachment.deletion_started_at < now() - interval '15 minutes'
    and (
      attachment.cleanup_claimed_at is null
      or attachment.cleanup_claimed_at < now() - interval '10 minutes'
    )
    and not exists (
      select 1 from storage.objects object
      where object.bucket_id = 'attachments' and object.name = attachment.storage_path
    );
  get diagnostics discarded_metadata = row_count;

  delete from public.attachments attachment
  where attachment.upload_status in ('pending', 'verifying')
    and attachment.created_at < now() - interval '1 hour'
    and attachment.cleanup_claimed_at is null
    and not exists (
      select 1 from storage.objects object
      where object.bucket_id = 'attachments' and object.name = attachment.storage_path
    );
  get diagnostics cancelled_reservations = row_count;
  return next;
end;
$$;

create or replace function public.claim_attachment_cleanup_batch()
returns table(
  attachment_id uuid,
  storage_path text,
  cleanup_mode text
)
language plpgsql
security definer
set search_path = public, storage, pg_temp
set row_security = off
as $$
begin
  -- Seal interrupted uploads into a permanently untrusted state. The worker
  -- may delete these bytes, but it can never promote them to ready.
  with stale_uploads as (
    select attachment.id, object.id as storage_object_id
    from public.attachments attachment
    join storage.objects object
      on object.bucket_id = 'attachments'
     and object.name = attachment.storage_path
    where attachment.upload_status in ('pending', 'verifying')
      and attachment.created_at < now() - interval '15 minutes'
      and attachment.cleanup_claimed_at is null
    order by attachment.created_at, attachment.id
    for update of attachment skip locked
    limit 50
  )
  update public.attachments attachment
  set upload_status = 'discarding',
      storage_object_id = stale.storage_object_id,
      deletion_started_at = coalesce(attachment.deletion_started_at, now()),
      cleanup_claimed_at = null
  from stale_uploads stale
  where attachment.id = stale.id
    and attachment.upload_status in ('pending', 'verifying');

  -- Recover metadata left behind after a worker removed the object and then
  -- stopped before finalization. Only old/expired leases are considered.
  with completed_cleanup as (
    select attachment.id
    from public.attachments attachment
    where attachment.upload_status in ('deleting', 'discarding')
      and attachment.deletion_started_at < now() - interval '15 minutes'
      and (
        attachment.cleanup_claimed_at is null
        or attachment.cleanup_claimed_at < now() - interval '10 minutes'
      )
      and not exists (
        select 1
        from storage.objects object
        where object.bucket_id = 'attachments'
          and object.name = attachment.storage_path
      )
    order by attachment.deletion_started_at, attachment.id
    for update skip locked
    limit 50
  )
  delete from public.attachments attachment
  using completed_cleanup completed
  where attachment.id = completed.id
    and attachment.upload_status in ('deleting', 'discarding');

  -- Cancel old reservations only after Storage confirms no object exists.
  with expired_reservations as (
    select attachment.id
    from public.attachments attachment
    where attachment.upload_status in ('pending', 'verifying')
      and attachment.created_at < now() - interval '1 hour'
      and attachment.cleanup_claimed_at is null
      and not exists (
        select 1
        from storage.objects object
        where object.bucket_id = 'attachments'
          and object.name = attachment.storage_path
      )
    order by attachment.created_at, attachment.id
    for update skip locked
    limit 50
  )
  delete from public.attachments attachment
  using expired_reservations expired
  where attachment.id = expired.id
    and attachment.upload_status in ('pending', 'verifying');

  -- Keep maintenance bounded so a cleanup invocation cannot monopolize a
  -- large table after an extended outage.
  with expired_windows as (
    select window.ctid
    from public.rate_limit_windows window
    where window.expires_at < now()
    order by window.expires_at
    limit 1000
  )
  delete from public.rate_limit_windows window
  using expired_windows expired
  where window.ctid = expired.ctid;

  return query
  with candidates as (
    select attachment.id
    from public.attachments attachment
    where attachment.upload_status in ('deleting', 'discarding')
      and (
        attachment.upload_status = 'discarding'
        or attachment.deletion_started_at < now() - interval '15 minutes'
      )
      and (
        attachment.cleanup_claimed_at is null
        or attachment.cleanup_claimed_at < now() - interval '10 minutes'
      )
      and exists (
        select 1
        from storage.objects object
        where object.bucket_id = 'attachments'
          and object.name = attachment.storage_path
      )
    order by attachment.deletion_started_at, attachment.id
    for update skip locked
    limit 50
  ), claimed as (
    update public.attachments attachment
    set cleanup_claimed_at = now()
    from candidates candidate
    where attachment.id = candidate.id
      and attachment.upload_status in ('deleting', 'discarding')
    returning
      attachment.id,
      attachment.storage_path,
      attachment.upload_status::text
  )
  select claimed.id, claimed.storage_path, claimed.upload_status
  from claimed
  order by claimed.id;
end;
$$;

create or replace function public.finalize_attachment_cleanup(target_attachment_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, storage, pg_temp
set row_security = off
as $$
declare
  attachment_row public.attachments%rowtype;
  affected integer;
begin
  select * into attachment_row
  from public.attachments attachment
  where attachment.id = target_attachment_id
    and attachment.upload_status in ('deleting', 'discarding')
    and attachment.cleanup_claimed_at is not null
  for update;

  if attachment_row.id is null then
    return jsonb_build_object('ok', false, 'code', 'NOT_FOUND');
  end if;

  if exists (
    select 1
    from storage.objects object
    where object.bucket_id = 'attachments'
      and object.name = attachment_row.storage_path
  ) then
    if attachment_row.upload_status = 'deleting' then
      update public.attachments
      set upload_status = 'ready',
          deletion_started_at = null,
          cleanup_claimed_at = null
      where id = attachment_row.id
        and upload_status = 'deleting'
        and cleanup_claimed_at = attachment_row.cleanup_claimed_at;
      get diagnostics affected = row_count;
      if affected <> 1 then
        return jsonb_build_object('ok', false, 'code', 'CONFLICT');
      end if;
      return jsonb_build_object('ok', true, 'outcome', 'RESTORED');
    end if;

    update public.attachments
    set cleanup_claimed_at = null
    where id = attachment_row.id
      and upload_status = 'discarding'
      and cleanup_claimed_at = attachment_row.cleanup_claimed_at;
    get diagnostics affected = row_count;
    if affected <> 1 then
      return jsonb_build_object('ok', false, 'code', 'CONFLICT');
    end if;
    return jsonb_build_object('ok', true, 'outcome', 'RETRY');
  end if;

  delete from public.attachments
  where id = attachment_row.id
    and upload_status = attachment_row.upload_status
    and cleanup_claimed_at = attachment_row.cleanup_claimed_at;
  get diagnostics affected = row_count;
  if affected <> 1 then
    return jsonb_build_object('ok', false, 'code', 'CONFLICT');
  end if;
  return jsonb_build_object('ok', true, 'outcome', 'DELETED');
end;
$$;

revoke all on function public.claim_attachment_cleanup_batch() from public, anon, authenticated;
revoke all on function public.finalize_attachment_cleanup(uuid) from public, anon, authenticated;
grant execute on function public.claim_attachment_cleanup_batch() to service_role;
grant execute on function public.finalize_attachment_cleanup(uuid) to service_role;

comment on column public.attachments.cleanup_claimed_at is
  'Internal lease used only by the service-role cleanup worker. Never client writable.';
comment on function public.claim_attachment_cleanup_batch() is
  'Claims one fixed batch of safe attachment cleanup work. Service role only; accepts no caller-controlled limits or paths.';
comment on function public.finalize_attachment_cleanup(uuid) is
  'Reconciles one claimed cleanup row against Storage metadata. Service role only; never deletes Storage objects through SQL.';

do $$
declare
  existing_job_id bigint;
begin
  select jobid into existing_job_id
  from cron.job
  where jobname = 'workgrid-attachment-cleanup';

  if existing_job_id is not null then
    perform cron.unschedule(existing_job_id);
  end if;

  perform cron.schedule(
    'workgrid-attachment-cleanup',
    '*/15 * * * *',
    $cron$
      select net.http_post(
        url := project_url.decrypted_secret || '/functions/v1/cleanup-attachments',
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'x-workgrid-cleanup-token', cleanup_token.decrypted_secret
        ),
        body := '{}'::jsonb,
        timeout_milliseconds := 120000
      )
      from vault.decrypted_secrets project_url
      cross join vault.decrypted_secrets cleanup_token
      where project_url.name = 'workgrid_project_url'
        and cleanup_token.name = 'workgrid_cleanup_token';
    $cron$
  );
end;
$$;

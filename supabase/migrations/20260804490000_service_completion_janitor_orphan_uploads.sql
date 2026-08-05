-- Service completion Task 57: orphan upload janitor (SQL-only, KYC pattern).
-- Expires open sessions past TTL; deletes unreferenced Storage objects + registry rows.
-- Cron wrapper: Task 58 migration. No Edge Function.

create index if not exists idx_upload_objects_orphan_janitor
  on public.completion_evidence_upload_objects (registered_at)
  where referenced_in_responses = false;

-- True when path appears in any frozen evidence package (defensive vs flag drift).
create or replace function public.completion_evidence_path_referenced_in_frozen(
  p_storage_path text
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.contracted_service_completion_evidence e
    cross join lateral jsonb_each(coalesce(e.responses, '{}'::jsonb)) as ans(key, value)
    cross join lateral jsonb_array_elements_text(
      coalesce(ans.value -> 'evidence_paths', '[]'::jsonb)
    ) as path(path)
    where e.phase = 'frozen'::public.completion_evidence_phase
      and path.path = p_storage_path
  );
$$;

comment on function public.completion_evidence_path_referenced_in_frozen(text) is
  'Defensive check: storage path bound in frozen completion evidence responses.';

revoke all on function public.completion_evidence_path_referenced_in_frozen(text)
  from public, anon, authenticated;
grant execute on function public.completion_evidence_path_referenced_in_frozen(text)
  to service_role;
grant execute on function public.completion_evidence_path_referenced_in_frozen(text)
  to postgres;

create or replace function public.service_completion_janitor_orphan_uploads(
  p_batch_size int default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, storage
as $$
declare
  v_started_at timestamptz := clock_timestamp();
  v_batch_size int;
  v_ttl_hours int;
  v_cutoff timestamptz;
  v_sessions_expired int := 0;
  v_objects_deleted int := 0;
  v_bytes_deleted bigint := 0;
  v_delete_failures int := 0;
  v_skipped_frozen int := 0;
  v_processed int := 0;
  v_row record;
  v_object_bytes bigint;
  v_object_count int;
  v_duration_ms int;
begin
  if coalesce(auth.role(), '') <> 'service_role' then
    raise exception 'service_role required for service_completion_janitor_orphan_uploads'
      using errcode = '42501';
  end if;

  v_batch_size := least(
    greatest(
      coalesce(
        p_batch_size,
        public.platform_constant_int('enrichment_claim_batch_size', 20)
      ),
      1
    ),
    100
  );
  v_ttl_hours := greatest(
    public.platform_constant_int('completion_evidence_orphan_ttl_hours', 24),
    1
  );
  v_cutoff := now() - make_interval(hours => v_ttl_hours);

  -- (1) Mark expired open sessions past TTL (KYC-style session expiry).
  for v_row in
    with due as (
      select s.id
      from public.completion_evidence_upload_sessions s
      where s.status = 'open'::public.completion_upload_session_status
        and s.expires_at < v_cutoff
      order by s.expires_at
      for update of s skip locked
      limit v_batch_size
    ),
    marked as (
      update public.completion_evidence_upload_sessions s
      set
        status = 'expired'::public.completion_upload_session_status,
        updated_at = now()
      from due
      where s.id = due.id
      returning s.id
    )
    select * from marked
  loop
    v_sessions_expired := v_sessions_expired + 1;
  end loop;

  -- (2) Delete unreferenced objects older than TTL (Storage + registry in same TX path).
  for v_row in
    select
      o.id,
      o.storage_path,
      o.byte_size,
      s.storage_bucket
    from public.completion_evidence_upload_objects o
    join public.completion_evidence_upload_sessions s on s.id = o.session_id
    where o.referenced_in_responses = false
      and o.registered_at < v_cutoff
    order by o.registered_at
    for update of o skip locked
    limit v_batch_size
  loop
    v_processed := v_processed + 1;

    begin
      -- Defensive frozen scan only on the locked batch (race with mark_executed / flag drift).
      if public.completion_evidence_path_referenced_in_frozen(v_row.storage_path) then
        update public.completion_evidence_upload_objects
        set referenced_in_responses = true
        where id = v_row.id;
        v_skipped_frozen := v_skipped_frozen + 1;
        continue;
      end if;

      if nullif(btrim(v_row.storage_path), '') is not null
        and nullif(btrim(v_row.storage_bucket), '') is not null
      then
        with deleted as (
          delete from storage.objects so
          where so.bucket_id = v_row.storage_bucket
            and so.name = v_row.storage_path
          returning coalesce((so.metadata ->> 'size')::bigint, 0) as object_size
        )
        select
          coalesce(sum(object_size), 0),
          count(*)::int
        into v_object_bytes, v_object_count
        from deleted;
      else
        v_object_bytes := 0;
        v_object_count := 0;
      end if;

      -- Missing Storage object is success (idempotent), same as KYC / prior Edge behavior.
      delete from public.completion_evidence_upload_objects o
      where o.id = v_row.id
        and o.referenced_in_responses = false;

      v_bytes_deleted := v_bytes_deleted + coalesce(v_object_bytes, 0);
      if found then
        v_objects_deleted := v_objects_deleted + 1;
      end if;
    exception
      when others then
        v_delete_failures := v_delete_failures + 1;
        raise log
          'service_completion_janitor_orphan_uploads delete_failed object_id=% path=% sqlstate=% message=%',
          v_row.id,
          v_row.storage_path,
          sqlstate,
          sqlerrm;
    end;
  end loop;

  v_duration_ms := (
    extract(epoch from (clock_timestamp() - v_started_at)) * 1000
  )::int;

  if v_sessions_expired > 0 or v_objects_deleted > 0 or v_delete_failures > 0 then
    raise log
      'service_completion_orphan_janitor sessions_expired=% objects_deleted=% bytes_deleted=% delete_failures=% skipped_frozen=% duration_ms=%',
      v_sessions_expired,
      v_objects_deleted,
      v_bytes_deleted,
      v_delete_failures,
      v_skipped_frozen,
      v_duration_ms;
  end if;

  return jsonb_build_object(
    'ok', true,
    'ttl_hours', v_ttl_hours,
    'batch_size', v_batch_size,
    'processed_count', v_processed,
    'sessions_marked_expired', v_sessions_expired,
    'objects_deleted', v_objects_deleted,
    'bytes_deleted', v_bytes_deleted,
    'delete_failures', v_delete_failures,
    'skipped_frozen', v_skipped_frozen,
    'duration_ms', v_duration_ms
  );
end;
$$;

comment on function public.service_completion_janitor_orphan_uploads(int) is
  'SQL janitor (KYC pattern): expire open sessions past TTL; DELETE storage.objects + registry for unreferenced orphans. Missing Storage object = success. service_role only.';

revoke all on function public.service_completion_janitor_orphan_uploads(int)
  from public, anon, authenticated;
grant execute on function public.service_completion_janitor_orphan_uploads(int)
  to service_role;
grant execute on function public.service_completion_janitor_orphan_uploads(int)
  to postgres;

alter function public.service_completion_janitor_orphan_uploads(int)
  set statement_timeout = '60s';

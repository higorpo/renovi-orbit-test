-- Service completion Task 57: service_completion_janitor_orphan_uploads claim RPC
-- (design §3.6 / §8). Edge Storage delete + cron: Task 58.

alter table public.completion_evidence_upload_objects
  add column if not exists janitor_claimed_at timestamptz;

comment on column public.completion_evidence_upload_objects.janitor_claimed_at is
  'Set when orphan janitor claims path for Edge Storage delete; cleared/row deleted after delete (Task 58).';

create index if not exists idx_upload_objects_janitor_claim
  on public.completion_evidence_upload_objects (registered_at)
  where referenced_in_responses = false and janitor_claimed_at is null;

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
set search_path = public
as $$
declare
  v_batch_size int;
  v_ttl_hours int;
  v_cutoff timestamptz;
  v_claim_stale_before timestamptz;
  v_objects jsonb := '[]'::jsonb;
  v_sessions jsonb := '[]'::jsonb;
  v_session_count int := 0;
  v_object_count int := 0;
  v_row record;
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
  -- Allow re-claim if Edge never finished (Task 58).
  v_claim_stale_before := now() - interval '1 hour';

  -- (1) Mark expired open sessions past TTL; collect session ids for object claim.
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
      returning s.id, s.contracted_service_id, s.storage_bucket, s.storage_prefix
    )
    select * from marked
  loop
    v_session_count := v_session_count + 1;
    v_sessions := v_sessions || jsonb_build_array(
      jsonb_build_object(
        'session_id', v_row.id,
        'contracted_service_id', v_row.contracted_service_id,
        'storage_bucket', v_row.storage_bucket,
        'storage_prefix', v_row.storage_prefix
      )
    );
  end loop;

  -- (2) Claim unreferenced objects older than TTL (indexed flags only — no frozen JSONB
  -- scan in the pre-lock filter; that O(n) check runs post-lock on the ≤batch_size rows).
  for v_row in
    with due as (
      select o.id
      from public.completion_evidence_upload_objects o
      join public.completion_evidence_upload_sessions s on s.id = o.session_id
      where o.referenced_in_responses = false
        and o.registered_at < v_cutoff
        and (
          o.janitor_claimed_at is null
          or o.janitor_claimed_at < v_claim_stale_before
        )
      order by o.registered_at
      for update of o skip locked
      limit v_batch_size
    ),
    claimed as (
      update public.completion_evidence_upload_objects o
      set janitor_claimed_at = now()
      from due
      where o.id = due.id
        and o.referenced_in_responses = false
      returning
        o.id,
        o.session_id,
        o.storage_path,
        o.byte_size,
        o.registered_at
    )
    select
      c.id,
      c.session_id,
      c.storage_path,
      c.byte_size,
      c.registered_at,
      s.storage_bucket,
      s.contracted_service_id
    from claimed c
    join public.completion_evidence_upload_sessions s on s.id = c.session_id
  loop
    -- Defensive frozen scan only on the claimed batch (race with mark_executed / flag drift).
    if public.completion_evidence_path_referenced_in_frozen(v_row.storage_path) then
      update public.completion_evidence_upload_objects
      set
        referenced_in_responses = true,
        janitor_claimed_at = null
      where id = v_row.id;
      continue;
    end if;

    v_object_count := v_object_count + 1;
    v_objects := v_objects || jsonb_build_array(
      jsonb_build_object(
        'object_id', v_row.id,
        'session_id', v_row.session_id,
        'contracted_service_id', v_row.contracted_service_id,
        'storage_bucket', v_row.storage_bucket,
        'storage_path', v_row.storage_path,
        'byte_size', v_row.byte_size,
        'registered_at', v_row.registered_at
      )
    );
  end loop;

  return jsonb_build_object(
    'ok', true,
    'ttl_hours', v_ttl_hours,
    'batch_size', v_batch_size,
    'sessions_marked_expired', v_session_count,
    'sessions', v_sessions,
    'objects_claimed', v_object_count,
    'objects', v_objects
  );
end;
$$;

comment on function public.service_completion_janitor_orphan_uploads(int) is
  'Claim orphan completion-evidence uploads for Edge delete: expire open sessions past TTL; claim via referenced_in_responses + indexes (frozen JSONB check only post-lock on batch). service_role only.';

revoke all on function public.service_completion_janitor_orphan_uploads(int)
  from public, anon, authenticated;
grant execute on function public.service_completion_janitor_orphan_uploads(int)
  to service_role;

alter function public.service_completion_janitor_orphan_uploads(int)
  set statement_timeout = '60s';

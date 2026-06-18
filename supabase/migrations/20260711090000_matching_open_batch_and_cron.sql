-- Matching M10a — dispatch lease CAS helpers (design §6.3).

create or replace function public.matching_acquire_dispatch_lease(
  p_dispatch_id uuid,
  p_owner text,
  p_ttl_seconds int default null
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_ttl int;
begin
  if p_dispatch_id is null or nullif(btrim(p_owner), '') is null then
    return false;
  end if;

  v_ttl := coalesce(
    p_ttl_seconds,
    public.platform_constant_int('matching.dispatch_lease_seconds', 300)
  );

  update public.service_request_dispatches
  set
    lease_owner = p_owner,
    lease_expires_at = now() + make_interval(secs => v_ttl),
    updated_at = now()
  where id = p_dispatch_id
    and (lease_expires_at is null or lease_expires_at < now());

  return found;
end;
$$;

comment on function public.matching_acquire_dispatch_lease(uuid, text, int) is
  'CAS lease acquire for a dispatch row; returns true when this worker owns the lease.';

create or replace function public.matching_renew_dispatch_lease(
  p_dispatch_id uuid,
  p_owner text,
  p_ttl_seconds int default null
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_ttl int;
begin
  if p_dispatch_id is null or nullif(btrim(p_owner), '') is null then
    return false;
  end if;

  v_ttl := coalesce(
    p_ttl_seconds,
    public.platform_constant_int('matching.dispatch_lease_seconds', 300)
  );

  update public.service_request_dispatches
  set
    lease_expires_at = now() + make_interval(secs => v_ttl),
    updated_at = now()
  where id = p_dispatch_id
    and lease_owner = p_owner
    and lease_expires_at >= now();

  return found;
end;
$$;

comment on function public.matching_renew_dispatch_lease(uuid, text, int) is
  'Extends an active dispatch lease TTL for the current owner during long batch work.';

create or replace function public.matching_release_dispatch_lease(
  p_dispatch_id uuid
)
returns void
language sql
security definer
set search_path = public
as $$
  update public.service_request_dispatches
  set
    lease_owner = null,
    lease_expires_at = null,
    updated_at = now()
  where id = p_dispatch_id;
$$;

comment on function public.matching_release_dispatch_lease(uuid) is
  'Clears dispatch lease after successful worker processing or txn end.';

revoke all on function public.matching_acquire_dispatch_lease(uuid, text, int)
  from public, anon, authenticated;
revoke all on function public.matching_renew_dispatch_lease(uuid, text, int)
  from public, anon, authenticated;
revoke all on function public.matching_release_dispatch_lease(uuid)
  from public, anon, authenticated;
grant execute on function public.matching_acquire_dispatch_lease(uuid, text, int) to service_role;
grant execute on function public.matching_renew_dispatch_lease(uuid, text, int) to service_role;
grant execute on function public.matching_release_dispatch_lease(uuid) to service_role;

-- Matching M10b — batch open orchestration (design §4.1, §4.3).

create or replace function public.matching_compute_explored_h3_cells(
  p_service_request_id uuid
)
returns jsonb
language sql
stable
security definer
set search_path = public, extensions
as $$
  select coalesce(
    (
      select jsonb_agg(distinct cell::text order by cell::text)
      from public.service_requests sr
      cross join lateral public.matching_h3_ring_cells(
        case
          when sr.h3_index is not null and btrim(sr.h3_index) ~ '^[0-9]+$'
            then sr.h3_index::bigint
          else null
        end,
        public.platform_constant_int('matching.h3_resolution', 7)
      ) as cell
      where sr.id = p_service_request_id
    ),
    '[]'::jsonb
  );
$$;

comment on function public.matching_compute_explored_h3_cells(uuid) is
  'Audit-only H3 cell set explored during batch discovery; does not affect eligibility.';

create or replace function public.matching_open_batch(
  p_dispatch_id uuid
)
returns void
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_d public.service_request_dispatches%rowtype;
  v_batch_size int;
  v_batch_interval_min int;
  v_discovered jsonb;
  v_new_batch_number int;
  v_batch_id uuid;
  v_explored jsonb;
  v_provider_count int;
  v_pool_cap int;
begin
  select *
  into v_d
  from public.service_request_dispatches
  where id = p_dispatch_id
  for update;

  if not found then
    return;
  end if;

  if v_d.status in (
    'DISPATCH_MATCHED',
    'DISPATCH_CANCELLED',
    'DISPATCH_EXPIRED'
  ) then
    return;
  end if;

  perform public.evaluate_service_request_dispatch_gates(v_d.service_request_id);

  select *
  into v_d
  from public.service_request_dispatches
  where id = p_dispatch_id;

  if v_d.status not in (
    'DISPATCH_PENDING'::public.service_request_dispatch_status,
    'DISPATCH_ACTIVE'::public.service_request_dispatch_status
  ) then
    return;
  end if;

  v_batch_size := public.platform_constant_int('matching.batch_size', 10);
  v_batch_interval_min := public.platform_constant_int('matching.batch_interval_minutes', 60);
  v_pool_cap := public.platform_constant_int('matching.discovery_pool_cap', 200);

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'provider_id', d.provider_id,
        'distance_meters', d.distance_meters,
        'has_valid_beacon', d.has_valid_beacon,
        'device_id', d.device_id
      )
      order by d.distance_meters nulls last, d.provider_id
    ),
    '[]'::jsonb
  )
  into v_discovered
  from public.matching_discover_candidates(v_d.service_request_id, v_pool_cap) d;

  if jsonb_array_length(v_discovered) = 0 then
    update public.service_request_dispatches
    set
      status = 'DISPATCH_FALLBACK_OPEN_MARKET'::public.service_request_dispatch_status,
      fallback_opened_at = coalesce(fallback_opened_at, now()),
      next_batch_at = null,
      updated_at = now()
    where id = p_dispatch_id;

    insert into public.service_request_dispatch_events (
      dispatch_id,
      service_request_id,
      event_type,
      payload
    )
    values (
      p_dispatch_id,
      v_d.service_request_id,
      'pool_exhausted',
      jsonb_build_object('batch_sequence', v_d.batch_sequence)
    );

    return;
  end if;

  v_explored := public.matching_compute_explored_h3_cells(v_d.service_request_id);
  v_new_batch_number := v_d.batch_sequence + 1;

  insert into public.service_request_dispatch_batches (
    dispatch_id,
    batch_number,
    explored_h3_cells
  )
  values (p_dispatch_id, v_new_batch_number, v_explored)
  returning id into v_batch_id;

  perform public.matching_renew_dispatch_lease(
    p_dispatch_id,
    v_d.lease_owner
  );

  insert into public.service_request_dispatch_batch_providers (
    batch_id,
    provider_id,
    ranking_score,
    score_components,
    device_id
  )
  select
    v_batch_id,
    r.provider_id,
    r.ranking_score,
    r.score_components,
    r.device_id
  from public.matching_rank_candidates_with_discover(v_d.service_request_id, v_discovered) r
  limit v_batch_size;

  get diagnostics v_provider_count = row_count;

  perform public.matching_renew_dispatch_lease(
    p_dispatch_id,
    v_d.lease_owner
  );

  insert into public.service_request_provider_visibility (
    service_request_id,
    provider_id,
    batch_id,
    source,
    granted_at
  )
  select
    v_d.service_request_id,
    bp.provider_id,
    v_batch_id,
    'batch',
    now()
  from public.service_request_dispatch_batch_providers bp
  where bp.batch_id = v_batch_id
  on conflict (service_request_id, provider_id)
    where source = 'batch' and revoked_at is null
  do nothing;

  insert into public.service_request_dispatch_events (
    dispatch_id,
    service_request_id,
    event_type,
    payload
  )
  values (
    p_dispatch_id,
    v_d.service_request_id,
    'batch_opened',
    jsonb_build_object(
      'batch_id', v_batch_id,
      'batch_number', v_new_batch_number,
      'provider_count', v_provider_count
    )
  );

  update public.service_request_dispatches
  set
    status = case
      when v_d.status = 'DISPATCH_PENDING'::public.service_request_dispatch_status
        then 'DISPATCH_ACTIVE'::public.service_request_dispatch_status
      else status
    end,
    batch_sequence = v_new_batch_number,
    next_batch_at = now() + make_interval(mins => v_batch_interval_min),
    updated_at = now()
  where id = p_dispatch_id;
end;
$$;

comment on function public.matching_open_batch(uuid) is
  'Opens one progressive dispatch batch: discover, rank, visibility grant, schedule next_batch_at.';

create or replace function public.matching_process_dispatch_row(
  p_dispatch_id uuid,
  p_job_run_id bigint default null
)
returns void
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_owner text;
begin
  v_owner := 'matching_cron:' || coalesce(p_job_run_id::text, '0');

  if not public.matching_acquire_dispatch_lease(p_dispatch_id, v_owner) then
    return;
  end if;

  begin
    perform public.matching_open_batch(p_dispatch_id);
    perform public.matching_release_dispatch_lease(p_dispatch_id);
  exception
    when query_canceled then
      perform public.matching_release_dispatch_lease(p_dispatch_id);
      perform public.job_run_abort_latest(
        'matching_process_service_request_dispatches',
        sqlerrm
      );
      raise;
    when others then
      perform public.matching_release_dispatch_lease(p_dispatch_id);
      raise;
  end;
end;
$$;

comment on function public.matching_process_dispatch_row(uuid, bigint) is
  'Cron worker entry: acquire lease, open batch, release lease; abort job_run on statement_timeout.';

revoke all on function public.matching_compute_explored_h3_cells(uuid)
  from public, anon, authenticated;
revoke all on function public.matching_open_batch(uuid)
  from public, anon, authenticated;
revoke all on function public.matching_process_dispatch_row(uuid, bigint)
  from public, anon, authenticated;
grant execute on function public.matching_compute_explored_h3_cells(uuid) to service_role;
grant execute on function public.matching_open_batch(uuid) to service_role;
grant execute on function public.matching_process_dispatch_row(uuid, bigint) to service_role;

-- Matching M10c — cron worker + pg_cron schedule (design §6.1, §6.2).

create or replace function public.cron_process_service_request_dispatches()
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_job_name constant text := 'matching_process_service_request_dispatches';
  v_started_at timestamptz := clock_timestamp();
  v_job_run_id bigint;
  v_lifecycle_hours int;
  v_cron_batch_limit int;
  v_expire_batch_limit int;
  v_phase1_expired int := 0;
  v_phase2a_processed int := 0;
  v_phase2a_skipped_lease int := 0;
  v_phase2a_errors int := 0;
  v_phase2b_processed int := 0;
  v_phase2b_errors int := 0;
  v_dispatch public.service_request_dispatches%rowtype;
  v_owner text;
  v_processed boolean;
begin
  perform public.cns_set_local_statement_timeout('120s');

  v_job_run_id := public.job_run_begin(v_job_name, 'v1');
  v_owner := 'matching_cron:' || v_job_run_id::text;
  v_lifecycle_hours := public.platform_constant_int('matching.dispatch_lifecycle_hours', 48);
  v_cron_batch_limit := public.platform_constant_int('matching.cron_dispatch_batch_limit', 50);
  v_expire_batch_limit := public.platform_constant_int('matching.cron_expire_dispatch_batch_limit', 500);

  with expired as (
    select d.id, d.service_request_id
    from public.service_request_dispatches d
    where d.status not in (
      'DISPATCH_MATCHED'::public.service_request_dispatch_status,
      'DISPATCH_CANCELLED'::public.service_request_dispatch_status,
      'DISPATCH_EXPIRED'::public.service_request_dispatch_status
    )
      and d.created_at < now() - (v_lifecycle_hours || ' hours')::interval
    order by d.created_at
    limit v_expire_batch_limit
    for update skip locked
  ),
  updated as (
    update public.service_request_dispatches d
    set
      status = 'DISPATCH_EXPIRED'::public.service_request_dispatch_status,
      next_batch_at = null,
      updated_at = now()
    from expired e
    where d.id = e.id
    returning d.id, d.service_request_id
  )
  insert into public.service_request_dispatch_events (
    dispatch_id,
    service_request_id,
    event_type,
    payload
  )
  select
    u.id,
    u.service_request_id,
    'dispatch_expired',
    jsonb_build_object(
      'expired_at', now(),
      'lifecycle_hours', v_lifecycle_hours
    )
  from updated u;

  get diagnostics v_phase1_expired = row_count;

  for v_dispatch in
    select d.*
    from public.service_request_dispatches d
    where d.next_batch_at <= now()
      and d.status in (
        'DISPATCH_PENDING'::public.service_request_dispatch_status,
        'DISPATCH_ACTIVE'::public.service_request_dispatch_status
      )
    order by d.next_batch_at
    for update skip locked
    limit v_cron_batch_limit
  loop
    begin
      v_processed := public.matching_acquire_dispatch_lease(v_dispatch.id, v_owner);
      if v_processed then
        perform public.matching_open_batch(v_dispatch.id);
        perform public.matching_release_dispatch_lease(v_dispatch.id);
        v_phase2a_processed := v_phase2a_processed + 1;
      else
        v_phase2a_skipped_lease := v_phase2a_skipped_lease + 1;
      end if;
    exception
      when others then
        perform public.matching_release_dispatch_lease(v_dispatch.id);
        v_phase2a_errors := v_phase2a_errors + 1;
        raise log 'matching_cron_phase2a_error dispatch_id=% sqlstate=% message=%',
          v_dispatch.id,
          sqlstate,
          sqlerrm;
    end;
  end loop;

  for v_dispatch in
    select d.*
    from public.service_request_dispatches d
    where d.status in (
      'DISPATCH_PAUSED'::public.service_request_dispatch_status,
      'DISPATCH_STOPPED'::public.service_request_dispatch_status
    )
    order by d.updated_at
    for update skip locked
    limit v_cron_batch_limit
  loop
    begin
      if public.matching_acquire_dispatch_lease(v_dispatch.id, v_owner) then
        perform public.evaluate_service_request_dispatch_gates(v_dispatch.service_request_id);
        perform public.matching_release_dispatch_lease(v_dispatch.id);
      end if;
      v_phase2b_processed := v_phase2b_processed + 1;
    exception
      when others then
        perform public.matching_release_dispatch_lease(v_dispatch.id);
        v_phase2b_errors := v_phase2b_errors + 1;
        raise log 'matching_cron_phase2b_error dispatch_id=% sqlstate=% message=%',
          v_dispatch.id,
          sqlstate,
          sqlerrm;
    end;
  end loop;

  perform public.job_run_finish(
    v_job_run_id,
    v_started_at,
    v_phase2a_processed + v_phase2b_processed,
    v_phase1_expired,
    v_phase2a_errors + v_phase2b_errors,
    jsonb_build_object(
      'phase1_expired_count', v_phase1_expired,
      'phase2a_processed', v_phase2a_processed,
      'phase2a_skipped_lease', v_phase2a_skipped_lease,
      'phase2a_errors', v_phase2a_errors,
      'phase2b_processed', v_phase2b_processed,
      'phase2b_errors', v_phase2b_errors
    )
  );

  return jsonb_build_object(
    'job_run_id', v_job_run_id,
    'phase1_expired_count', v_phase1_expired,
    'phase2a_processed', v_phase2a_processed,
    'phase2b_processed', v_phase2b_processed
  );
exception
  when others then
    perform public.job_run_abort_latest(v_job_name, sqlerrm);
    raise;
end;
$$;

comment on function public.cron_process_service_request_dispatches() is
  'pg_cron entrypoint: lifecycle sweep, due batch opens, and PAUSED/STOPPED gate re-eval.';

revoke all on function public.cron_process_service_request_dispatches() from public;
revoke all on function public.cron_process_service_request_dispatches() from authenticated;
revoke all on function public.cron_process_service_request_dispatches() from anon;
grant execute on function public.cron_process_service_request_dispatches() to postgres;

do $cron$
declare
  v_jobid integer;
begin
  select j.jobid
  into v_jobid
  from cron.job j
  where j.jobname = 'matching_process_service_request_dispatches';

  if v_jobid is not null then
    perform cron.unschedule(v_jobid);
  end if;
end;
$cron$;

select cron.schedule(
  'matching_process_service_request_dispatches',
  '*/2 * * * *',
  $$select public.cron_process_service_request_dispatches();$$
);

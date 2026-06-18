-- Matching M10e — cron error metadata + consecutive failure ops helper (task 47).

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
  v_error_dispatches jsonb := '[]'::jsonb;
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
        v_error_dispatches := v_error_dispatches || jsonb_build_array(
          jsonb_build_object(
            'phase', '2a',
            'dispatch_id', v_dispatch.id,
            'service_request_id', v_dispatch.service_request_id,
            'sqlstate', sqlstate,
            'message', left(sqlerrm, 200)
          )
        );
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
        v_error_dispatches := v_error_dispatches || jsonb_build_array(
          jsonb_build_object(
            'phase', '2b',
            'dispatch_id', v_dispatch.id,
            'service_request_id', v_dispatch.service_request_id,
            'sqlstate', sqlstate,
            'message', left(sqlerrm, 200)
          )
        );
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
      'phase2b_errors', v_phase2b_errors,
      'error_dispatches', v_error_dispatches
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

create or replace function public.matching_ops_consecutive_cron_errors(
  p_threshold int default 10,
  p_lookback int default 100
)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  with ordered as (
    select
      jr.id,
      jr.started_at,
      jr.error_count,
      jr.metadata,
      row_number() over (order by jr.started_at desc) as rn
    from public.job_runs jr
    where jr.job_name = 'matching_process_service_request_dispatches'
      and jr.finished_at is not null
    order by jr.started_at desc
    limit greatest(coalesce(p_lookback, 100), 1)
  ),
  first_ok as (
    select min(o.rn) as rn
    from ordered o
    where o.error_count = 0
  ),
  consecutive as (
    select count(*)::int as consecutive_error_runs
    from ordered o
    where o.error_count > 0
      and o.rn < coalesce((select rn from first_ok), (select max(o2.rn) + 1 from ordered o2))
  ),
  suspect_srs as (
    select distinct entry->>'service_request_id' as service_request_id
    from ordered o
    cross join lateral jsonb_array_elements(
      coalesce(o.metadata->'error_dispatches', '[]'::jsonb)
    ) as entry
    where o.error_count > 0
      and o.rn <= coalesce((select c.consecutive_error_runs from consecutive c), 0)
      and nullif(entry->>'service_request_id', '') is not null
  )
  select jsonb_build_object(
    'consecutive_error_runs', coalesce((select consecutive_error_runs from consecutive), 0),
    'threshold', greatest(coalesce(p_threshold, 10), 1),
    'alert', coalesce((select consecutive_error_runs from consecutive), 0)
      > greatest(coalesce(p_threshold, 10), 1),
    'suspect_service_request_ids', coalesce(
      (select jsonb_agg(s.service_request_id order by s.service_request_id)
       from suspect_srs s),
      '[]'::jsonb
    )
  );
$$;

comment on function public.matching_ops_consecutive_cron_errors(int, int) is
  'Ops helper: consecutive matching cron job_runs with error_count > 0; surfaces suspect SR ids from error_dispatches metadata.';

revoke all on function public.matching_ops_consecutive_cron_errors(int, int) from public;
revoke all on function public.matching_ops_consecutive_cron_errors(int, int) from authenticated;
revoke all on function public.matching_ops_consecutive_cron_errors(int, int) from anon;
grant execute on function public.matching_ops_consecutive_cron_errors(int, int) to service_role;

-- Payment Task 32: payment_recover_orphaned_schedules RPC (design.md §4.6).
-- Must run alongside payment_reconcile_netcred_payments (Task 58) before charge cron is enabled.
-- Uncertain orphans (gateway_charge_id set, or attempt row missing after claim) → IN_ANALYSIS, not SCHEDULED,
-- so claim batch cannot re-charge until reconcile/commit resolves the gateway outcome.

create or replace function public.payment_recover_orphaned_schedules()
returns table (
  recovered_count int,
  recovered_to_scheduled int,
  recovered_to_failed int
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count int := 0;
  v_sched int := 0;
  v_fail int := 0;
  v_retry_minutes int;
  v_updated record;
begin
  if coalesce(auth.role(), '') <> 'service_role' then
    raise exception 'service_role required for payment_recover_orphaned_schedules'
      using errcode = '42501';
  end if;

  v_retry_minutes := public.platform_constant_int('charge_retry_interval_minutes', 30);

  create temp table _payment_orphan_recovery_result on commit drop as
  with orphans as (
    select ps.*
    from public.payment_schedules ps
    where ps.state = 'PROCESSING'::public.payment_schedule_state
      and ps.locked_until is not null
      and ps.locked_until < now()
    for update skip locked
  ),
  resolved as (
    select
      o.*,
      exists (
        select 1
        from public.payment_attempts pa
        where pa.schedule_id = o.id
          and pa.attempt_number = o.automatic_attempt_count
          and pa.initiator = 'cron'::public.payment_attempt_initiator
      ) as has_attempt_row,
      case
        when o.gateway_charge_id is not null then 'IN_ANALYSIS'::public.payment_schedule_state
        -- Ambiguous manual timeout: hold for getTransaction reconcile (do not FAILED→rotate).
        when o.manual_attempt_count > 0 then 'IN_ANALYSIS'::public.payment_schedule_state
        when o.automatic_attempt_count = 0 then 'SCHEDULED'::public.payment_schedule_state
        when not exists (
          select 1
          from public.payment_attempts pa
          where pa.schedule_id = o.id
            and pa.attempt_number = o.automatic_attempt_count
            and pa.initiator = 'cron'::public.payment_attempt_initiator
        ) then 'IN_ANALYSIS'::public.payment_schedule_state
        else 'FAILED'::public.payment_schedule_state
      end as new_state
    from orphans o
  ),
  updated as (
    update public.payment_schedules ps
    set
      state = r.new_state,
      locked_until = null,
      automatic_attempt_count = case
        when r.new_state = 'SCHEDULED'::public.payment_schedule_state
          and r.manual_attempt_count = 0
          and not r.has_attempt_row
          then greatest(0, ps.automatic_attempt_count - 1)::smallint
        else ps.automatic_attempt_count
      end,
      next_retry_at = case
        when r.new_state = 'FAILED'::public.payment_schedule_state
          and r.manual_attempt_count = 0
          then now() + make_interval(mins => v_retry_minutes)
        else null
      end,
      updated_at = now()
    from resolved r
    where ps.id = r.id
    returning
      ps.id,
      r.contracted_service_id,
      r.new_state,
      r.locked_until,
      ps.automatic_attempt_count,
      r.manual_attempt_count
  )
  select * from updated;

  for v_updated in select * from _payment_orphan_recovery_result loop
    perform public.payment_write_audit(
      p_event_type := 'ORPHAN_RECOVERED',
      p_entity_type := 'payment_schedule',
      p_entity_id := v_updated.id,
      p_service_id := v_updated.contracted_service_id,
      p_schedule_id := v_updated.id,
      p_from_state := 'PROCESSING',
      p_to_state := v_updated.new_state::text,
      p_actor := 'system'::public.payment_audit_actor,
      p_metadata := jsonb_build_object(
        'recovered_at', now(),
        'locked_until_was', v_updated.locked_until,
        'automatic_attempt_count', v_updated.automatic_attempt_count,
        'manual_attempt_count', v_updated.manual_attempt_count
      )
    );

    perform public.payment_write_event(
      p_event_type := 'OrphanScheduleRecovered',
      p_aggregate_type := 'payment_schedule',
      p_aggregate_id := v_updated.id,
      p_service_id := v_updated.contracted_service_id,
      p_payload := jsonb_build_object(
        'new_state', v_updated.new_state,
        'automatic_attempt_count', v_updated.automatic_attempt_count,
        'manual_attempt_count', v_updated.manual_attempt_count
      )
    );
  end loop;

  select
    count(*)::int,
    count(*) filter (
      where new_state = 'SCHEDULED'::public.payment_schedule_state
    )::int,
    count(*) filter (
      where new_state = 'FAILED'::public.payment_schedule_state
    )::int
  into v_count, v_sched, v_fail
  from _payment_orphan_recovery_result;

  return query
  select coalesce(v_count, 0), coalesce(v_sched, 0), coalesce(v_fail, 0);
end;
$$;

comment on function public.payment_recover_orphaned_schedules() is
  'Janitor: expired PROCESSING leases → SCHEDULED, FAILED, or IN_ANALYSIS (uncertain gateway outcome). Prefer cron_payment_charge_batch which runs this before claim.';

revoke all on function public.payment_recover_orphaned_schedules() from public;
revoke all on function public.payment_recover_orphaned_schedules() from anon;
revoke all on function public.payment_recover_orphaned_schedules() from authenticated;

grant execute on function public.payment_recover_orphaned_schedules() to service_role;

-- pg_cron entrypoints: charge batch MUST run orphan recovery first (design.md §4.6).
create or replace function public.cron_payment_recover_orphaned_schedules()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_started_at timestamptz := clock_timestamp();
  v_job_run_id bigint;
  v_recovered_count int;
  v_recovered_to_scheduled int;
  v_recovered_to_failed int;
begin
  v_job_run_id := public.job_run_begin('payment_recover_orphaned_schedules', 'v1');

  select r.recovered_count, r.recovered_to_scheduled, r.recovered_to_failed
  into v_recovered_count, v_recovered_to_scheduled, v_recovered_to_failed
  from public.payment_recover_orphaned_schedules() r;

  perform public.job_run_finish(
    v_job_run_id,
    v_started_at,
    coalesce(v_recovered_count, 0),
    coalesce(v_recovered_to_scheduled, 0) + coalesce(v_recovered_to_failed, 0),
    0,
    jsonb_build_object(
      'recovered_to_scheduled', coalesce(v_recovered_to_scheduled, 0),
      'recovered_to_failed', coalesce(v_recovered_to_failed, 0)
    )
  );

  return jsonb_build_object(
    'recovered_count', coalesce(v_recovered_count, 0),
    'recovered_to_scheduled', coalesce(v_recovered_to_scheduled, 0),
    'recovered_to_failed', coalesce(v_recovered_to_failed, 0),
    'job_run_id', v_job_run_id
  );
exception
  when others then
    perform public.job_run_abort_latest('payment_recover_orphaned_schedules', sqlerrm);
    raise;
end;
$$;

comment on function public.cron_payment_recover_orphaned_schedules() is
  'pg_cron entrypoint: orphan PROCESSING lease janitor with job_runs telemetry.';

create or replace function public.cron_payment_charge_batch(
  p_batch_size int default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_started_at timestamptz := clock_timestamp();
  v_job_run_id bigint;
  v_recovered_count int;
  v_recovered_to_scheduled int;
  v_recovered_to_failed int;
  v_claimed jsonb;
  v_claimed_count int;
begin
  v_job_run_id := public.job_run_begin('payment_charge_batch', 'v1');

  -- Orphan recovery MUST precede claim (expired leases block re-charge).
  select r.recovered_count, r.recovered_to_scheduled, r.recovered_to_failed
  into v_recovered_count, v_recovered_to_scheduled, v_recovered_to_failed
  from public.payment_recover_orphaned_schedules() r;

  v_claimed := public.payment_claim_charge_batch(p_batch_size);
  v_claimed_count := coalesce(jsonb_array_length(v_claimed), 0);

  perform public.job_run_finish(
    v_job_run_id,
    v_started_at,
    v_claimed_count,
    coalesce(v_recovered_count, 0),
    0,
    jsonb_build_object(
      'recovered_to_scheduled', coalesce(v_recovered_to_scheduled, 0),
      'recovered_to_failed', coalesce(v_recovered_to_failed, 0),
      'claimed_count', v_claimed_count
    )
  );

  return jsonb_build_object(
    'orphan_recovery', jsonb_build_object(
      'recovered_count', coalesce(v_recovered_count, 0),
      'recovered_to_scheduled', coalesce(v_recovered_to_scheduled, 0),
      'recovered_to_failed', coalesce(v_recovered_to_failed, 0)
    ),
    'claimed', v_claimed,
    'claimed_count', v_claimed_count,
    'job_run_id', v_job_run_id
  );
exception
  when others then
    perform public.job_run_abort_latest('payment_charge_batch', sqlerrm);
    raise;
end;
$$;

comment on function public.cron_payment_charge_batch(int) is
  'pg_cron entrypoint: runs orphan recovery then payment_claim_charge_batch. Schedule this, not claim alone.';

revoke all on function public.cron_payment_recover_orphaned_schedules() from public;
revoke all on function public.cron_payment_recover_orphaned_schedules() from anon;
revoke all on function public.cron_payment_recover_orphaned_schedules() from authenticated;
revoke all on function public.cron_payment_charge_batch(int) from public;
revoke all on function public.cron_payment_charge_batch(int) from anon;
revoke all on function public.cron_payment_charge_batch(int) from authenticated;

grant execute on function public.cron_payment_recover_orphaned_schedules() to postgres;
grant execute on function public.cron_payment_charge_batch(int) to postgres;

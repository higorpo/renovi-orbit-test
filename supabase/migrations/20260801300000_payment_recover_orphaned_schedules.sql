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
begin
  if coalesce(auth.role(), '') <> 'service_role' then
    raise exception 'service_role required for payment_recover_orphaned_schedules'
      using errcode = '42501';
  end if;

  v_retry_minutes := public.platform_constant_int('charge_retry_interval_minutes', 30);

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
        when o.manual_attempt_count > 0 then 'FAILED'::public.payment_schedule_state
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
  ),
  audit_insert as (
    insert into public.payment_audit_log (
      event_type,
      entity_type,
      entity_id,
      service_id,
      schedule_id,
      from_state,
      to_state,
      actor,
      metadata
    )
    select
      'ORPHAN_RECOVERED',
      'payment_schedule',
      u.id,
      u.contracted_service_id,
      u.id,
      'PROCESSING',
      u.new_state::text,
      'system'::public.payment_audit_actor,
      jsonb_build_object(
        'recovered_at', now(),
        'locked_until_was', u.locked_until,
        'automatic_attempt_count', u.automatic_attempt_count,
        'manual_attempt_count', u.manual_attempt_count
      )
    from updated u
    returning 1
  ),
  stats as (
    select
      count(*)::int as recovered_count,
      count(*) filter (
        where new_state = 'SCHEDULED'::public.payment_schedule_state
      )::int as recovered_to_scheduled,
      count(*) filter (
        where new_state = 'FAILED'::public.payment_schedule_state
      )::int as recovered_to_failed
    from updated
  )
  select s.recovered_count, s.recovered_to_scheduled, s.recovered_to_failed
  into v_count, v_sched, v_fail
  from stats s;

  return query
  select coalesce(v_count, 0), coalesce(v_sched, 0), coalesce(v_fail, 0);
end;
$$;

comment on function public.payment_recover_orphaned_schedules() is
  'Janitor: expired PROCESSING leases → SCHEDULED, FAILED, or IN_ANALYSIS (uncertain gateway outcome). Run with reconcile cron before charge cron.';

revoke all on function public.payment_recover_orphaned_schedules() from public;
revoke all on function public.payment_recover_orphaned_schedules() from anon;
revoke all on function public.payment_recover_orphaned_schedules() from authenticated;

grant execute on function public.payment_recover_orphaned_schedules() to service_role;

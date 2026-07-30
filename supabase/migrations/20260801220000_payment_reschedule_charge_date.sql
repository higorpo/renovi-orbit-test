-- Payment Task 24: payment_reschedule_charge_date RPC (design.md §3.0, Req 9).
-- Post-PAID far reschedule (> threshold days): mark far_recapture_pending_at + wake EF.

create or replace function public.payment_schedule_state_is_terminal(
  p_state public.payment_schedule_state
)
returns boolean
language sql
immutable
as $$
  select p_state in (
    'REFUNDED'::public.payment_schedule_state,
    'PARTIALLY_REFUNDED'::public.payment_schedule_state,
    'CANCELLED'::public.payment_schedule_state,
    'VOIDED'::public.payment_schedule_state,
    'EXPIRED'::public.payment_schedule_state
  );
$$;

comment on function public.payment_schedule_state_is_terminal(public.payment_schedule_state) is
  'True for terminal payment_schedules states excluded from one-active-per-service unique index.';

create or replace function public.payment_reschedule_charge_date(
  p_contracted_service_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_cs public.contracted_services%rowtype;
  v_schedule public.payment_schedules%rowtype;
  v_exec_at timestamptz;
  v_new_charge_at timestamptz;
  v_old_charge_at timestamptz;
  v_threshold_days int;
  v_far boolean;
begin
  if coalesce(auth.role(), '') <> 'service_role' then
    raise exception 'service_role required for payment_reschedule_charge_date'
      using errcode = '42501';
  end if;

  if p_contracted_service_id is null then
    raise exception 'p_contracted_service_id is required'
      using errcode = '22023';
  end if;

  select *
  into v_cs
  from public.contracted_services cs
  where cs.id = p_contracted_service_id;

  if not found then
    raise exception 'CONTRACTED_SERVICE_NOT_FOUND'
      using errcode = 'P0002';
  end if;

  select *
  into v_schedule
  from public.payment_schedules ps
  where ps.contracted_service_id = p_contracted_service_id
    and not public.payment_schedule_state_is_terminal(ps.state)
  for update;

  if not found then
    return jsonb_build_object('outcome', 'no_schedule');
  end if;

  if v_schedule.state = 'PAID' then
    v_exec_at := public.payment_service_execution_at(v_cs);
    v_threshold_days := public.platform_constant_int(
      'far_reschedule_recapture_threshold_days',
      15
    );
    v_far := v_exec_at > (now() + make_interval(days => v_threshold_days));

    if v_far then
      if v_schedule.far_recapture_pending_at is null then
        update public.payment_schedules ps
        set
          far_recapture_pending_at = now(),
          updated_at = now()
        where ps.id = v_schedule.id;

        perform public.payment_write_audit(
          p_event_type := 'FAR_RESCHEDULE_RECAPTURE_PENDING',
          p_entity_type := 'payment_schedule',
          p_entity_id := v_schedule.id,
          p_service_id := p_contracted_service_id,
          p_schedule_id := v_schedule.id,
          p_actor := 'system',
          p_metadata := jsonb_build_object(
            'execution_at', v_exec_at,
            'threshold_days', v_threshold_days
          )
        );
      end if;

      -- Wake via orbit_invoke_edge_function is added in a later migration
      -- (after orbit_internal_edge_function_auth exists).

      return jsonb_build_object(
        'outcome', 'paid_far_recapture_required',
        'schedule_id', v_schedule.id,
        'execution_at', v_exec_at,
        'threshold_days', v_threshold_days
      );
    end if;

    return jsonb_build_object(
      'outcome', 'paid_no_charge_update',
      'schedule_id', v_schedule.id
    );
  end if;

  if v_schedule.state not in ('SCHEDULED', 'FAILED', 'IN_ANALYSIS') then
    return jsonb_build_object(
      'outcome', 'ineligible_state',
      'schedule_id', v_schedule.id,
      'state', v_schedule.state
    );
  end if;

  v_exec_at := public.payment_service_execution_at(v_cs);
  v_old_charge_at := v_schedule.charge_scheduled_at;
  v_new_charge_at := public.payment_compute_charge_scheduled_at(v_cs);

  update public.payment_schedules ps
  set
    charge_scheduled_at = v_new_charge_at,
    upcoming_charge_notified_at = null,
    updated_at = now()
  where ps.id = v_schedule.id;

  perform public.payment_write_audit(
    p_event_type := 'CHARGE_RESCHEDULED',
    p_entity_type := 'payment_schedule',
    p_entity_id := v_schedule.id,
    p_service_id := p_contracted_service_id,
    p_schedule_id := v_schedule.id,
    p_actor := 'system',
    p_metadata := jsonb_build_object(
      'old_charge_scheduled_at', v_old_charge_at,
      'new_charge_scheduled_at', v_new_charge_at,
      'emergency_scheduling', v_new_charge_at <= now()
    )
  );

  return jsonb_build_object(
    'outcome', 'rescheduled',
    'schedule_id', v_schedule.id,
    'old_charge_scheduled_at', v_old_charge_at,
    'new_charge_scheduled_at', v_new_charge_at
  );
end;
$$;

comment on function public.payment_reschedule_charge_date(uuid) is
  'Recomputes charge_scheduled_at after slot reschedule; post-PAID near keeps money; far marks recapture pending + wakes EF (service_role).';

revoke all on function public.payment_schedule_state_is_terminal(public.payment_schedule_state) from public;
revoke all on function public.payment_schedule_state_is_terminal(public.payment_schedule_state) from anon;
revoke all on function public.payment_schedule_state_is_terminal(public.payment_schedule_state) from authenticated;
grant execute on function public.payment_schedule_state_is_terminal(public.payment_schedule_state) to authenticated;
grant execute on function public.payment_schedule_state_is_terminal(public.payment_schedule_state) to service_role;

revoke all on function public.payment_reschedule_charge_date(uuid) from public;
revoke all on function public.payment_reschedule_charge_date(uuid) from anon;
revoke all on function public.payment_reschedule_charge_date(uuid) from authenticated;

grant execute on function public.payment_reschedule_charge_date(uuid) to service_role;

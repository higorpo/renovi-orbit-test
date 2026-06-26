-- Payment Task 24: payment_reschedule_charge_date RPC (design.md §3.0, Req 9).

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
  for update;

  if not found then
    return jsonb_build_object('outcome', 'no_schedule');
  end if;

  if v_schedule.state = 'PAID' then
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
  'Recomputes charge_scheduled_at from payment_service_execution_at after slot reschedule (service_role).';

revoke all on function public.payment_reschedule_charge_date(uuid) from public;
revoke all on function public.payment_reschedule_charge_date(uuid) from anon;
revoke all on function public.payment_reschedule_charge_date(uuid) from authenticated;

grant execute on function public.payment_reschedule_charge_date(uuid) to service_role;

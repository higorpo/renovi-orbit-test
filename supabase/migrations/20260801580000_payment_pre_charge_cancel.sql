-- Payment Task 68 support: pre-PAID cancellation before gateway refund (design.md §4.8).

create or replace function public.payment_pre_charge_cancel(
  p_service_id uuid,
  p_actor_id uuid,
  p_cancellation_reason text default null,
  p_initiator text default 'client'
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_service public.contracted_services%rowtype;
  v_schedule public.payment_schedules%rowtype;
  v_reason text;
  v_actor public.payment_audit_actor;
begin
  if coalesce(auth.role(), '') <> 'service_role' then
    raise exception 'service_role required for payment_pre_charge_cancel'
      using errcode = '42501';
  end if;

  if p_initiator not in ('client', 'provider') then
    raise exception 'INVALID_INITIATOR'
      using errcode = 'P0001';
  end if;

  select cs.*
  into v_service
  from public.contracted_services cs
  where cs.id = p_service_id
  for update;

  if not found then
    raise exception 'SERVICE_NOT_FOUND'
      using errcode = 'P0002';
  end if;

  if p_initiator = 'client' and v_service.client_id <> p_actor_id then
    raise exception 'FORBIDDEN'
      using errcode = '42501';
  end if;

  if p_initiator = 'provider' and v_service.provider_id <> p_actor_id then
    raise exception 'FORBIDDEN'
      using errcode = '42501';
  end if;

  if v_service.status = 'COMPLETED'::public.contracted_service_status then
    raise exception 'SERVICE_NOT_CANCELLABLE'
      using errcode = 'P0001';
  end if;

  select ps.*
  into v_schedule
  from public.payment_schedules ps
  where ps.contracted_service_id = p_service_id
  for update;

  if not found then
    raise exception 'SCHEDULE_NOT_FOUND'
      using errcode = 'P0002';
  end if;

  if v_schedule.state = 'IN_ANALYSIS'::public.payment_schedule_state then
    raise exception 'PAYMENT_IN_ANALYSIS'
      using errcode = 'P0001';
  end if;

  if v_schedule.state not in (
    'SCHEDULED'::public.payment_schedule_state,
    'FAILED'::public.payment_schedule_state,
    'FAILED_PERMANENT'::public.payment_schedule_state
  ) then
    raise exception 'INVALID_SCHEDULE_STATE'
      using errcode = 'P0001';
  end if;

  v_reason := coalesce(
    nullif(btrim(p_cancellation_reason), ''),
    case p_initiator
      when 'client' then 'CLIENT_INITIATED'
      else 'PROVIDER_INITIATED'
    end
  );

  v_actor := case p_initiator
    when 'client' then 'client'::public.payment_audit_actor
    else 'provider'::public.payment_audit_actor
  end;

  update public.contracted_services cs
  set
    status = 'CANCELLED'::public.contracted_service_status,
    cancellation_reason = v_reason
  where cs.id = p_service_id;

  update public.payment_schedules ps
  set
    state = 'CANCELLED'::public.payment_schedule_state,
    cancelled_at = now(),
    cancellation_reason = v_reason,
    updated_at = now()
  where ps.id = v_schedule.id;

  perform public.payment_write_audit(
    p_event_type := 'PRE_CHARGE_CANCELLED',
    p_entity_type := 'payment_schedule',
    p_entity_id := v_schedule.id,
    p_service_id := p_service_id,
    p_schedule_id := v_schedule.id,
    p_from_state := v_schedule.state::text,
    p_to_state := 'CANCELLED',
    p_actor := v_actor,
    p_actor_id := p_actor_id,
    p_metadata := jsonb_build_object(
      'cancellation_reason', v_reason,
      'initiator', p_initiator
    )
  );

  perform public.payment_write_event(
    p_event_type := 'ServiceAutoCancelled',
    p_aggregate_type := 'payment_schedule',
    p_aggregate_id := v_schedule.id,
    p_service_id := p_service_id,
    p_payload := jsonb_build_object(
      'schedule_id', v_schedule.id,
      'cancellation_reason', v_reason,
      'pre_charge', true
    )
  );

  return v_schedule.id;
end;
$$;

comment on function public.payment_pre_charge_cancel(uuid, uuid, text, text) is
  'Cancels unpaid schedule and contracted service before first successful charge (service_role only).';

revoke all on function public.payment_pre_charge_cancel(uuid, uuid, text, text) from public;
revoke all on function public.payment_pre_charge_cancel(uuid, uuid, text, text) from anon;
revoke all on function public.payment_pre_charge_cancel(uuid, uuid, text, text) from authenticated;

grant execute on function public.payment_pre_charge_cancel(uuid, uuid, text, text) to service_role;

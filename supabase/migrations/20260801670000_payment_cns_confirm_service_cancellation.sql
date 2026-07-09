-- Payment Task 87: hook CNS cancellation confirm to payment cancel/refund paths (Req 14 AC4, Req 15 AC4–AC9).

create or replace function public.cns_confirm_service_cancellation(
  p_contracted_service_id uuid,
  p_cancellation_reason text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_cs public.contracted_services%rowtype;
  v_schedule public.payment_schedules%rowtype;
  v_actor_id uuid;
  v_initiator text;
  v_schedule_id uuid;
  v_payment jsonb;
begin
  if p_contracted_service_id is null then
    raise exception 'p_contracted_service_id is required'
      using errcode = '22023';
  end if;

  v_actor_id := auth.uid();
  if v_actor_id is null then
    raise exception 'Authentication required for cns_confirm_service_cancellation'
      using errcode = '42501';
  end if;

  select cs.*
  into v_cs
  from public.contracted_services cs
  where cs.id = p_contracted_service_id
  for update;

  if not found then
    raise exception 'CONTRACTED_SERVICE_NOT_FOUND'
      using errcode = 'P0002';
  end if;

  if v_actor_id = v_cs.client_id then
    v_initiator := 'client';
  elsif v_actor_id = v_cs.provider_id then
    v_initiator := 'provider';
  else
    raise exception 'FORBIDDEN'
      using errcode = '42501';
  end if;

  if v_cs.status = 'CANCELLED'::public.contracted_service_status then
    return jsonb_build_object(
      'outcome', 'already_cancelled',
      'contracted_service_id', p_contracted_service_id
    );
  end if;

  if v_cs.status = 'COMPLETED'::public.contracted_service_status then
    raise exception 'SERVICE_NOT_CANCELLABLE'
      using errcode = 'P0001';
  end if;

  select ps.*
  into v_schedule
  from public.payment_schedules ps
  where ps.contracted_service_id = p_contracted_service_id;

  if not found then
    perform public.cns_cancel_active_service_reschedule_requests(p_contracted_service_id);

    update public.contracted_services cs
    set
      status = 'CANCELLED'::public.contracted_service_status,
      cancellation_reason = coalesce(
        nullif(btrim(p_cancellation_reason), ''),
        case v_initiator
          when 'client' then 'CLIENT_INITIATED'
          else 'PROVIDER_INITIATED'
        end
      )
    where cs.id = p_contracted_service_id;

    return jsonb_build_object(
      'outcome', 'cancelled_no_schedule',
      'contracted_service_id', p_contracted_service_id,
      'initiator', v_initiator
    );
  end if;

  if v_schedule.state = 'IN_ANALYSIS'::public.payment_schedule_state then
    raise exception 'PAYMENT_IN_ANALYSIS'
      using errcode = 'P0001';
  end if;

  if v_schedule.state in (
    'SCHEDULED'::public.payment_schedule_state,
    'FAILED'::public.payment_schedule_state,
    'FAILED_PERMANENT'::public.payment_schedule_state
  ) then
    perform set_config('request.jwt.claim.role', 'service_role', true);
    perform set_config(
      'request.jwt.claims',
      json_build_object('role', 'service_role')::text,
      true
    );

    v_schedule_id := public.payment_pre_charge_cancel(
      p_service_id := p_contracted_service_id,
      p_actor_id := v_actor_id,
      p_cancellation_reason := p_cancellation_reason,
      p_initiator := v_initiator
    );

    raise log 'cns_confirm_service_cancellation service_id=% actor_id=% outcome=pre_charge_cancelled schedule_id=%',
      p_contracted_service_id,
      v_actor_id,
      v_schedule_id;

    return jsonb_build_object(
      'outcome', 'pre_charge_cancelled',
      'contracted_service_id', p_contracted_service_id,
      'schedule_id', v_schedule_id,
      'initiator', v_initiator
    );
  end if;

  if v_schedule.state in (
    'PAID'::public.payment_schedule_state,
    'REFUND_REQUESTED'::public.payment_schedule_state
  ) then
    return jsonb_build_object(
      'outcome', 'requires_process_refund_ef',
      'contracted_service_id', p_contracted_service_id,
      'schedule_id', v_schedule.id,
      'schedule_state', v_schedule.state,
      'initiator', v_initiator
    );
  end if;

  if v_schedule.state = 'CANCELLED'::public.payment_schedule_state then
    return jsonb_build_object(
      'outcome', 'already_cancelled',
      'contracted_service_id', p_contracted_service_id,
      'schedule_id', v_schedule.id
    );
  end if;

  raise exception 'INVALID_SCHEDULE_STATE'
    using errcode = 'P0001';
end;
$$;

comment on function public.cns_confirm_service_cancellation(uuid, text) is
  'Confirms service cancellation: pre-PAID via payment_pre_charge_cancel; post-PAID routes to process-refund EF; blocks IN_ANALYSIS.';

revoke all on function public.cns_confirm_service_cancellation(uuid, text) from public;
revoke all on function public.cns_confirm_service_cancellation(uuid, text) from anon;
revoke all on function public.cns_confirm_service_cancellation(uuid, text) from service_role;

grant execute on function public.cns_confirm_service_cancellation(uuid, text) to authenticated;

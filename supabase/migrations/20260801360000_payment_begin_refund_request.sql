-- Payment Task 38: payment_begin_refund_request RPC (design.md §4.8, Req 15 AC1–AC3).

create or replace function public.payment_calculate_refund_amount(
  p_charge_amount numeric,
  p_base_amount numeric,
  p_service_scheduled_at timestamptz,
  p_initiator text,
  p_now timestamptz default now()
)
returns jsonb
language plpgsql
stable
set search_path = public
as $$
declare
  v_hours numeric;
  v_refund_amount numeric(12, 2);
  v_penalty_tier text;
begin
  if p_initiator not in ('client', 'provider') then
    raise exception 'INVALID_INITIATOR'
      using errcode = '22023';
  end if;

  if p_charge_amount is null or p_charge_amount < 0 then
    raise exception 'INVALID_CHARGE_AMOUNT'
      using errcode = '22023';
  end if;

  if p_base_amount is null or p_base_amount <= 0 then
    raise exception 'INVALID_BASE_AMOUNT'
      using errcode = '22023';
  end if;

  if p_initiator = 'provider' then
    return jsonb_build_object(
      'refund_amount', round(p_charge_amount, 2),
      'penalty_tier', 'PROVIDER_FULL_REFUND'
    );
  end if;

  v_hours := extract(epoch from (p_service_scheduled_at - p_now)) / 3600.0;

  -- FULL_REFUND: entire amount paid (base + card fees). Penalty tiers apply to base_amount only.
  if v_hours > 48 then
    v_refund_amount := round(p_charge_amount, 2);
    v_penalty_tier := 'FULL_REFUND';
  elsif v_hours >= 12 then
    v_refund_amount := round(p_base_amount * 0.90, 2);
    v_penalty_tier := 'PENALTY_10';
  else
    v_refund_amount := round(p_base_amount * 0.70, 2);
    v_penalty_tier := 'PENALTY_30';
  end if;

  return jsonb_build_object(
    'refund_amount', v_refund_amount,
    'penalty_tier', v_penalty_tier
  );
end;
$$;

create or replace function public.payment_begin_refund_request(
  p_service_id uuid,
  p_actor_id uuid,
  p_cancellation_reason text default null,
  p_initiator text default 'client'
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_service public.contracted_services%rowtype;
  v_schedule public.payment_schedules%rowtype;
  v_reason text;
  v_exec_at timestamptz;
  v_charge_amount numeric(12, 2);
  v_refund jsonb;
  v_refund_amount numeric(12, 2);
  v_penalty_tier text;
  v_actor public.payment_audit_actor;
begin
  if coalesce(auth.role(), '') <> 'service_role' then
    raise exception 'service_role required for payment_begin_refund_request'
      using errcode = '42501';
  end if;

  if p_service_id is null or p_actor_id is null then
    raise exception 'p_service_id and p_actor_id are required'
      using errcode = '22023';
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
    and ps.state = 'PAID'::public.payment_schedule_state
  for update;

  if not found then
    if exists (
      select 1
      from public.payment_schedules ps
      where ps.contracted_service_id = p_service_id
        and ps.state = 'IN_ANALYSIS'::public.payment_schedule_state
    ) then
      raise exception 'PAYMENT_IN_ANALYSIS'
        using errcode = 'P0001';
    end if;

    if exists (
      select 1
      from public.payment_schedules ps
      where ps.contracted_service_id = p_service_id
        and ps.state = 'REFUND_REQUESTED'::public.payment_schedule_state
    ) then
      select ps.*
      into v_schedule
      from public.payment_schedules ps
      where ps.contracted_service_id = p_service_id
        and ps.state = 'REFUND_REQUESTED'::public.payment_schedule_state
      for update;

      return jsonb_build_object(
        'schedule_id', v_schedule.id,
        'gateway_transaction_id', v_schedule.gateway_transaction_id,
        'paid_amount', v_schedule.paid_amount,
        'base_amount', v_schedule.base_amount,
        'refund_amount', v_schedule.refunded_amount,
        'penalty_tier', null,
        'already_submitted', true
      );
    end if;

    raise exception 'INVALID_SCHEDULE_STATE'
      using errcode = 'P0001';
  end if;

  if v_schedule.gateway_transaction_id is null then
    raise exception 'TRANSACTION_NOT_FOUND'
      using errcode = 'P0001';
  end if;

  v_exec_at := public.payment_service_execution_at(v_service);

  v_charge_amount := coalesce(
    v_schedule.paid_amount,
    public.payment_calculate_charge_amount(
      v_schedule.client_card_token_id,
      v_schedule.base_amount,
      v_schedule.installment_number
    )
  );

  v_refund := public.payment_calculate_refund_amount(
    v_charge_amount,
    v_schedule.base_amount,
    v_exec_at,
    p_initiator
  );

  v_refund_amount := (v_refund->>'refund_amount')::numeric(12, 2);
  v_penalty_tier := v_refund->>'penalty_tier';

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

  update public.payment_schedules ps
  set
    state = 'REFUND_REQUESTED'::public.payment_schedule_state,
    cancellation_reason = v_reason,
    updated_at = now()
  where ps.id = v_schedule.id;

  update public.contracted_services cs
  set
    status = 'CANCELLED'::public.contracted_service_status,
    cancellation_reason = v_reason
  where cs.id = p_service_id;

  perform public.payment_write_audit(
    p_event_type := 'REFUND_SUBMITTED',
    p_entity_type := 'payment_schedule',
    p_entity_id := v_schedule.id,
    p_service_id := p_service_id,
    p_schedule_id := v_schedule.id,
    p_from_state := v_schedule.state::text,
    p_to_state := 'REFUND_REQUESTED',
    p_actor := v_actor,
    p_actor_id := p_actor_id,
    p_metadata := jsonb_build_object(
      'refund_amount', v_refund_amount,
      'penalty_tier', v_penalty_tier,
      'charge_amount', v_charge_amount,
      'cancellation_reason', v_reason,
      'initiator', p_initiator
    )
  );

  perform public.payment_write_event(
    p_event_type := 'RefundRequested',
    p_aggregate_type := 'payment_schedule',
    p_aggregate_id := v_schedule.id,
    p_service_id := p_service_id,
    p_payload := jsonb_build_object(
      'refund_amount', v_refund_amount,
      'penalty_tier', v_penalty_tier,
      'initiator', p_initiator
    )
  );

  return jsonb_build_object(
    'schedule_id', v_schedule.id,
    'gateway_transaction_id', v_schedule.gateway_transaction_id,
    'paid_amount', v_schedule.paid_amount,
    'base_amount', v_schedule.base_amount,
    'charge_amount', v_charge_amount,
    'refund_amount', v_refund_amount,
    'penalty_tier', v_penalty_tier,
    'already_submitted', false
  );
end;
$$;

comment on function public.payment_calculate_refund_amount(numeric, numeric, timestamptz, text, timestamptz) is
  'ToS §2.2 refund tiers: FULL_REFUND and provider cancel use charge_amount (incl. card fees); PENALTY_* use base_amount only.';

comment on function public.payment_begin_refund_request(uuid, uuid, text, text) is
  'Computes refund amount, transitions schedule to REFUND_REQUESTED, cancels service (service_role only).';

revoke all on function public.payment_calculate_refund_amount(numeric, numeric, timestamptz, text, timestamptz)
  from public, anon, authenticated;

revoke all on function public.payment_begin_refund_request(uuid, uuid, text, text) from public;
revoke all on function public.payment_begin_refund_request(uuid, uuid, text, text) from anon;
revoke all on function public.payment_begin_refund_request(uuid, uuid, text, text) from authenticated;

grant execute on function public.payment_calculate_refund_amount(numeric, numeric, timestamptz, text, timestamptz)
  to service_role;
grant execute on function public.payment_begin_refund_request(uuid, uuid, text, text) to service_role;

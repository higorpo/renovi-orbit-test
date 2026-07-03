-- Payment Task 89: platform_rate_limits on manual charge RPC (design.md §11.4).
-- Restores rate limit dropped when payment_begin_manual_attempt was superseded in 20260801630000+.

create or replace function public.payment_begin_manual_attempt(
  p_schedule_id uuid,
  p_client_id uuid,
  p_clearsale_session_id text,
  p_client_ip_address text default null,
  p_actor_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_schedule public.payment_schedules%rowtype;
  v_service public.contracted_services%rowtype;
  v_cancel_hours int;
  v_lease_minutes int;
  v_from_state text;
  v_exec_at timestamptz;
  v_rate_limit jsonb;
begin
  if coalesce(auth.role(), '') <> 'service_role' then
    raise exception 'service_role required for payment_begin_manual_attempt'
      using errcode = '42501';
  end if;

  v_rate_limit := public.platform_check_rate_limit(
    format('manual_charge:%s', p_client_id),
    10
  );

  if not coalesce((v_rate_limit->>'allowed')::boolean, false) then
    raise exception 'RATE_LIMIT_EXCEEDED'
      using errcode = 'P0001';
  end if;

  if p_clearsale_session_id is null or btrim(p_clearsale_session_id) = '' then
    raise exception 'CLEARSALE_SESSION_REQUIRED'
      using errcode = 'P0001';
  end if;

  select ps.*
  into v_schedule
  from public.payment_schedules ps
  where ps.id = p_schedule_id
    and ps.client_id = p_client_id
  for update skip locked;

  if not found then
    if exists (
      select 1
      from public.payment_schedules ps
      where ps.id = p_schedule_id
        and ps.client_id = p_client_id
    ) then
      raise exception 'PAYMENT_ALREADY_IN_PROGRESS'
        using
          errcode = 'P0001',
          detail = jsonb_build_object('code', 'PAYMENT_ALREADY_IN_PROGRESS')::text;
    end if;

    raise exception 'SCHEDULE_NOT_FOUND'
      using errcode = 'P0002';
  end if;

  select cs.*
  into v_service
  from public.contracted_services cs
  where cs.id = v_schedule.contracted_service_id;

  if not found or v_service.client_id <> p_client_id then
    raise exception 'SCHEDULE_NOT_FOUND'
      using errcode = 'P0002';
  end if;

  if v_service.status = 'CANCELLED'::public.contracted_service_status then
    raise exception 'SERVICE_CANCELLED'
      using errcode = 'P0001';
  end if;

  if v_schedule.state not in ('FAILED', 'FAILED_PERMANENT') then
    raise exception 'INVALID_SCHEDULE_STATE'
      using
        errcode = 'P0001',
        detail = jsonb_build_object('code', 'INVALID_SCHEDULE_STATE')::text;
  end if;

  v_exec_at := public.payment_service_execution_at(v_service);
  v_cancel_hours := public.platform_constant_int('auto_cancel_hours_before_service', 12);

  if v_exec_at - now() <= make_interval(hours => v_cancel_hours) then
    raise exception 'SERVICE_AUTO_CANCELLED'
      using errcode = 'P0001';
  end if;

  if v_schedule.client_card_token_id is not null
    and not exists (
      select 1
      from public.client_card_tokens cct
      where cct.id = v_schedule.client_card_token_id
        and cct.client_id = p_client_id
        and cct.state = 'ACTIVE'::public.payment_client_card_token_state
        and not public.payment_client_card_token_is_expired(cct.expiry_month, cct.expiry_year)
    ) then
    raise exception 'PAYMENT_TOKEN_INACTIVE'
      using
        errcode = 'P0001',
        detail = jsonb_build_object('code', 'PAYMENT_TOKEN_INACTIVE')::text;
  end if;

  v_lease_minutes := public.platform_constant_int('payment_lease_duration_minutes', 10);
  v_from_state := v_schedule.state;

  update public.payment_schedules ps
  set
    state = 'PROCESSING',
    locked_until = now() + make_interval(mins => v_lease_minutes),
    manual_attempt_count = ps.manual_attempt_count + 1,
    clearsale_session_id = trim(p_clearsale_session_id),
    client_ip_address = nullif(trim(coalesce(p_client_ip_address, '')), ''),
    updated_at = now()
  where ps.id = v_schedule.id
  returning * into v_schedule;

  perform public.payment_write_audit(
    p_event_type := 'MANUAL_PAYMENT_INITIATED',
    p_entity_type := 'payment_schedule',
    p_entity_id := v_schedule.id,
    p_service_id := v_schedule.contracted_service_id,
    p_schedule_id := v_schedule.id,
    p_from_state := v_from_state,
    p_to_state := 'PROCESSING',
    p_actor := 'client',
    p_actor_id := coalesce(p_actor_id, p_client_id),
    p_metadata := jsonb_build_object(
      'clearsale_session_id', trim(p_clearsale_session_id),
      'manual_attempt_count', v_schedule.manual_attempt_count
    )
  );

  perform public.payment_write_event(
    p_event_type := 'ManualPaymentInitiated',
    p_aggregate_type := 'payment_schedule',
    p_aggregate_id := v_schedule.id,
    p_service_id := v_schedule.contracted_service_id,
    p_payload := jsonb_build_object(
      'manual_attempt_count', v_schedule.manual_attempt_count,
      'gateway_slug', v_schedule.gateway_slug,
      'initiator', 'client'
    )
  );

  perform public.payment_raise_log(
    'manual_payment_initiated',
    v_schedule.contracted_service_id,
    v_schedule.id,
    jsonb_build_object(
      'gateway_slug', v_schedule.gateway_slug,
      'manual_attempt_count', v_schedule.manual_attempt_count,
      'initiator', 'client'
    )
  );

  return jsonb_build_object(
    'id', v_schedule.id,
    'contracted_service_id', v_schedule.contracted_service_id,
    'client_id', v_schedule.client_id,
    'provider_id', v_schedule.provider_id,
    'gateway_slug', v_schedule.gateway_slug,
    'client_card_token_id', v_schedule.client_card_token_id,
    'installment_number', v_schedule.installment_number,
    'base_amount', v_schedule.base_amount,
    'state', v_schedule.state,
    'manual_attempt_count', v_schedule.manual_attempt_count,
    'automatic_attempt_count', v_schedule.automatic_attempt_count,
    'max_attempts', v_schedule.max_attempts,
    'clearsale_session_id', v_schedule.clearsale_session_id,
    'client_ip_address', v_schedule.client_ip_address,
    'charge_amount', public.payment_calculate_charge_amount(
      v_schedule.client_card_token_id,
      v_schedule.base_amount,
      v_schedule.installment_number
    )
  );
end;
$$;

comment on function public.payment_begin_manual_attempt(uuid, uuid, text, text, uuid) is
  'Manual charge lease: rate-limited via platform_rate_limits (10/min per client), T-12h gate, increments manual_attempt_count.';

revoke all on function public.payment_begin_manual_attempt(uuid, uuid, text, text, uuid) from public;
revoke all on function public.payment_begin_manual_attempt(uuid, uuid, text, text, uuid) from anon;
revoke all on function public.payment_begin_manual_attempt(uuid, uuid, text, text, uuid) from authenticated;

grant execute on function public.payment_begin_manual_attempt(uuid, uuid, text, text, uuid) to service_role;

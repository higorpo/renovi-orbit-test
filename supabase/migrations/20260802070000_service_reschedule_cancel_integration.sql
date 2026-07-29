-- Cancel active reschedule requests when contracted service is cancelled.

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

  perform public.cns_cancel_active_service_reschedule_requests(p_service_id);

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

  perform public.cns_close_contracted_service_chat(
    p_contracted_service_id := p_service_id,
    p_closed_by_user_id := p_actor_id,
    p_initiator := p_initiator,
    p_cancellation_reason := v_reason,
    p_pre_charge := true
  );

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

-- Shared cancel + chat close for post-gateway refund commit / webhook / reconcile.
create or replace function public.payment_complete_refund_domain_side_effects(
  p_service_id uuid,
  p_closed_by_user_id uuid default null,
  p_initiator text default 'system',
  p_cancellation_reason text default null,
  p_refund_tier text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_service public.contracted_services%rowtype;
  v_reason text;
begin
  if p_initiator not in ('client', 'provider', 'system') then
    raise exception 'INVALID_INITIATOR'
      using errcode = '22023';
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

  v_reason := coalesce(
    nullif(btrim(p_cancellation_reason), ''),
    nullif(btrim(v_service.cancellation_reason), ''),
    'CLIENT_INITIATED'
  );

  if v_service.status <> 'CANCELLED'::public.contracted_service_status then
    perform public.cns_cancel_active_service_reschedule_requests(p_service_id);

    update public.contracted_services cs
    set
      status = 'CANCELLED'::public.contracted_service_status,
      cancellation_reason = v_reason
    where cs.id = p_service_id;
  end if;

  perform public.cns_close_contracted_service_chat(
    p_contracted_service_id := p_service_id,
    p_closed_by_user_id := p_closed_by_user_id,
    p_initiator := p_initiator,
    p_cancellation_reason := v_reason,
    p_refund_tier := p_refund_tier,
    p_pre_charge := false
  );
end;
$$;

comment on function public.payment_complete_refund_domain_side_effects(uuid, uuid, text, text, text) is
  'Cancels contracted service (if needed) and closes chat for post-PAID refund flows; idempotent when already CANCELLED.';

revoke all on function public.payment_complete_refund_domain_side_effects(uuid, uuid, text, text, text)
  from public, anon, authenticated;
grant execute on function public.payment_complete_refund_domain_side_effects(uuid, uuid, text, text, text)
  to service_role;

-- Option A: validate PAID refund eligibility without mutating schedule/service/chat.
create or replace function public.payment_prepare_refund_request(
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
  v_exec_at timestamptz;
  v_charge_amount numeric(12, 2);
  v_refund jsonb;
  v_refund_amount numeric(12, 2);
  v_penalty_tier text;
begin
  if coalesce(auth.role(), '') <> 'service_role' then
    raise exception 'service_role required for payment_prepare_refund_request'
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

  return jsonb_build_object(
    'schedule_id', v_schedule.id,
    'gateway_transaction_id', v_schedule.gateway_transaction_id,
    'paid_amount', v_schedule.paid_amount,
    'base_amount', v_schedule.base_amount,
    'charge_amount', v_charge_amount,
    'refund_amount', v_refund_amount,
    'penalty_tier', v_penalty_tier,
    'already_submitted', false,
    'refund_submit_status', null,
    'path', 'fresh'
  );
end;
$$;

comment on function public.payment_prepare_refund_request(uuid, uuid, text, text) is
  'Validates PAID refund eligibility and returns ToS amounts without cancelling service/chat (Option A gateway-first). service_role only.';

revoke all on function public.payment_prepare_refund_request(uuid, uuid, text, text)
  from public, anon, authenticated;
grant execute on function public.payment_prepare_refund_request(uuid, uuid, text, text)
  to service_role;

-- Greenfield: cancel-first begin RPC removed. Callers use prepare + commit only.
drop function if exists public.payment_begin_refund_request(uuid, uuid, text, text);

-- Called only after gateway success / ALREADY_REFUNDED: cancel + REFUND_REQUESTED + SUBMITTED.
create or replace function public.payment_commit_refund_after_gateway(
  p_service_id uuid,
  p_actor_id uuid,
  p_cancellation_reason text default null,
  p_initiator text default 'client',
  p_expected_refund_amount numeric default null
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
  v_already_submitted boolean;
begin
  if coalesce(auth.role(), '') <> 'service_role' then
    raise exception 'service_role required for payment_commit_refund_after_gateway'
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

  if found then
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

    if p_expected_refund_amount is not null then
      if abs(p_expected_refund_amount - v_refund_amount) > 0.01 then
        raise exception 'INVALID_REFUND_AMOUNT'
          using errcode = 'P0001';
      end if;
      v_refund_amount := round(p_expected_refund_amount::numeric, 2);
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

    update public.payment_schedules ps
    set
      state = 'REFUND_REQUESTED'::public.payment_schedule_state,
      refunded_amount = v_refund_amount,
      refund_submit_status = 'SUBMITTED'::public.payment_refund_submit_status,
      cancellation_reason = v_reason,
      updated_at = now()
    where ps.id = v_schedule.id;

    perform public.payment_complete_refund_domain_side_effects(
      p_service_id := p_service_id,
      p_closed_by_user_id := p_actor_id,
      p_initiator := p_initiator,
      p_cancellation_reason := v_reason,
      p_refund_tier := v_penalty_tier
    );

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
        'initiator', p_initiator,
        'refund_submit_status', 'SUBMITTED'
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
      'already_submitted', false,
      'refund_submit_status', 'SUBMITTED',
      'path', 'fresh'
    );
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

    v_already_submitted := v_schedule.refund_submit_status in (
      'SUBMITTED'::public.payment_refund_submit_status,
      'CONFIRMED'::public.payment_refund_submit_status
    );

    v_reason := coalesce(
      nullif(btrim(p_cancellation_reason), ''),
      nullif(btrim(v_schedule.cancellation_reason), ''),
      nullif(btrim(v_service.cancellation_reason), ''),
      case p_initiator
        when 'client' then 'CLIENT_INITIATED'
        else 'PROVIDER_INITIATED'
      end
    );

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
    v_penalty_tier := v_refund->>'penalty_tier';
    v_refund_amount := coalesce(
      v_schedule.refunded_amount,
      (v_refund->>'refund_amount')::numeric(12, 2)
    );

    if v_already_submitted then
      perform public.payment_complete_refund_domain_side_effects(
        p_service_id := p_service_id,
        p_closed_by_user_id := p_actor_id,
        p_initiator := p_initiator,
        p_cancellation_reason := v_reason,
        p_refund_tier := v_penalty_tier
      );

      return jsonb_build_object(
        'schedule_id', v_schedule.id,
        'gateway_transaction_id', v_schedule.gateway_transaction_id,
        'paid_amount', v_schedule.paid_amount,
        'base_amount', v_schedule.base_amount,
        'charge_amount', v_charge_amount,
        'refund_amount', v_refund_amount,
        'penalty_tier', v_penalty_tier,
        'already_submitted', true,
        'refund_submit_status', v_schedule.refund_submit_status,
        'path', 'already_submitted'
      );
    end if;

    -- Greenfield: REFUND_REQUESTED without gateway ACK must not exist.
    raise exception 'INVALID_SCHEDULE_STATE'
      using errcode = 'P0001';
  end if;

  raise exception 'INVALID_SCHEDULE_STATE'
    using errcode = 'P0001';
end;
$$;

comment on function public.payment_commit_refund_after_gateway(uuid, uuid, text, text, numeric) is
  'After gateway refund ACK: PAID→REFUND_REQUESTED+SUBMITTED and cancel service/chat in one TX. service_role only.';

revoke all on function public.payment_commit_refund_after_gateway(uuid, uuid, text, text, numeric)
  from public, anon, authenticated;
grant execute on function public.payment_commit_refund_after_gateway(uuid, uuid, text, text, numeric)
  to service_role;

-- Crash recovery: gateway ACK'd but commit failed — persist SUBMITTED while still PAID.
create or replace function public.payment_mark_refund_gateway_acked(
  p_schedule_id uuid,
  p_actor_id uuid default null,
  p_refunded_amount numeric default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_schedule public.payment_schedules%rowtype;
  v_actor public.payment_audit_actor;
begin
  if coalesce(auth.role(), '') <> 'service_role' then
    raise exception 'service_role required for payment_mark_refund_gateway_acked'
      using errcode = '42501';
  end if;

  if p_schedule_id is null then
    raise exception 'p_schedule_id is required'
      using errcode = '22023';
  end if;

  select ps.*
  into v_schedule
  from public.payment_schedules ps
  where ps.id = p_schedule_id
  for update;

  if not found then
    raise exception 'SCHEDULE_NOT_FOUND'
      using errcode = 'P0002';
  end if;

  if v_schedule.state <> 'PAID'::public.payment_schedule_state then
    raise exception 'INVALID_SCHEDULE_STATE'
      using errcode = 'P0001';
  end if;

  if v_schedule.refund_submit_status = 'SUBMITTED'::public.payment_refund_submit_status
    or v_schedule.refund_submit_status = 'CONFIRMED'::public.payment_refund_submit_status then
    return;
  end if;

  update public.payment_schedules ps
  set
    refund_submit_status = 'SUBMITTED'::public.payment_refund_submit_status,
    refunded_amount = coalesce(p_refunded_amount, ps.refunded_amount),
    updated_at = now()
  where ps.id = v_schedule.id;

  v_actor := case
    when p_actor_id is not null and p_actor_id = v_schedule.client_id then 'client'::public.payment_audit_actor
    when p_actor_id is not null and p_actor_id = v_schedule.provider_id then 'provider'::public.payment_audit_actor
    else 'system'::public.payment_audit_actor
  end;

  perform public.payment_write_audit(
    p_event_type := 'REFUND_GATEWAY_ACK',
    p_entity_type := 'payment_schedule',
    p_entity_id := v_schedule.id,
    p_service_id := v_schedule.contracted_service_id,
    p_schedule_id := v_schedule.id,
    p_from_state := v_schedule.state::text,
    p_to_state := v_schedule.state::text,
    p_actor := v_actor,
    p_actor_id := p_actor_id,
    p_metadata := jsonb_build_object(
      'refund_submit_status', 'SUBMITTED',
      'previous_status', v_schedule.refund_submit_status,
      'refunded_amount', coalesce(p_refunded_amount, v_schedule.refunded_amount),
      'recovery', 'gateway_acked_commit_pending'
    )
  );
end;
$$;

comment on function public.payment_mark_refund_gateway_acked(uuid, uuid, numeric) is
  'Crash recovery when gateway ACK''d but commit failed: mark PAID schedule SUBMITTED without cancelling service. service_role only.';

revoke all on function public.payment_mark_refund_gateway_acked(uuid, uuid, numeric)
  from public, anon, authenticated;
grant execute on function public.payment_mark_refund_gateway_acked(uuid, uuid, numeric)
  to service_role;

create or replace function public.payment_set_refund_submit_status(
  p_schedule_id uuid,
  p_status public.payment_refund_submit_status,
  p_actor_id uuid default null,
  p_error_message text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_schedule public.payment_schedules%rowtype;
  v_actor public.payment_audit_actor;
begin
  if coalesce(auth.role(), '') <> 'service_role' then
    raise exception 'service_role required for payment_set_refund_submit_status'
      using errcode = '42501';
  end if;

  if p_schedule_id is null or p_status is null then
    raise exception 'p_schedule_id and p_status are required'
      using errcode = '22023';
  end if;

  select ps.*
  into v_schedule
  from public.payment_schedules ps
  where ps.id = p_schedule_id
  for update;

  if not found then
    raise exception 'SCHEDULE_NOT_FOUND'
      using errcode = 'P0002';
  end if;

  if v_schedule.state <> 'REFUND_REQUESTED'::public.payment_schedule_state then
    raise exception 'INVALID_SCHEDULE_STATE'
      using errcode = 'P0001';
  end if;

  -- Do not regress CONFIRMED; SUBMITTED may still move to CONFIRMED via webhook.
  if v_schedule.refund_submit_status = 'CONFIRMED'::public.payment_refund_submit_status then
    return;
  end if;

  if p_status = 'FAILED'::public.payment_refund_submit_status
    and v_schedule.refund_submit_status = 'SUBMITTED'::public.payment_refund_submit_status then
    return;
  end if;

  update public.payment_schedules ps
  set
    refund_submit_status = p_status,
    updated_at = now()
  where ps.id = v_schedule.id;

  v_actor := case
    when p_actor_id is not null and p_actor_id = v_schedule.client_id then 'client'::public.payment_audit_actor
    when p_actor_id is not null and p_actor_id = v_schedule.provider_id then 'provider'::public.payment_audit_actor
    else 'system'::public.payment_audit_actor
  end;

  perform public.payment_write_audit(
    p_event_type := case p_status
      when 'FAILED'::public.payment_refund_submit_status then 'REFUND_FAILED'
      when 'SUBMITTED'::public.payment_refund_submit_status then 'REFUND_GATEWAY_ACK'
      when 'CONFIRMED'::public.payment_refund_submit_status then 'REFUND_CONFIRMED'
      else 'REFUND_SUBMIT_STATUS'
    end,
    p_entity_type := 'payment_schedule',
    p_entity_id := v_schedule.id,
    p_service_id := v_schedule.contracted_service_id,
    p_schedule_id := v_schedule.id,
    p_from_state := v_schedule.state::text,
    p_to_state := v_schedule.state::text,
    p_actor := v_actor,
    p_actor_id := p_actor_id,
    p_metadata := jsonb_build_object(
      'refund_submit_status', p_status,
      'previous_status', v_schedule.refund_submit_status,
      'error_message', p_error_message
    )
  );
end;
$$;

comment on function public.payment_set_refund_submit_status(uuid, public.payment_refund_submit_status, uuid, text) is
  'Updates refund_submit_status after gateway ACK/failure; service_role only (CHK-008).';

revoke all on function public.payment_set_refund_submit_status(uuid, public.payment_refund_submit_status, uuid, text)
  from public, anon, authenticated;
grant execute on function public.payment_set_refund_submit_status(uuid, public.payment_refund_submit_status, uuid, text)
  to service_role;

create or replace function public.payment_auto_cancel_services(
  p_batch_size int default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_service record;
  v_cancel_hours int;
  v_batch_size int;
  v_reason text;
  v_last_failure_reason text;
  v_results jsonb := '[]'::jsonb;
  v_errors int := 0;
begin
  if coalesce(auth.role(), '') <> 'service_role' then
    raise exception 'service_role required for payment_auto_cancel_services'
      using errcode = '42501';
  end if;

  v_cancel_hours := public.platform_constant_int('auto_cancel_hours_before_service', 12);
  v_batch_size := greatest(
    coalesce(
      p_batch_size,
      public.platform_constant_int('auto_cancel_batch_size', 100)
    ),
    1
  );

  for v_service in
    select
      cs.id as service_id,
      cs.client_id,
      cs.provider_id,
      cs.status as service_status,
      ps.id as schedule_id,
      ps.state as schedule_state,
      ps.failure_reason,
      pga.onboarding_status
    from public.contracted_services cs
    inner join public.payment_schedules ps on ps.contracted_service_id = cs.id
    left join public.provider_gateway_accounts pga
      on pga.provider_id = ps.provider_id
      and pga.gateway_slug = ps.gateway_slug
    where cs.service_execution_at <= now() + make_interval(hours => v_cancel_hours)
      and cs.status not in (
        'CANCELLED'::public.contracted_service_status,
        'COMPLETED'::public.contracted_service_status
      )
      and (
        ps.state in (
          'SCHEDULED'::public.payment_schedule_state,
          'FAILED'::public.payment_schedule_state,
          'FAILED_PERMANENT'::public.payment_schedule_state
        )
        or ps.state = 'IN_ANALYSIS'::public.payment_schedule_state
      )
    order by cs.service_execution_at, cs.id
    limit v_batch_size
    for update of cs, ps skip locked
  loop
    begin
      if v_service.service_status = 'CANCELLED'::public.contracted_service_status then
        continue;
      end if;

      v_reason := case
        when v_service.onboarding_status = 'SUSPENDED'::public.payment_provider_onboarding_status
          then 'PROVIDER_SUSPENDED'
        else 'NON_PAYMENT'
      end;

      v_last_failure_reason := v_service.failure_reason;

      perform public.cns_cancel_active_service_reschedule_requests(v_service.service_id);

      update public.contracted_services cs
      set
        status = 'CANCELLED'::public.contracted_service_status,
        cancellation_reason = v_reason
      where cs.id = v_service.service_id;

      update public.payment_schedules ps
      set
        state = 'CANCELLED'::public.payment_schedule_state,
        cancelled_at = now(),
        cancellation_reason = v_reason,
        updated_at = now()
      where ps.id = v_service.schedule_id;

      perform public.cns_close_contracted_service_chat(
        p_contracted_service_id := v_service.service_id,
        p_closed_by_user_id := null,
        p_initiator := 'system',
        p_cancellation_reason := v_reason,
        p_pre_charge := false
      );

      perform public.payment_write_audit(
        p_event_type := 'AUTO_CANCELLED',
        p_entity_type := 'payment_schedule',
        p_entity_id := v_service.schedule_id,
        p_service_id := v_service.service_id,
        p_schedule_id := v_service.schedule_id,
        p_from_state := v_service.schedule_state::text,
        p_to_state := 'CANCELLED',
        p_actor := 'system'::public.payment_audit_actor,
        p_metadata := jsonb_build_object(
          'cancellation_reason', v_reason,
          'service_status', v_service.service_status::text,
          'last_failure_reason', v_last_failure_reason
        )
      );

      perform public.payment_write_event(
        p_event_type := 'ServiceAutoCancelled',
        p_aggregate_type := 'payment_schedule',
        p_aggregate_id := v_service.schedule_id,
        p_service_id := v_service.service_id,
        p_payload := jsonb_build_object(
          'schedule_id', v_service.schedule_id,
          'cancellation_reason', v_reason,
          'last_failure_reason', v_last_failure_reason,
          'requires_gateway_reconcile',
            v_service.schedule_state = 'IN_ANALYSIS'::public.payment_schedule_state
        )
      );

      v_results := v_results || jsonb_build_array(
        jsonb_build_object(
          'service_id', v_service.service_id,
          'schedule_id', v_service.schedule_id,
          'client_id', v_service.client_id,
          'provider_id', v_service.provider_id,
          'cancellation_reason', v_reason,
          'last_failure_reason', v_last_failure_reason,
          'schedule_state', v_service.schedule_state,
          'requires_gateway_reconcile',
            v_service.schedule_state = 'IN_ANALYSIS'::public.payment_schedule_state
        )
      );
    exception
      when others then
        v_errors := v_errors + 1;
        raise warning
          'payment_auto_cancel_services row failed service_id=% schedule_id=% sqlstate=% message=%',
          v_service.service_id,
          v_service.schedule_id,
          sqlstate,
          sqlerrm;
    end;
  end loop;

  return jsonb_build_object(
    'cancelled_count', jsonb_array_length(v_results),
    'cancelled', v_results,
    'errors_count', v_errors
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- Option A recovery: redefine reconcile/webhook after payment_complete_refund_domain_side_effects
-- ---------------------------------------------------------------------------

create or replace function public.payment_process_reconciliation_outcome(
  p_schedule_id uuid,
  p_gateway_state text,
  p_paid_amount numeric(12, 2) default null,
  p_refunded_amount numeric(12, 2) default null,
  p_gateway_charge_id text default null,
  p_gateway_transaction_id text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_schedule public.payment_schedules%rowtype;
  v_from_state text;
  v_to_state text;
  v_audit_event text;
  v_event_type text;
  v_charge_amount numeric(12, 2);
  v_gateway_state text;
begin
  if coalesce(auth.role(), '') <> 'service_role' then
    raise exception 'service_role required for payment_process_reconciliation_outcome'
      using errcode = '42501';
  end if;

  if p_schedule_id is null then
    raise exception 'p_schedule_id is required'
      using errcode = '22023';
  end if;

  select ps.*
  into v_schedule
  from public.payment_schedules ps
  where ps.id = p_schedule_id
    and (
      ps.state in (
        'IN_ANALYSIS'::public.payment_schedule_state,
        'PROCESSING'::public.payment_schedule_state,
        'REFUND_REQUESTED'::public.payment_schedule_state
      )
      or (
        ps.state = 'PAID'::public.payment_schedule_state
        and ps.refund_submit_status = 'SUBMITTED'::public.payment_refund_submit_status
        and ps.refunded_at is null
      )
    )
  for update;

  if not found then
    return jsonb_build_object('applied', false, 'reason', 'schedule_not_reconcilable');
  end if;

  v_from_state := v_schedule.state::text;
  v_gateway_state := upper(btrim(coalesce(p_gateway_state, '')));

  if v_gateway_state = '' then
    update public.payment_schedules ps
    set
      reconciliation_failure_count = ps.reconciliation_failure_count + 1,
      locked_until = null,
      updated_at = now()
    where ps.id = v_schedule.id
    returning ps.reconciliation_failure_count into v_schedule.reconciliation_failure_count;

    return jsonb_build_object(
      'applied', false,
      'reason', 'gateway_state_missing',
      'reconciliation_failure_count', v_schedule.reconciliation_failure_count
    );
  end if;

  if v_gateway_state not in (
    'PAID', 'REJECTED', 'REFUNDED', 'PARTIALLY_REFUNDED', 'IN_ANALYSIS'
  ) then
    update public.payment_schedules ps
    set
      reconciliation_failure_count = ps.reconciliation_failure_count + 1,
      locked_until = null,
      updated_at = now()
    where ps.id = v_schedule.id
    returning ps.reconciliation_failure_count into v_schedule.reconciliation_failure_count;

    return jsonb_build_object(
      'applied', false,
      'reason', 'unsupported_gateway_state',
      'gateway_state', v_gateway_state,
      'reconciliation_failure_count', v_schedule.reconciliation_failure_count
    );
  end if;

  if v_gateway_state = 'IN_ANALYSIS'
    and v_from_state = 'IN_ANALYSIS' then
    update public.payment_schedules ps
    set locked_until = null
    where ps.id = v_schedule.id;

    return jsonb_build_object(
      'applied', false,
      'reason', 'still_in_analysis',
      'reconciliation_failure_count', v_schedule.reconciliation_failure_count
    );
  end if;

  if v_gateway_state = 'PAID' then
    if v_from_state not in ('IN_ANALYSIS', 'PROCESSING') then
      update public.payment_schedules ps
      set locked_until = null, updated_at = now()
      where ps.id = v_schedule.id;

      return jsonb_build_object(
        'applied', false,
        'reason', 'invalid_source_state',
        'from_state', v_from_state,
        'gateway_state', v_gateway_state
      );
    end if;

    v_charge_amount := coalesce(
      p_paid_amount,
      v_schedule.paid_amount,
      public.payment_calculate_charge_amount(
        v_schedule.client_card_token_id,
        v_schedule.base_amount,
        v_schedule.installment_number
      )
    );

    update public.payment_schedules ps
    set
      state = 'PAID'::public.payment_schedule_state,
      paid_at = coalesce(ps.paid_at, now()),
      paid_amount = v_charge_amount,
      gateway_charge_id = coalesce(p_gateway_charge_id, ps.gateway_charge_id),
      gateway_transaction_id = coalesce(p_gateway_transaction_id, ps.gateway_transaction_id),
      refund_anchor_execution_at = coalesce(
        ps.refund_anchor_execution_at,
        (
          select public.payment_service_execution_at(cs)
          from public.contracted_services cs
          where cs.id = v_schedule.contracted_service_id
        )
      ),
      locked_until = null,
      next_retry_at = null,
      failure_code = null,
      failure_reason = null,
      reconciliation_failure_count = 0,
      updated_at = now()
    where ps.id = v_schedule.id;

    update public.contracted_services cs
    set status = 'CONFIRMED'::public.contracted_service_status
    where cs.id = v_schedule.contracted_service_id
      and cs.status = 'PENDING_PAYMENT'::public.contracted_service_status;

    v_to_state := 'PAID';
    v_audit_event := 'RECONCILIATION_PAID';
    v_event_type := 'ChargeSucceeded';

    perform public.payment_enqueue_notifications(
      v_schedule.id,
      'CHARGE_SUCCEEDED',
      jsonb_build_object('source', 'reconciliation')
    );
  elsif v_gateway_state = 'REJECTED' then
    if v_from_state not in ('IN_ANALYSIS', 'PROCESSING') then
      update public.payment_schedules ps
      set locked_until = null, updated_at = now()
      where ps.id = v_schedule.id;

      return jsonb_build_object(
        'applied', false,
        'reason', 'invalid_source_state',
        'from_state', v_from_state,
        'gateway_state', v_gateway_state
      );
    end if;

    update public.payment_schedules ps
    set
      state = 'FAILED_PERMANENT'::public.payment_schedule_state,
      failed_at = coalesce(ps.failed_at, now()),
      failed_permanently_at = coalesce(ps.failed_permanently_at, now()),
      locked_until = null,
      next_retry_at = null,
      reconciliation_failure_count = 0,
      updated_at = now()
    where ps.id = v_schedule.id;

    v_to_state := 'FAILED_PERMANENT';
    v_audit_event := 'RECONCILIATION_REJECTED';
    v_event_type := 'ChargePermanentlyFailed';

    perform public.payment_enqueue_notifications(
      v_schedule.id,
      'CHARGE_FAILED_PERMANENT',
      jsonb_build_object('source', 'reconciliation')
    );
  elsif v_gateway_state = 'IN_ANALYSIS' and v_from_state = 'PROCESSING' then
    update public.payment_schedules ps
    set
      state = 'IN_ANALYSIS'::public.payment_schedule_state,
      gateway_charge_id = coalesce(p_gateway_charge_id, ps.gateway_charge_id),
      gateway_transaction_id = coalesce(p_gateway_transaction_id, ps.gateway_transaction_id),
      locked_until = null,
      reconciliation_failure_count = 0,
      updated_at = now()
    where ps.id = v_schedule.id;

    v_to_state := 'IN_ANALYSIS';
    v_audit_event := 'RECONCILIATION_IN_ANALYSIS';
    v_event_type := 'ChargeInAnalysis';

    perform public.payment_enqueue_notifications(
      v_schedule.id,
      'CHARGE_IN_ANALYSIS',
      jsonb_build_object('source', 'reconciliation')
    );
  elsif v_gateway_state in ('REFUNDED', 'PARTIALLY_REFUNDED')
    and v_from_state in ('REFUND_REQUESTED', 'PAID') then
    v_to_state := v_gateway_state;

    update public.payment_schedules ps
    set
      state = v_to_state::public.payment_schedule_state,
      refunded_at = coalesce(ps.refunded_at, now()),
      refunded_amount = coalesce(p_refunded_amount, ps.refunded_amount),
      refund_submit_status = 'CONFIRMED'::public.payment_refund_submit_status,
      locked_until = null,
      reconciliation_failure_count = 0,
      updated_at = now()
    where ps.id = v_schedule.id;

    perform public.payment_complete_refund_domain_side_effects(
      p_service_id := v_schedule.contracted_service_id,
      p_closed_by_user_id := null,
      p_initiator := 'system',
      p_cancellation_reason := coalesce(
        nullif(btrim(v_schedule.cancellation_reason), ''),
        'CLIENT_INITIATED'
      ),
      p_refund_tier := null
    );

    v_audit_event := case
      when v_gateway_state = 'REFUNDED' then 'RECONCILIATION_REFUNDED'
      else 'RECONCILIATION_PARTIALLY_REFUNDED'
    end;
    v_event_type := 'RefundConfirmed';
  else
    update public.payment_schedules ps
    set locked_until = null, updated_at = now()
    where ps.id = v_schedule.id;

    return jsonb_build_object(
      'applied', false,
      'reason', 'transition_not_applicable',
      'from_state', v_from_state,
      'gateway_state', v_gateway_state
    );
  end if;

  perform public.payment_write_audit(
    p_event_type := v_audit_event,
    p_entity_type := 'payment_schedule',
    p_entity_id := v_schedule.id,
    p_service_id := v_schedule.contracted_service_id,
    p_schedule_id := v_schedule.id,
    p_from_state := v_from_state,
    p_to_state := v_to_state,
    p_actor := 'cron'::public.payment_audit_actor,
    p_metadata := jsonb_build_object(
      'gateway_state', v_gateway_state,
      'paid_amount', p_paid_amount,
      'refunded_amount', p_refunded_amount,
      'gateway_charge_id', p_gateway_charge_id,
      'gateway_transaction_id', p_gateway_transaction_id,
      'source', 'reconcile-netcred-payments'
    )
  );

  perform public.payment_write_event(
    p_event_type := v_event_type,
    p_aggregate_type := 'payment_schedule',
    p_aggregate_id := v_schedule.id,
    p_service_id := v_schedule.contracted_service_id,
    p_payload := jsonb_build_object(
      'from_state', v_from_state,
      'to_state', v_to_state,
      'gateway_state', v_gateway_state,
      'initiator', 'reconciliation'
    )
  );

  return jsonb_build_object(
    'applied', true,
    'schedule_id', v_schedule.id,
    'from_state', v_from_state,
    'to_state', v_to_state,
    'reconciliation_failure_count', 0,
    'service_id', v_schedule.contracted_service_id,
    'client_id', v_schedule.client_id,
    'provider_id', v_schedule.provider_id,
    'installment_number', v_schedule.installment_number,
    'charge_amount', coalesce(p_paid_amount, v_schedule.paid_amount)
  );
end;
$$;

comment on function public.payment_process_reconciliation_outcome(
  uuid, text, numeric, numeric, text, text
) is
  'Applies getTransaction reconciliation outcomes; cancels service/chat on REFUNDED from PAID/REFUND_REQUESTED (service_role only).';

create or replace function public.payment_webhook_handle_refund(
  p_webhook_event_id uuid,
  p_payload jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_reference_code uuid;
  v_schedule public.payment_schedules%rowtype;
  v_from_state text;
  v_to_state public.payment_schedule_state;
  v_refunded_amount numeric(12, 2);
begin
  v_reference_code := public.payment_webhook_payload_reference_code(p_payload);

  if v_reference_code is null then
    return jsonb_build_object('outcome', 'not_found', 'reason', 'missing_reference_code');
  end if;

  v_refunded_amount := nullif(
    public.payment_webhook_payload_text(p_payload, array[
      'refunded_amount',
      'refundedAmount',
      'transaction,refunded_amount',
      'transaction,refundedAmount'
    ]),
    ''
  )::numeric;

  if v_refunded_amount is null or v_refunded_amount <= 0 then
    raise exception 'INVALID_REFUND_AMOUNT'
      using errcode = 'P0001';
  end if;

  select ps.*
  into v_schedule
  from public.payment_schedules ps
  inner join public.contracted_services cs on cs.id = ps.contracted_service_id
  where ps.gateway_reference_code = v_reference_code
     or ps.contracted_service_id = v_reference_code
  for update of cs, ps;

  if not found then
    return jsonb_build_object('outcome', 'not_found', 'reference_code', v_reference_code);
  end if;

  v_from_state := v_schedule.state::text;

  if v_schedule.state in (
    'REFUNDED'::public.payment_schedule_state,
    'PARTIALLY_REFUNDED'::public.payment_schedule_state
  ) then
    return jsonb_build_object(
      'outcome', 'already_terminal',
      'schedule_id', v_schedule.id,
      'from_state', v_from_state,
      'to_state', v_schedule.state
    );
  end if;

  -- Allow PAID (external refund/chargeback or Option A crash recovery) or REFUND_REQUESTED.
  if v_schedule.state not in (
    'PAID'::public.payment_schedule_state,
    'REFUND_REQUESTED'::public.payment_schedule_state
  ) then
    raise log 'payment_process_webhook_event: regression guard skipped refund from % (event %)',
      v_from_state, p_webhook_event_id;
    return jsonb_build_object(
      'outcome', 'skipped',
      'reason', 'invalid_transition',
      'schedule_id', v_schedule.id,
      'from_state', v_from_state
    );
  end if;

  v_to_state := case
    when v_schedule.paid_amount is not null
      and v_refunded_amount < v_schedule.paid_amount
      then 'PARTIALLY_REFUNDED'::public.payment_schedule_state
    else 'REFUNDED'::public.payment_schedule_state
  end;

  update public.payment_schedules ps
  set
    state = v_to_state,
    refunded_amount = v_refunded_amount,
    refunded_at = coalesce(ps.refunded_at, now()),
    refund_submit_status = 'CONFIRMED'::public.payment_refund_submit_status,
    updated_at = now()
  where ps.id = v_schedule.id;

  perform public.payment_complete_refund_domain_side_effects(
    p_service_id := v_schedule.contracted_service_id,
    p_closed_by_user_id := null,
    p_initiator := 'system',
    p_cancellation_reason := coalesce(
      nullif(btrim(v_schedule.cancellation_reason), ''),
      'CLIENT_INITIATED'
    ),
    p_refund_tier := null
  );

  perform public.payment_write_audit(
    p_event_type := 'REFUND_CONFIRMED',
    p_entity_type := 'payment_schedule',
    p_entity_id := v_schedule.id,
    p_service_id := v_schedule.contracted_service_id,
    p_schedule_id := v_schedule.id,
    p_from_state := v_from_state,
    p_to_state := v_to_state::text,
    p_actor := 'webhook',
    p_metadata := jsonb_build_object(
      'webhook_event_id', p_webhook_event_id,
      'refunded_amount', v_refunded_amount,
      'source', 'TRANSACTION_REFUND'
    )
  );

  perform public.payment_write_event(
    p_event_type := 'RefundConfirmed',
    p_aggregate_type := 'payment_schedule',
    p_aggregate_id := v_schedule.id,
    p_service_id := v_schedule.contracted_service_id,
    p_payload := jsonb_build_object(
      'to_state', v_to_state,
      'refunded_amount', v_refunded_amount,
      'initiator', 'webhook',
      'webhook_event_id', p_webhook_event_id
    )
  );

  return jsonb_build_object(
    'outcome', 'refunded',
    'schedule_id', v_schedule.id,
    'service_id', v_schedule.contracted_service_id,
    'from_state', v_from_state,
    'to_state', v_to_state
  );
end;
$$;

comment on function public.payment_webhook_handle_refund(uuid, jsonb) is
  'Applies TRANSACTION_REFUND; cancels service/chat when not yet CANCELLED (Option A recovery).';

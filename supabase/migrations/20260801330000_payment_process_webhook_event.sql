-- Payment Task 35: payment_process_webhook_event RPC (design.md §4.7.3, Req 17–18).

create or replace function public.payment_webhook_payload_text(
  p_payload jsonb,
  p_paths text[]
)
returns text
language sql
immutable
parallel safe
as $$
  select coalesce(
    (
      select nullif(btrim(p_payload #>> string_to_array(path, ',')), '')
      from unnest(p_paths) as path
      where nullif(btrim(p_payload #>> string_to_array(path, ',')), '') is not null
      limit 1
    ),
    ''
  );
$$;

create or replace function public.payment_webhook_payload_reference_code(
  p_payload jsonb
)
returns uuid
language plpgsql
immutable
parallel safe
as $$
declare
  v_text text;
begin
  v_text := public.payment_webhook_payload_text(p_payload, array[
    'charge,reference_code',
    'transaction,charge,reference_code',
    'transaction,referenceCode',
    'referenceCode',
    'charge,referenceCode'
  ]);

  if v_text = '' then
    return null;
  end if;

  begin
    return v_text::uuid;
  exception
    when invalid_text_representation then
      return null;
  end;
end;
$$;

create or replace function public.payment_webhook_payload_transaction_state(
  p_payload jsonb
)
returns text
language sql
immutable
parallel safe
as $$
  select upper(public.payment_webhook_payload_text(p_payload, array[
    'transaction_state',
    'transactionState',
    'transaction,transaction_state',
    'transaction,transactionState'
  ]));
$$;

create or replace function public.payment_webhook_handle_capture(
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
  v_charge_amount numeric(12, 2);
  v_paid_amount numeric(12, 2);
  v_gateway_charge_id text;
  v_gateway_transaction_id text;
begin
  v_reference_code := public.payment_webhook_payload_reference_code(p_payload);

  if v_reference_code is null then
    return jsonb_build_object('outcome', 'not_found', 'reason', 'missing_reference_code');
  end if;

  select ps.*
  into v_schedule
  from public.payment_schedules ps
  inner join public.contracted_services cs on cs.id = ps.contracted_service_id
  where ps.contracted_service_id = v_reference_code
  for update of cs, ps;

  if not found then
    return jsonb_build_object('outcome', 'not_found', 'reference_code', v_reference_code);
  end if;

  v_from_state := v_schedule.state::text;

  if v_schedule.state = 'PAID'::public.payment_schedule_state then
    return jsonb_build_object(
      'outcome', 'already_paid',
      'schedule_id', v_schedule.id,
      'service_id', v_schedule.contracted_service_id,
      'from_state', v_from_state
    );
  end if;

  if v_schedule.state not in (
    'IN_ANALYSIS'::public.payment_schedule_state,
    'PROCESSING'::public.payment_schedule_state
  ) then
    raise log 'payment_process_webhook_event: regression guard skipped capture from % to PAID (event %)',
      v_from_state, p_webhook_event_id;
    return jsonb_build_object(
      'outcome', 'skipped',
      'reason', 'invalid_transition',
      'schedule_id', v_schedule.id,
      'service_id', v_schedule.contracted_service_id,
      'from_state', v_from_state
    );
  end if;

  v_paid_amount := nullif(
    public.payment_webhook_payload_text(p_payload, array[
      'paid_amount',
      'paidAmount',
      'transaction,paid_amount',
      'transaction,paidAmount',
      'amount',
      'transaction,amount'
    ]),
    ''
  )::numeric;

  v_gateway_charge_id := nullif(public.payment_webhook_payload_text(p_payload, array[
    'charge,id',
    'transaction,charge,id',
    'chargeId'
  ]), '');

  v_gateway_transaction_id := nullif(public.payment_webhook_payload_text(p_payload, array[
    'id',
    'uuid',
    'transaction,id',
    'transaction,uuid'
  ]), '');

  v_charge_amount := coalesce(
    v_paid_amount,
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
    gateway_charge_id = coalesce(v_gateway_charge_id, ps.gateway_charge_id),
    gateway_transaction_id = coalesce(v_gateway_transaction_id, ps.gateway_transaction_id),
    locked_until = null,
    next_retry_at = null,
    failure_code = null,
    failure_reason = null,
    updated_at = now()
  where ps.id = v_schedule.id;

  update public.contracted_services cs
  set status = 'CONFIRMED'::public.contracted_service_status
  where cs.id = v_schedule.contracted_service_id
    and cs.status = 'PENDING_PAYMENT'::public.contracted_service_status;

  perform public.payment_write_audit(
    p_event_type := 'CHARGE_PAID',
    p_entity_type := 'payment_schedule',
    p_entity_id := v_schedule.id,
    p_service_id := v_schedule.contracted_service_id,
    p_schedule_id := v_schedule.id,
    p_from_state := v_from_state,
    p_to_state := 'PAID',
    p_actor := 'webhook',
    p_metadata := jsonb_build_object(
      'webhook_event_id', p_webhook_event_id,
      'charge_amount', v_charge_amount,
      'gateway_charge_id', v_gateway_charge_id,
      'gateway_transaction_id', v_gateway_transaction_id,
      'source', 'TRANSACTION_CAPTURE'
    )
  );

  perform public.payment_write_event(
    p_event_type := 'ChargeSucceeded',
    p_aggregate_type := 'payment_schedule',
    p_aggregate_id := v_schedule.id,
    p_service_id := v_schedule.contracted_service_id,
    p_payload := jsonb_build_object(
      'outcome', 'PAID',
      'charge_amount', v_charge_amount,
      'initiator', 'webhook',
      'webhook_event_id', p_webhook_event_id
    )
  );

  perform public.payment_enqueue_notifications(
    v_schedule.id,
    'CHARGE_SUCCEEDED',
    jsonb_build_object('webhook_event_id', p_webhook_event_id)
  );

  return jsonb_build_object(
    'outcome', 'paid',
    'schedule_id', v_schedule.id,
    'service_id', v_schedule.contracted_service_id,
    'client_id', v_schedule.client_id,
    'provider_id', v_schedule.provider_id,
    'from_state', v_from_state
  );
end;
$$;

create or replace function public.payment_webhook_handle_rejected(
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
  v_failure_code text;
  v_failure_reason text;
begin
  v_reference_code := public.payment_webhook_payload_reference_code(p_payload);

  if v_reference_code is null then
    return jsonb_build_object('outcome', 'not_found', 'reason', 'missing_reference_code');
  end if;

  select ps.*
  into v_schedule
  from public.payment_schedules ps
  inner join public.contracted_services cs on cs.id = ps.contracted_service_id
  where ps.contracted_service_id = v_reference_code
  for update of cs, ps;

  if not found then
    return jsonb_build_object('outcome', 'not_found', 'reference_code', v_reference_code);
  end if;

  v_from_state := v_schedule.state::text;

  if v_schedule.state = 'FAILED_PERMANENT'::public.payment_schedule_state then
    return jsonb_build_object(
      'outcome', 'already_terminal',
      'schedule_id', v_schedule.id,
      'from_state', v_from_state
    );
  end if;

  if v_schedule.state not in (
    'IN_ANALYSIS'::public.payment_schedule_state,
    'PROCESSING'::public.payment_schedule_state
  ) then
    raise log 'payment_process_webhook_event: regression guard skipped rejected from % (event %)',
      v_from_state, p_webhook_event_id;
    return jsonb_build_object(
      'outcome', 'skipped',
      'reason', 'invalid_transition',
      'schedule_id', v_schedule.id,
      'from_state', v_from_state
    );
  end if;

  v_failure_code := nullif(public.payment_webhook_payload_text(p_payload, array[
    'failure_code',
    'failureCode',
    'rejected_reason',
    'rejectedReason'
  ]), '');

  v_failure_reason := nullif(public.payment_webhook_payload_text(p_payload, array[
    'failure_reason',
    'failureReason',
    'rejected_reason',
    'rejectedReason'
  ]), '');

  update public.payment_schedules ps
  set
    state = 'FAILED_PERMANENT'::public.payment_schedule_state,
    failed_at = coalesce(ps.failed_at, now()),
    failed_permanently_at = coalesce(ps.failed_permanently_at, now()),
    failure_code = v_failure_code,
    failure_reason = v_failure_reason,
    locked_until = null,
    next_retry_at = null,
    updated_at = now()
  where ps.id = v_schedule.id;

  perform public.payment_write_audit(
    p_event_type := 'CHARGE_FAILED_PERMANENT',
    p_entity_type := 'payment_schedule',
    p_entity_id := v_schedule.id,
    p_service_id := v_schedule.contracted_service_id,
    p_schedule_id := v_schedule.id,
    p_from_state := v_from_state,
    p_to_state := 'FAILED_PERMANENT',
    p_actor := 'webhook',
    p_metadata := jsonb_build_object(
      'webhook_event_id', p_webhook_event_id,
      'failure_code', v_failure_code,
      'failure_reason', v_failure_reason,
      'source', 'TRANSACTION_UPDATE'
    )
  );

  perform public.payment_write_event(
    p_event_type := 'ChargePermanentlyFailed',
    p_aggregate_type := 'payment_schedule',
    p_aggregate_id := v_schedule.id,
    p_service_id := v_schedule.contracted_service_id,
    p_payload := jsonb_build_object(
      'outcome', 'FAILED_PERMANENT',
      'initiator', 'webhook',
      'webhook_event_id', p_webhook_event_id
    )
  );

  perform public.payment_enqueue_notifications(
    v_schedule.id,
    'CHARGE_FAILED_PERMANENT',
    jsonb_build_object('webhook_event_id', p_webhook_event_id)
  );

  return jsonb_build_object(
    'outcome', 'rejected',
    'schedule_id', v_schedule.id,
    'service_id', v_schedule.contracted_service_id,
    'from_state', v_from_state
  );
end;
$$;

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
  where ps.contracted_service_id = v_reference_code
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

  if v_schedule.state <> 'REFUND_REQUESTED'::public.payment_schedule_state then
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
    updated_at = now()
  where ps.id = v_schedule.id;

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

create or replace function public.payment_webhook_handle_void(
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
begin
  v_reference_code := public.payment_webhook_payload_reference_code(p_payload);

  if v_reference_code is null then
    return jsonb_build_object('outcome', 'not_found', 'reason', 'missing_reference_code');
  end if;

  select ps.*
  into v_schedule
  from public.payment_schedules ps
  inner join public.contracted_services cs on cs.id = ps.contracted_service_id
  where ps.contracted_service_id = v_reference_code
  for update of cs, ps;

  if not found then
    return jsonb_build_object('outcome', 'not_found', 'reference_code', v_reference_code);
  end if;

  v_from_state := v_schedule.state::text;

  if v_schedule.state = 'VOIDED'::public.payment_schedule_state then
    return jsonb_build_object(
      'outcome', 'already_terminal',
      'schedule_id', v_schedule.id,
      'from_state', v_from_state
    );
  end if;

  if v_schedule.state not in (
    'PAID'::public.payment_schedule_state,
    'IN_ANALYSIS'::public.payment_schedule_state,
    'PROCESSING'::public.payment_schedule_state
  ) then
    raise log 'payment_process_webhook_event: regression guard skipped void from % (event %)',
      v_from_state, p_webhook_event_id;
    return jsonb_build_object(
      'outcome', 'skipped',
      'reason', 'invalid_transition',
      'schedule_id', v_schedule.id,
      'from_state', v_from_state
    );
  end if;

  update public.payment_schedules ps
  set
    state = 'VOIDED'::public.payment_schedule_state,
    updated_at = now()
  where ps.id = v_schedule.id;

  perform public.payment_write_audit(
    p_event_type := 'CHARGE_VOIDED',
    p_entity_type := 'payment_schedule',
    p_entity_id := v_schedule.id,
    p_service_id := v_schedule.contracted_service_id,
    p_schedule_id := v_schedule.id,
    p_from_state := v_from_state,
    p_to_state := 'VOIDED',
    p_actor := 'webhook',
    p_metadata := jsonb_build_object(
      'webhook_event_id', p_webhook_event_id,
      'source', 'CHARGE_VOID'
    )
  );

  return jsonb_build_object(
    'outcome', 'voided',
    'schedule_id', v_schedule.id,
    'service_id', v_schedule.contracted_service_id,
    'from_state', v_from_state
  );
end;
$$;

create or replace function public.payment_webhook_handle_dispute(
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
  v_gateway_transaction_id text;
  v_service_request_title text;
  v_service_request_id uuid;
begin
  v_reference_code := public.payment_webhook_payload_reference_code(p_payload);

  if v_reference_code is null then
    return jsonb_build_object('outcome', 'not_found', 'reason', 'missing_reference_code');
  end if;

  v_gateway_transaction_id := nullif(public.payment_webhook_payload_text(p_payload, array[
    'id',
    'uuid',
    'transaction,id',
    'transaction,uuid'
  ]), '');

  select
    ps.*,
    cs.service_request_id,
    coalesce(nullif(trim(sr.title), ''), 'Serviço')
  into
    v_schedule,
    v_service_request_id,
    v_service_request_title
  from public.payment_schedules ps
  inner join public.contracted_services cs on cs.id = ps.contracted_service_id
  inner join public.service_requests sr on sr.id = cs.service_request_id
  where ps.contracted_service_id = v_reference_code
  for update of cs, ps;

  if not found then
    return jsonb_build_object('outcome', 'not_found', 'reference_code', v_reference_code);
  end if;

  update public.payment_schedules ps
  set
    is_disputed = true,
    updated_at = now()
  where ps.id = v_schedule.id;

  perform public.payment_write_audit(
    p_event_type := 'TRANSACTION_DISPUTED',
    p_entity_type := 'payment_schedule',
    p_entity_id := v_schedule.id,
    p_service_id := v_schedule.contracted_service_id,
    p_schedule_id := v_schedule.id,
    p_from_state := v_schedule.state::text,
    p_to_state := v_schedule.state::text,
    p_actor := 'webhook',
    p_metadata := jsonb_build_object(
      'webhook_event_id', p_webhook_event_id,
      'gateway_transaction_id', coalesce(v_gateway_transaction_id, v_schedule.gateway_transaction_id),
      'source', 'TRANSACTION_DISPUTE'
    )
  );

  perform public.mmd_ingest_event(
    'TRANSACTION_DISPUTE',
    v_schedule.client_id,
    format('transaction-dispute:%s', v_schedule.id),
    jsonb_build_object(
      'contracted_service_id', v_schedule.contracted_service_id,
      'schedule_id', v_schedule.id,
      'service_request_title', v_service_request_title,
      'deep_link_path', format('/dashboard/services/%s', v_service_request_id)
    ),
    jsonb_build_object(
      'source', 'payment_webhook_handle_dispute',
      'recipient', 'client'
    )
  );

  return jsonb_build_object(
    'outcome', 'disputed',
    'schedule_id', v_schedule.id,
    'service_id', v_schedule.contracted_service_id,
    'is_disputed', true
  );
end;
$$;

create or replace function public.payment_webhook_handle_expired(
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
begin
  v_reference_code := public.payment_webhook_payload_reference_code(p_payload);

  if v_reference_code is null then
    return jsonb_build_object('outcome', 'not_found', 'reason', 'missing_reference_code');
  end if;

  select ps.*
  into v_schedule
  from public.payment_schedules ps
  inner join public.contracted_services cs on cs.id = ps.contracted_service_id
  where ps.contracted_service_id = v_reference_code
  for update of cs, ps;

  if not found then
    return jsonb_build_object('outcome', 'not_found', 'reference_code', v_reference_code);
  end if;

  v_from_state := v_schedule.state::text;

  if v_schedule.state = 'EXPIRED'::public.payment_schedule_state then
    return jsonb_build_object(
      'outcome', 'already_terminal',
      'schedule_id', v_schedule.id,
      'from_state', v_from_state
    );
  end if;

  if v_schedule.state in (
    'PAID'::public.payment_schedule_state,
    'REFUNDED'::public.payment_schedule_state,
    'PARTIALLY_REFUNDED'::public.payment_schedule_state,
    'VOIDED'::public.payment_schedule_state,
    'CANCELLED'::public.payment_schedule_state
  ) then
    raise log 'payment_process_webhook_event: regression guard skipped expired from % (event %)',
      v_from_state, p_webhook_event_id;
    return jsonb_build_object(
      'outcome', 'skipped',
      'reason', 'invalid_transition',
      'schedule_id', v_schedule.id,
      'from_state', v_from_state
    );
  end if;

  update public.payment_schedules ps
  set
    state = 'EXPIRED'::public.payment_schedule_state,
    updated_at = now()
  where ps.id = v_schedule.id;

  perform public.payment_write_audit(
    p_event_type := 'CHARGE_EXPIRED',
    p_entity_type := 'payment_schedule',
    p_entity_id := v_schedule.id,
    p_service_id := v_schedule.contracted_service_id,
    p_schedule_id := v_schedule.id,
    p_from_state := v_from_state,
    p_to_state := 'EXPIRED',
    p_actor := 'webhook',
    p_metadata := jsonb_build_object(
      'webhook_event_id', p_webhook_event_id,
      'source', 'TRANSACTION_EXPIRED'
    )
  );

  return jsonb_build_object(
    'outcome', 'expired',
    'schedule_id', v_schedule.id,
    'service_id', v_schedule.contracted_service_id,
    'from_state', v_from_state
  );
end;
$$;

create or replace function public.payment_webhook_handle_profile_delete(
  p_webhook_event_id uuid,
  p_payload jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_profile_id text;
  v_token public.client_card_tokens%rowtype;
  v_schedules jsonb := '[]'::jsonb;
  v_schedule record;
begin
  v_profile_id := public.payment_webhook_payload_text(p_payload, array[
    'id',
    'payment_profile,id',
    'paymentProfile,id'
  ]);

  if v_profile_id = '' then
    return jsonb_build_object('outcome', 'not_found', 'reason', 'missing_payment_profile_id');
  end if;

  select cct.*
  into v_token
  from public.client_card_tokens cct
  where cct.gateway_payment_profile_id = v_profile_id
  for update;

  if not found then
    return jsonb_build_object('outcome', 'not_found', 'gateway_payment_profile_id', v_profile_id);
  end if;

  update public.client_card_tokens cct
  set state = 'REVOKED'::public.payment_client_card_token_state
  where cct.id = v_token.id;

  for v_schedule in
    update public.payment_schedules ps
    set needs_payment_method_update = true
    where ps.client_card_token_id = v_token.id
      and ps.state in (
        'SCHEDULED'::public.payment_schedule_state,
        'FAILED'::public.payment_schedule_state
      )
    returning ps.id, ps.contracted_service_id, ps.client_id
  loop
    v_schedules := v_schedules || jsonb_build_array(jsonb_build_object(
      'schedule_id', v_schedule.id,
      'service_id', v_schedule.contracted_service_id,
      'client_id', v_schedule.client_id
    ));
  end loop;

  perform public.payment_write_audit(
    p_event_type := 'PAYMENT_PROFILE_DELETED',
    p_entity_type := 'client_card_token',
    p_entity_id := v_token.id,
    p_actor := 'webhook',
    p_metadata := jsonb_build_object(
      'webhook_event_id', p_webhook_event_id,
      'gateway_payment_profile_id', v_profile_id,
      'affected_schedules', v_schedules
    )
  );

  return jsonb_build_object(
    'outcome', 'profile_deleted',
    'client_card_token_id', v_token.id,
    'client_id', v_token.client_id,
    'schedules', v_schedules
  );
end;
$$;

create or replace function public.payment_webhook_handle_profile_tokenize(
  p_webhook_event_id uuid,
  p_payload jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_profile_id text;
  v_token public.client_card_tokens%rowtype;
  v_is_active boolean;
begin
  v_profile_id := public.payment_webhook_payload_text(p_payload, array[
    'id',
    'payment_profile,id',
    'paymentProfile,id'
  ]);

  if v_profile_id = '' then
    return jsonb_build_object('outcome', 'not_found', 'reason', 'missing_payment_profile_id');
  end if;

  v_is_active := lower(public.payment_webhook_payload_text(p_payload, array[
    'is_active',
    'isActive'
  ])) in ('true', 't', '1', 'yes');

  select cct.*
  into v_token
  from public.client_card_tokens cct
  where cct.gateway_payment_profile_id = v_profile_id
  for update;

  if not found then
    return jsonb_build_object('outcome', 'not_found', 'gateway_payment_profile_id', v_profile_id);
  end if;

  if not v_is_active then
    update public.client_card_tokens cct
    set state = 'TOKENIZATION_FAILED'::public.payment_client_card_token_state
    where cct.id = v_token.id;
  end if;

  return jsonb_build_object(
    'outcome', case when v_is_active then 'profile_tokenized' else 'profile_tokenization_failed' end,
    'client_card_token_id', v_token.id,
    'client_id', v_token.client_id,
    'state', case when v_is_active then 'ACTIVE' else 'TOKENIZATION_FAILED' end
  );
end;
$$;

create or replace function public.payment_webhook_handle_profile_update(
  p_webhook_event_id uuid,
  p_payload jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_profile_id text;
  v_token public.client_card_tokens%rowtype;
begin
  v_profile_id := public.payment_webhook_payload_text(p_payload, array[
    'id',
    'payment_profile,id',
    'paymentProfile,id'
  ]);

  if v_profile_id = '' then
    return jsonb_build_object('outcome', 'not_found', 'reason', 'missing_payment_profile_id');
  end if;

  select cct.*
  into v_token
  from public.client_card_tokens cct
  where cct.gateway_payment_profile_id = v_profile_id
  for update;

  if not found then
    return jsonb_build_object('outcome', 'not_found', 'gateway_payment_profile_id', v_profile_id);
  end if;

  update public.client_card_tokens cct
  set
    card_brand = coalesce(
      nullif(upper(btrim(public.payment_webhook_payload_text(p_payload, array['brand']))), ''),
      cct.card_brand
    ),
    expiry_month = coalesce(
      nullif(public.payment_webhook_payload_text(p_payload, array['expiry_month', 'expiryMonth']), '')::smallint,
      cct.expiry_month
    ),
    expiry_year = coalesce(
      nullif(public.payment_webhook_payload_text(p_payload, array['expiry_year', 'expiryYear']), '')::smallint,
      cct.expiry_year
    ),
    card_number_masked = coalesce(
      nullif(public.payment_webhook_payload_text(p_payload, array['card_number', 'cardNumber']), ''),
      cct.card_number_masked
    )
  where cct.id = v_token.id;

  return jsonb_build_object(
    'outcome', 'profile_updated',
    'client_card_token_id', v_token.id,
    'client_id', v_token.client_id
  );
end;
$$;

create or replace function public.payment_webhook_handle_profile_expiring(
  p_webhook_event_id uuid,
  p_payload jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_profile_id text;
  v_token public.client_card_tokens%rowtype;
  v_schedules jsonb := '[]'::jsonb;
  v_schedule record;
begin
  v_profile_id := public.payment_webhook_payload_text(p_payload, array[
    'id',
    'payment_profile,id',
    'paymentProfile,id'
  ]);

  if v_profile_id = '' then
    return jsonb_build_object('outcome', 'not_found', 'reason', 'missing_payment_profile_id');
  end if;

  select cct.*
  into v_token
  from public.client_card_tokens cct
  where cct.gateway_payment_profile_id = v_profile_id;

  if not found then
    return jsonb_build_object('outcome', 'not_found', 'gateway_payment_profile_id', v_profile_id);
  end if;

  for v_schedule in
    select ps.id, ps.contracted_service_id, ps.client_id
    from public.payment_schedules ps
    where ps.client_card_token_id = v_token.id
      and ps.state = 'SCHEDULED'::public.payment_schedule_state
  loop
    v_schedules := v_schedules || jsonb_build_array(jsonb_build_object(
      'schedule_id', v_schedule.id,
      'service_id', v_schedule.contracted_service_id,
      'client_id', v_schedule.client_id
    ));
  end loop;

  return jsonb_build_object(
    'outcome', 'profile_expiring',
    'client_card_token_id', v_token.id,
    'client_id', v_token.client_id,
    'schedules', v_schedules
  );
end;
$$;

create or replace function public.payment_webhook_handle_transaction_update(
  p_webhook_event_id uuid,
  p_payload jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_transaction_state text;
begin
  v_transaction_state := public.payment_webhook_payload_transaction_state(p_payload);

  if v_transaction_state = '' then
    raise exception 'TRANSACTION_STATE_MISSING'
      using errcode = 'P0001';
  end if;

  case v_transaction_state
    when 'PAID' then
      return public.payment_webhook_handle_capture(p_webhook_event_id, p_payload);
    when 'REJECTED' then
      return public.payment_webhook_handle_rejected(p_webhook_event_id, p_payload);
    when 'REFUNDED', 'PARTIALLY_REFUNDED' then
      return public.payment_webhook_handle_refund(p_webhook_event_id, p_payload);
    when 'VOIDED' then
      return public.payment_webhook_handle_void(p_webhook_event_id, p_payload);
    when 'EXPIRED' then
      return public.payment_webhook_handle_expired(p_webhook_event_id, p_payload);
    else
      raise log 'payment_process_webhook_event: unmapped TRANSACTION_UPDATE state % (event %)',
        v_transaction_state, p_webhook_event_id;
      return jsonb_build_object(
        'outcome', 'skipped',
        'reason', 'unmapped_transaction_state',
        'transaction_state', v_transaction_state
      );
  end case;
end;
$$;

create or replace function public.payment_process_webhook_event(
  p_webhook_event_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_event public.payment_webhook_events%rowtype;
  v_handler_result jsonb;
begin
  if coalesce(auth.role(), '') <> 'service_role' then
    raise exception 'service_role required for payment_process_webhook_event'
      using errcode = '42501';
  end if;

  if p_webhook_event_id is null then
    raise exception 'p_webhook_event_id is required'
      using errcode = '22023';
  end if;

  select e.*
  into v_event
  from public.payment_webhook_events e
  where e.id = p_webhook_event_id
  for update;

  if not found then
    raise exception 'WEBHOOK_EVENT_NOT_FOUND'
      using errcode = 'P0002';
  end if;

  if v_event.state = 'PROCESSED'::public.payment_webhook_event_state then
    return jsonb_build_object(
      'outcome', 'already_processed',
      'event_id', v_event.id,
      'event_type', v_event.event_type,
      'gateway_event_id', v_event.gateway_event_id,
      'state', v_event.state
    );
  end if;

  if v_event.is_duplicate
    or v_event.state = 'DUPLICATE'::public.payment_webhook_event_state then
    update public.payment_webhook_events e
    set
      state = 'PROCESSED'::public.payment_webhook_event_state,
      processed_at = coalesce(e.processed_at, now())
    where e.id = v_event.id;

    return jsonb_build_object(
      'outcome', 'duplicate_skipped',
      'event_id', v_event.id,
      'event_type', v_event.event_type,
      'gateway_event_id', v_event.gateway_event_id,
      'state', 'PROCESSED'::public.payment_webhook_event_state
    );
  end if;

  if v_event.state = 'DEAD_LETTER'::public.payment_webhook_event_state then
    raise exception 'WEBHOOK_EVENT_DEAD_LETTER'
      using errcode = 'P0001';
  end if;

  if v_event.state not in (
    'RECEIVED'::public.payment_webhook_event_state,
    'VALIDATING'::public.payment_webhook_event_state,
    'PROCESSING'::public.payment_webhook_event_state,
    'FAILED'::public.payment_webhook_event_state
  ) then
    raise exception 'WEBHOOK_EVENT_NOT_PROCESSABLE'
      using errcode = 'P0001';
  end if;

  if v_event.state <> 'PROCESSING'::public.payment_webhook_event_state then
    update public.payment_webhook_events e
    set state = 'PROCESSING'::public.payment_webhook_event_state
    where e.id = v_event.id;
  end if;

  case upper(btrim(v_event.event_type))
    when 'TRANSACTION_CAPTURE' then
      v_handler_result := public.payment_webhook_handle_capture(v_event.id, v_event.raw_payload);
    when 'TRANSACTION_UPDATE' then
      v_handler_result := public.payment_webhook_handle_transaction_update(v_event.id, v_event.raw_payload);
    when 'TRANSACTION_REFUND' then
      v_handler_result := public.payment_webhook_handle_refund(v_event.id, v_event.raw_payload);
    when 'CHARGE_VOID', 'TRANSACTION_VOID' then
      v_handler_result := public.payment_webhook_handle_void(v_event.id, v_event.raw_payload);
    when 'TRANSACTION_DISPUTE' then
      v_handler_result := public.payment_webhook_handle_dispute(v_event.id, v_event.raw_payload);
    when 'TRANSACTION_EXPIRED' then
      v_handler_result := public.payment_webhook_handle_expired(v_event.id, v_event.raw_payload);
    when 'PAYMENT_PROFILE_TOKENIZE' then
      v_handler_result := public.payment_webhook_handle_profile_tokenize(v_event.id, v_event.raw_payload);
    when 'PAYMENT_PROFILE_UPDATE' then
      v_handler_result := public.payment_webhook_handle_profile_update(v_event.id, v_event.raw_payload);
    when 'PAYMENT_PROFILE_DELETE' then
      v_handler_result := public.payment_webhook_handle_profile_delete(v_event.id, v_event.raw_payload);
    when 'PAYMENT_PROFILE_EXPIRING' then
      v_handler_result := public.payment_webhook_handle_profile_expiring(v_event.id, v_event.raw_payload);
    when 'WEBHOOK_PING' then
      v_handler_result := jsonb_build_object('outcome', 'noop', 'reason', 'webhook_ping');
    else
      raise log 'payment_process_webhook_event: unknown event type % (event %)',
        v_event.event_type, v_event.id;
      v_handler_result := jsonb_build_object(
        'outcome', 'skipped',
        'reason', 'unknown_event_type',
        'event_type', v_event.event_type
      );
  end case;

  if coalesce(v_handler_result->>'outcome', '') in ('skipped', 'not_found') then
    return jsonb_build_object(
      'outcome', 'retry_scheduled',
      'event_id', v_event.id,
      'event_type', v_event.event_type,
      'gateway_event_id', v_event.gateway_event_id,
      'state', v_event.state,
      'handler', v_handler_result
    );
  end if;

  update public.payment_webhook_events e
  set
    state = 'PROCESSED'::public.payment_webhook_event_state,
    processed_at = now(),
    failure_reason = null
  where e.id = v_event.id;

  return jsonb_build_object(
    'outcome', 'processed',
    'event_id', v_event.id,
    'event_type', v_event.event_type,
    'gateway_event_id', v_event.gateway_event_id,
    'state', 'PROCESSED'::public.payment_webhook_event_state,
    'handler', v_handler_result
  );
end;
$$;

comment on function public.payment_process_webhook_event(uuid) is
  'Dispatches NetCred webhook events to schedule/token handlers; retries transient handler skips (service_role only).';

revoke all on function public.payment_webhook_payload_text(jsonb, text[]) from public, anon, authenticated, service_role;
revoke all on function public.payment_webhook_payload_reference_code(jsonb) from public, anon, authenticated, service_role;
revoke all on function public.payment_webhook_payload_transaction_state(jsonb) from public, anon, authenticated, service_role;
revoke all on function public.payment_webhook_handle_capture(uuid, jsonb) from public, anon, authenticated, service_role;
revoke all on function public.payment_webhook_handle_rejected(uuid, jsonb) from public, anon, authenticated, service_role;
revoke all on function public.payment_webhook_handle_refund(uuid, jsonb) from public, anon, authenticated, service_role;
revoke all on function public.payment_webhook_handle_void(uuid, jsonb) from public, anon, authenticated, service_role;
revoke all on function public.payment_webhook_handle_dispute(uuid, jsonb) from public, anon, authenticated, service_role;
revoke all on function public.payment_webhook_handle_expired(uuid, jsonb) from public, anon, authenticated, service_role;
revoke all on function public.payment_webhook_handle_profile_delete(uuid, jsonb) from public, anon, authenticated, service_role;
revoke all on function public.payment_webhook_handle_profile_tokenize(uuid, jsonb) from public, anon, authenticated, service_role;
revoke all on function public.payment_webhook_handle_profile_update(uuid, jsonb) from public, anon, authenticated, service_role;
revoke all on function public.payment_webhook_handle_profile_expiring(uuid, jsonb) from public, anon, authenticated, service_role;
revoke all on function public.payment_webhook_handle_transaction_update(uuid, jsonb) from public, anon, authenticated, service_role;

revoke all on function public.payment_process_webhook_event(uuid) from public;
revoke all on function public.payment_process_webhook_event(uuid) from anon;
revoke all on function public.payment_process_webhook_event(uuid) from authenticated;

grant execute on function public.payment_process_webhook_event(uuid) to service_role;

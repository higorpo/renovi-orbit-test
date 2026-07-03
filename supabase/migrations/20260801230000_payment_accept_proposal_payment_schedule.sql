-- Payment Task 25: extend accept_proposal with payment schedule creation.
-- Baseline: docs/payment-system/rpc-dumps/accept_proposal.sql @ 20260723120000

drop function if exists public.accept_proposal(uuid, jsonb, uuid);

create or replace function public.accept_proposal(
  p_proposal_id uuid,
  p_selected_slot jsonb,
  p_idempotency_key uuid,
  p_client_card_token_id uuid,
  p_installment_number smallint,
  p_installment_selection_hmac text,
  p_installment_hmac_payload jsonb,
  p_clearsale_session_id text,
  p_pricing_signature text,
  p_client_ip text
)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_actor uuid := auth.uid();
  v_proposal public.provider_proposals%rowtype;
  v_sr public.service_requests%rowtype;
  v_service public.contracted_services%rowtype;
  v_cached jsonb;
  v_request_hash text;
  v_sla_hours int;
  v_chat_ids jsonb;
  v_chat_id uuid;
  v_response jsonb;
  v_dispatch public.service_request_dispatches%rowtype;
  v_schedule_id uuid;
  v_charge_at timestamptz;
  v_commission_rate numeric;
  v_provider_payout numeric;
  v_expected_pricing_sig text;
  v_card_token public.client_card_tokens%rowtype;
  v_schedule_inserted boolean := false;
  v_competitor_system_message constant text :=
    'Outra proposta foi aceita neste pedido.';
begin
  if v_actor is null then
    raise exception 'Authentication required for accept_proposal'
      using errcode = '42501';
  end if;

  if p_proposal_id is null then
    raise exception 'p_proposal_id is required'
      using errcode = '22023';
  end if;

  if p_idempotency_key is null then
    raise exception 'p_idempotency_key is required'
      using errcode = '22023';
  end if;

  if p_selected_slot is null or jsonb_typeof(p_selected_slot) <> 'object' then
    raise exception 'p_selected_slot must be a JSON object'
      using errcode = '22023';
  end if;

  perform public.cns_set_local_statement_timeout('15s');

  v_request_hash := md5(
    concat_ws(
      '|',
      p_proposal_id::text,
      p_selected_slot::text,
      coalesce(p_client_card_token_id::text, ''),
      coalesce(p_installment_number::text, ''),
      coalesce(p_installment_selection_hmac, ''),
      case
        when p_installment_hmac_payload is null then ''
        else public.payment_installment_hmac_canonical_text(p_installment_hmac_payload)
      end,
      coalesce(p_clearsale_session_id, ''),
      coalesce(p_pricing_signature, ''),
      coalesce(p_client_ip, '')
    )
  );

  v_cached := public.idempotency_begin(
    'chats.accept_proposal',
    p_idempotency_key,
    v_request_hash
  );

  if v_cached is not null then
    return v_cached->'response_body';
  end if;

  select *
  into v_proposal
  from public.provider_proposals pp
  where pp.id = p_proposal_id
  for update;

  if not found then
    raise exception 'Proposal not found: %', p_proposal_id
      using errcode = '22023';
  end if;

  v_chat_id := public.resolve_proposal_chat_id(
    v_proposal.service_request_id,
    v_proposal.provider_id
  );

  select *
  into v_sr
  from public.service_requests sr
  where sr.id = v_proposal.service_request_id
  for update;

  if v_sr.contracted_service_id is not null
    or v_sr.status = 'COMPLETED'::public.service_request_status then
    raise exception 'SR_ALREADY_COMPLETED'
      using
        errcode = 'P0001',
        detail = jsonb_build_object('code', 'SR_ALREADY_COMPLETED')::text;
  end if;

  if v_sr.status <> 'OPEN'::public.service_request_status then
    raise exception 'SR_NOT_OPEN'
      using
        errcode = 'P0001',
        detail = jsonb_build_object('code', 'SR_NOT_OPEN')::text;
  end if;

  if v_actor <> v_sr.client_id then
    raise exception 'Only the service request client may accept a proposal'
      using errcode = '42501';
  end if;

  perform 1
  from public.provider_proposals pp
  where pp.service_request_id = v_sr.id
  for update;

  if v_proposal.status <> 'PENDING'::public.proposal_status then
    raise exception 'PROPOSAL_NOT_ACCEPTABLE'
      using
        errcode = 'P0001',
        detail = jsonb_build_object(
          'code', 'PROPOSAL_NOT_ACCEPTABLE',
          'status', v_proposal.status
        )::text;
  end if;

  v_sla_hours := public.platform_constant_int('chats.proposal_response_sla_hours', 24);

  if coalesce(v_proposal.submitted_at, v_proposal.created_at)
    + make_interval(hours => v_sla_hours) < now() then
    raise exception 'PROPOSAL_EXPIRED'
      using
        errcode = 'P0001',
        detail = jsonb_build_object('code', 'PROPOSAL_EXPIRED')::text;
  end if;

  if not exists (
    select 1
    from jsonb_array_elements(v_proposal.proposal_suggested_slots) elem
    where elem->>'start_date' = p_selected_slot->>'start_date'
      and elem->>'shift' = p_selected_slot->>'shift'
      and coalesce(elem->>'end_date', '') = coalesce(p_selected_slot->>'end_date', '')
  ) then
    raise exception 'selected_slot must match one of proposal_suggested_slots'
      using errcode = '22023';
  end if;

  if p_client_card_token_id is null
    and public.payment_provider_is_credentialed(
      v_proposal.provider_id,
      'netcred'::public.payment_gateway_slug
    ) then
    raise exception 'PAYMENT_REQUIRED'
      using
        errcode = 'P0001',
        detail = jsonb_build_object('code', 'PAYMENT_REQUIRED')::text;
  end if;

  if p_client_card_token_id is not null then
    if p_installment_number is null
      or p_installment_selection_hmac is null
      or p_installment_hmac_payload is null
      or p_clearsale_session_id is null
      or trim(p_clearsale_session_id) = ''
      or p_pricing_signature is null
      or trim(p_pricing_signature) = '' then
      raise exception 'PAYMENT_FIELDS_REQUIRED'
        using
          errcode = '22023',
          detail = jsonb_build_object('code', 'PAYMENT_FIELDS_REQUIRED')::text;
    end if;

    if not public.payment_provider_is_credentialed(
      v_proposal.provider_id,
      'netcred'::public.payment_gateway_slug
    ) then
      raise exception 'PROVIDER_NOT_CREDENTIALED'
        using
          errcode = 'P0001',
          detail = jsonb_build_object('code', 'PROVIDER_NOT_CREDENTIALED')::text;
    end if;

    v_expected_pricing_sig := public.generate_provider_pricing_signature(
      round(v_proposal.proposed_amount::numeric, 2),
      round(v_proposal.tax_rate::numeric, 4),
      round(v_proposal.tax_amount::numeric, 2),
      round(v_proposal.final_amount::numeric, 2)
    );

    if encode(extensions.digest(p_pricing_signature, 'sha256'), 'hex')
      <> encode(extensions.digest(v_expected_pricing_sig, 'sha256'), 'hex') then
      raise exception 'PROPOSAL_PRICING_INVALID'
        using
          errcode = 'P0001',
          detail = jsonb_build_object('code', 'PROPOSAL_PRICING_INVALID')::text;
    end if;

    select *
    into v_card_token
    from public.client_card_tokens cct
    where cct.id = p_client_card_token_id
      and cct.client_id = v_actor
      and cct.state = 'ACTIVE'
      and not public.payment_client_card_token_is_expired(cct.expiry_month, cct.expiry_year)
    for update;

    if not found then
      raise exception 'PAYMENT_TOKEN_INACTIVE'
        using
          errcode = 'P0001',
          detail = jsonb_build_object('code', 'PAYMENT_TOKEN_INACTIVE')::text;
    end if;

    perform public.payment_assert_installment_hmac_context(
      p_installment_selection_hmac,
      p_installment_hmac_payload,
      p_proposal_id,
      v_sr.id,
      p_installment_number,
      round(v_proposal.proposed_amount::numeric, 2),
      v_card_token.card_brand
    );
  end if;

  update public.provider_proposals
  set
    status = 'ACCEPTED'::public.proposal_status,
    selected_slot = p_selected_slot
  where id = p_proposal_id
  returning * into v_proposal;

  select *
  into v_dispatch
  from public.service_request_dispatches d
  where d.service_request_id = v_sr.id
  for update;

  if found
    and v_dispatch.status not in (
      'DISPATCH_MATCHED'::public.service_request_dispatch_status,
      'DISPATCH_CANCELLED'::public.service_request_dispatch_status,
      'DISPATCH_EXPIRED'::public.service_request_dispatch_status
    )
  then
    insert into public.service_request_dispatch_events (
      dispatch_id,
      service_request_id,
      event_type,
      payload
    )
    values (
      v_dispatch.id,
      v_sr.id,
      'state_transition',
      jsonb_build_object('from', v_dispatch.status, 'to', 'DISPATCH_MATCHED')
    );

    update public.service_request_dispatches
    set
      status = 'DISPATCH_MATCHED'::public.service_request_dispatch_status,
      next_batch_at = null,
      updated_at = now()
    where id = v_dispatch.id;
  end if;

  update public.service_request_provider_visibility v
  set revoked_at = now()
  where v.service_request_id = v_sr.id
    and v.provider_id is distinct from v_proposal.provider_id
    and v.revoked_at is null;

  perform public.matching_cancel_pending_mmd_for_service_request(v_sr.id);

  update public.provider_proposals
  set
    status = 'REJECTED_AUTOMATICALLY'::public.proposal_status,
    client_rejection_response = coalesce(
      client_rejection_response,
      'Proposta recusada automaticamente: outra proposta foi aceita neste pedido.'
    )
  where service_request_id = v_sr.id
    and id <> p_proposal_id
    and status = 'PENDING'::public.proposal_status;

  with closed as (
    update public.chats c
    set
      status = 'CLOSED'::public.cns_conversation_status,
      closure_type = 'PROPOSAL_ACCEPTED_ELSEWHERE'::public.cns_closure_type,
      closed_at = now(),
      closed_by_user_id = v_actor,
      updated_at = now()
    where c.service_request_id = v_sr.id
      and c.status <> 'CLOSED'::public.cns_conversation_status
      and c.provider_id <> v_proposal.provider_id
    returning c.id
  ),
  inserted_system_messages as (
    insert into public.chat_messages (
      chat_id,
      sender_user_id,
      message_type,
      payload,
      linked_entity_type,
      linked_entity_id,
      idempotency_key
    )
    select
      closed.id,
      null,
      'SYSTEM'::public.cns_message_type,
      jsonb_build_object('text', v_competitor_system_message),
      'service_request',
      v_sr.id,
      gen_random_uuid()
    from closed
    returning id
  )
  select coalesce(jsonb_agg(to_jsonb(closed.id)), '[]'::jsonb)
  into v_chat_ids
  from closed;

  update public.service_request_negotiation_stats
  set
    active_chat_count = (
      select count(*)::int
      from public.chats c
      where c.service_request_id = v_sr.id
        and c.status = 'ACTIVE'::public.cns_conversation_status
    ),
    version = version + 1
  where service_request_id = v_sr.id;

  insert into public.contracted_services (
    service_request_id,
    accepted_proposal_id,
    client_id,
    provider_id,
    duration_unit,
    duration_value,
    scheduled_start_date,
    scheduled_end_date,
    scheduled_shift,
    agreed_slot,
    status
  )
  values (
    v_sr.id,
    v_proposal.id,
    v_sr.client_id,
    v_proposal.provider_id,
    v_proposal.proposal_duration_unit,
    v_proposal.proposal_duration_value,
    (p_selected_slot->>'start_date')::date,
    nullif(p_selected_slot->>'end_date', '')::date,
    p_selected_slot->>'shift',
    p_selected_slot,
    'PENDING_PAYMENT'::public.contracted_service_status
  )
  returning * into v_service;


  if p_client_card_token_id is not null then
    v_charge_at := public.payment_compute_charge_scheduled_at(v_service);

    v_commission_rate := round((v_proposal.tax_rate * 100)::numeric, 2);
    v_provider_payout := round(v_proposal.final_amount::numeric, 2);

    insert into public.payment_schedules (
      contracted_service_id,
      client_id,
      provider_id,
      client_card_token_id,
      installment_number,
      base_amount,
      commission_rate_pct,
      provider_payout,
      charge_scheduled_at,
      state,
      idempotency_key,
      clearsale_session_id,
      client_ip_address,
      max_attempts
    )
    values (
      v_service.id,
      v_sr.client_id,
      v_proposal.provider_id,
      p_client_card_token_id,
      p_installment_number,
      round(v_proposal.proposed_amount::numeric, 2),
      v_commission_rate,
      v_provider_payout,
      v_charge_at,
      'SCHEDULED',
      v_service.id::text,
      trim(p_clearsale_session_id),
      nullif(trim(coalesce(p_client_ip, '')), ''),
      public.platform_constant_int('max_charge_attempts', 3)::smallint
    )
    on conflict on constraint payment_schedules_idempotency_key_unique
    do nothing
    returning id into v_schedule_id;

    v_schedule_inserted := v_schedule_id is not null;

    if not v_schedule_inserted then
      select ps.id, ps.charge_scheduled_at
      into v_schedule_id, v_charge_at
      from public.payment_schedules ps
      where ps.idempotency_key = v_service.id::text;
    end if;

    if v_schedule_inserted then
      perform public.payment_write_audit(
        p_event_type := 'CHARGE_SCHEDULED',
        p_entity_type := 'payment_schedule',
        p_entity_id := v_schedule_id,
        p_service_id := v_service.id,
        p_schedule_id := v_schedule_id,
        p_to_state := 'SCHEDULED',
        p_actor := 'client',
        p_actor_id := v_actor,
        p_metadata := jsonb_build_object(
          'installment_number', p_installment_number,
          'charge_scheduled_at', v_charge_at,
          'base_amount', round(v_proposal.proposed_amount::numeric, 2)
        )
      );

      perform public.payment_write_event(
        p_event_type := 'ChargeScheduled',
        p_aggregate_type := 'payment_schedule',
        p_aggregate_id := v_schedule_id,
        p_service_id := v_service.id,
        p_payload := jsonb_build_object(
          'schedule_id', v_schedule_id,
          'installment_number', p_installment_number,
          'charge_scheduled_at', v_charge_at
        )
      );
    end if;
  end if;

  update public.service_requests
  set
    contracted_service_id = v_service.id,
    status = 'COMPLETED'::public.service_request_status,
    completed_at = now()
  where id = v_sr.id
  returning * into v_sr;
  v_response := jsonb_build_object(
    'service', jsonb_build_object(
      'id', v_service.id,
      'service_request_id', v_service.service_request_id,
      'accepted_proposal_id', v_service.accepted_proposal_id,
      'status', v_service.status,
      'scheduled_start_date', v_service.scheduled_start_date,
      'scheduled_shift', v_service.scheduled_shift,
      'agreed_slot', v_service.agreed_slot
    ),
    'proposal', jsonb_build_object(
      'id', v_proposal.id,
      'status', v_proposal.status,
      'selected_slot', v_proposal.selected_slot,
      'provider_id', v_proposal.provider_id,
      'chat_id', v_chat_id
    )
  ) || case
    when v_schedule_id is not null then jsonb_build_object(
      'payment_schedule', jsonb_build_object(
        'id', v_schedule_id,
        'state', 'SCHEDULED',
        'charge_scheduled_at', v_charge_at
      )
    )
    else '{}'::jsonb
  end;


  perform public.idempotency_commit(
    'chats.accept_proposal',
    p_idempotency_key,
    v_request_hash,
    200,
    v_response
  );

  raise log 'accept_proposal_total proposal_id=% service_id=% service_request_id=%',
    v_proposal.id,
    v_service.id,
    v_sr.id;

  return v_response;
exception
  when query_canceled then
    raise exception 'STATEMENT_TIMEOUT'
      using
        errcode = 'P0001',
        detail = jsonb_build_object(
          'code', 'STATEMENT_TIMEOUT',
          'operation', 'chats.accept_proposal',
          'retry', true,
          'hint', 'Retry with the same idempotency_key after timeout'
        )::text;
end;
$$;

comment on function public.accept_proposal(
  uuid, jsonb, uuid, uuid, smallint, text, jsonb, text, text, text
) is
  'Client accepts proposal with optional payment schedule creation (Task 25).';

revoke all on function public.accept_proposal(
  uuid, jsonb, uuid, uuid, smallint, text, jsonb, text, text, text
) from public;
revoke all on function public.accept_proposal(
  uuid, jsonb, uuid, uuid, smallint, text, jsonb, text, text, text
) from anon;

grant execute on function public.accept_proposal(
  uuid, jsonb, uuid, uuid, smallint, text, jsonb, text, text, text
) to authenticated;

create or replace function public.accept_proposal(
  p_proposal_id uuid,
  p_selected_slot jsonb,
  p_idempotency_key uuid
)
returns jsonb
language sql
security definer
set search_path = public
as $$
  select public.accept_proposal(
    p_proposal_id,
    p_selected_slot,
    p_idempotency_key,
    null::uuid,
    null::smallint,
    null::text,
    null::jsonb,
    null::text,
    null::text,
    null::text
  );
$$;

comment on function public.accept_proposal(uuid, jsonb, uuid) is
  'Backward-compatible accept_proposal wrapper without payment parameters.';

revoke all on function public.accept_proposal(uuid, jsonb, uuid) from public;
revoke all on function public.accept_proposal(uuid, jsonb, uuid) from anon;

grant execute on function public.accept_proposal(uuid, jsonb, uuid) to authenticated;

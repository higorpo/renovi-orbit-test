-- CNS: block service slots with start_date on or before today (America/Sao_Paulo calendar).

create or replace function public.cns_business_today()
returns date
language sql
stable
security definer
set search_path = public
as $$
  select (now() at time zone 'America/Sao_Paulo')::date;
$$;

comment on function public.cns_business_today() is
  'Current calendar date in America/Sao_Paulo for slot scheduling gates.';

revoke all on function public.cns_business_today() from public;
revoke all on function public.cns_business_today() from anon;
revoke all on function public.cns_business_today() from authenticated;

grant execute on function public.cns_business_today() to service_role;

create or replace function public.cns_assert_slot_start_date_allowed(p_start_date date)
returns void
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if p_start_date is null then
    raise exception 'Each suggested slot must include start_date'
      using errcode = '22023';
  end if;

  if p_start_date <= public.cns_business_today() then
    raise exception 'SLOT_START_DATE_TOO_SOON'
      using errcode = '22023';
  end if;
end;
$$;

comment on function public.cns_assert_slot_start_date_allowed(date) is
  'Raises SLOT_START_DATE_TOO_SOON when start_date is today or earlier (BRT calendar).';

revoke all on function public.cns_assert_slot_start_date_allowed(date) from public;
revoke all on function public.cns_assert_slot_start_date_allowed(date) from anon;
revoke all on function public.cns_assert_slot_start_date_allowed(date) from authenticated;

grant execute on function public.cns_assert_slot_start_date_allowed(date) to service_role;


create or replace function public.create_provider_proposal(
  p_service_request_id uuid,
  p_idempotency_key uuid,
  p_proposed_amount numeric,
  p_proposal_description text,
  p_proposal_duration_value integer,
  p_proposal_duration_unit text,
  p_proposal_suggested_slots jsonb,
  p_photos text[],
  p_tax_rate numeric,
  p_tax_amount numeric,
  p_final_amount numeric,
  p_pricing_signature text
)
returns jsonb
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_actor uuid := auth.uid();
  v_sr public.service_requests%rowtype;
  v_prev public.provider_proposals%rowtype;
  v_proposal public.provider_proposals%rowtype;
  v_message public.chat_messages%rowtype;
  v_chat_id uuid;
  v_version int := 1;
  v_revision_count int := 0;
  v_suggested_slots_count int;
  v_slot jsonb;
  v_start_date date;
  v_end_date date;
  v_timeline_message jsonb := null;
  v_cached jsonb;
  v_request_hash text;
  v_response jsonb;
  v_dispatch_status public.service_request_dispatch_status;
  v_slot_cap int;
  v_inflight_count int;
  v_adds_inflight boolean := false;
begin
  if v_actor is null then
    raise exception 'Authentication required for create_provider_proposal'
      using errcode = '42501';
  end if;

  if not (select public.is_provider()) then
    raise exception 'Only a provider profile may create a proposal'
      using errcode = '42501';
  end if;

  if p_service_request_id is null then
    raise exception 'p_service_request_id is required'
      using errcode = '22023';
  end if;

  if p_idempotency_key is null then
    raise exception 'p_idempotency_key is required'
      using errcode = '22023';
  end if;

  v_request_hash := md5(
    concat_ws(
      '|',
      p_service_request_id::text,
      round(p_proposed_amount::numeric, 2)::text,
      coalesce(trim(p_proposal_description), ''),
      p_proposal_duration_value::text,
      p_proposal_duration_unit,
      p_proposal_suggested_slots::text,
      p_pricing_signature
    )
  );

  v_cached := public.idempotency_begin(
    'chats.submit_proposal',
    p_idempotency_key,
    v_request_hash
  );

  if v_cached is not null then
    return v_cached->'response_body';
  end if;

  select *
  into v_sr
  from public.service_requests sr
  where sr.id = p_service_request_id
  for update;

  if not found then
    raise exception 'Service request not found'
      using errcode = '22023';
  end if;

  if v_sr.status <> 'OPEN'::public.service_request_status then
    raise exception 'SR_NOT_OPEN'
      using
        errcode = 'P0001',
        detail = jsonb_build_object('code', 'SR_NOT_OPEN')::text;
  end if;

  if v_sr.contracted_service_id is not null then
    raise exception 'SR_ALREADY_COMPLETED'
      using
        errcode = 'P0001',
        detail = jsonb_build_object('code', 'SR_ALREADY_COMPLETED')::text;
  end if;

  if p_proposed_amount is null or p_proposed_amount <= 0 then
    raise exception 'Proposed amount must be greater than zero'
      using errcode = '22023';
  end if;

  if nullif(trim(p_proposal_description), '') is null then
    raise exception 'Proposal description is required'
      using errcode = '22023';
  end if;

  if p_proposal_duration_value is null or p_proposal_duration_value <= 0 then
    raise exception 'Proposal duration value must be greater than zero'
      using errcode = '22023';
  end if;

  if p_proposal_duration_unit not in ('hours', 'days') then
    raise exception 'Proposal duration unit must be hours or days'
      using errcode = '22023';
  end if;

  if p_proposal_duration_unit = 'hours' and p_proposal_duration_value > 24 then
    raise exception 'Proposal duration in hours cannot exceed 24'
      using errcode = '22023';
  end if;

  if p_proposal_duration_unit = 'days' and p_proposal_duration_value < 2 then
    raise exception 'Day-based proposals must last at least 2 days; use hours for single-day services'
      using errcode = '22023';
  end if;

  if p_proposal_duration_unit = 'days' and p_proposal_duration_value > 7 then
    raise exception 'Proposal duration in days cannot exceed 7'
      using errcode = '22023';
  end if;

  if p_proposal_suggested_slots is null
    or jsonb_typeof(p_proposal_suggested_slots) <> 'array' then
    raise exception 'Suggested slots must be a JSON array'
      using errcode = '22023';
  end if;

  v_suggested_slots_count := jsonb_array_length(p_proposal_suggested_slots);

  if v_suggested_slots_count < 1 or v_suggested_slots_count > 3 then
    raise exception 'Suggested slots must contain between 1 and 3 options'
      using errcode = '22023';
  end if;

  for v_slot in
    select value
    from jsonb_array_elements(p_proposal_suggested_slots)
  loop
    if jsonb_typeof(v_slot) <> 'object' then
      raise exception 'Each suggested slot must be an object'
        using errcode = '22023';
    end if;

    if coalesce(v_slot->>'shift', '') not in ('morning', 'afternoon', 'full_day') then
      raise exception 'Each suggested slot must include a valid shift'
        using errcode = '22023';
    end if;

    if coalesce(v_slot->>'start_date', '') = '' then
      raise exception 'Each suggested slot must include start_date'
        using errcode = '22023';
    end if;

    begin
      v_start_date := (v_slot->>'start_date')::date;
    exception
      when others then
        raise exception 'Invalid start_date in suggested slots'
          using errcode = '22023';
    end;

    perform public.cns_assert_slot_start_date_allowed(v_start_date);

    if p_proposal_duration_unit = 'hours' then
      if v_slot ? 'end_date' and coalesce(v_slot->>'end_date', '') <> '' then
        raise exception 'Hourly proposals must not include end_date in suggested slots'
          using errcode = '22023';
      end if;
    else
      if coalesce(v_slot->>'end_date', '') = '' then
        raise exception 'Day-based proposals must include end_date in suggested slots'
          using errcode = '22023';
      end if;

      begin
        v_end_date := (v_slot->>'end_date')::date;
      exception
        when others then
          raise exception 'Invalid end_date in suggested slots'
            using errcode = '22023';
      end;

      if v_end_date < v_start_date then
        raise exception 'Suggested slot end_date cannot be before start_date'
          using errcode = '22023';
      end if;

      if (v_end_date - v_start_date + 1) <> p_proposal_duration_value
        and public.count_inclusive_working_days(v_start_date, v_end_date)
          <> p_proposal_duration_value then
        raise exception 'Each day-based slot must match the informed duration value'
          using errcode = '22023';
      end if;
    end if;
  end loop;

  select *
  into v_prev
  from public.provider_proposals pp
  where pp.provider_id = v_actor
    and pp.service_request_id = p_service_request_id
    and pp.status = 'REVISION_REQUESTED'::public.proposal_status
  for update;

  if found then
    if v_prev.revision_count >= 2 then
      raise exception 'REVISION_LIMIT_EXCEEDED'
        using
          errcode = 'P0001',
          detail = jsonb_build_object('code', 'REVISION_LIMIT_EXCEEDED')::text;
    end if;

    update public.provider_proposals
    set status = 'REVISED'::public.proposal_status
    where id = v_prev.id;

    v_version := v_prev.version + 1;
    v_revision_count := v_prev.revision_count + 1;
  else
    select *
    into v_prev
    from public.provider_proposals pp
    where pp.provider_id = v_actor
      and pp.service_request_id = p_service_request_id
      and pp.status = 'PENDING'::public.proposal_status
    for update;

    if found then
      update public.provider_proposals
      set
        status = 'REJECTED_AUTOMATICALLY'::public.proposal_status,
        client_rejection_response = coalesce(
          client_rejection_response,
          'Proposta recusada automaticamente: substituída por uma nova versão enviada pelo prestador.'
        )
      where id = v_prev.id;

      v_version := v_prev.version + 1;
      v_revision_count := v_prev.revision_count;
    else
      if exists (
        select 1
        from public.provider_proposals pp
        where pp.provider_id = v_actor
          and pp.service_request_id = p_service_request_id
          and pp.status = 'ACCEPTED'::public.proposal_status
      ) then
        raise exception 'Accepted proposals cannot be replaced'
          using errcode = '22023';
      end if;

      select
        coalesce(max(pp.version), 0) + 1,
        coalesce(max(pp.revision_count), 0)
      into v_version, v_revision_count
      from public.provider_proposals pp
      where pp.provider_id = v_actor
        and pp.service_request_id = p_service_request_id;

      v_adds_inflight := true;
    end if;
  end if;

  if v_adds_inflight then
    select d.status
    into v_dispatch_status
    from public.service_request_dispatches d
    where d.service_request_id = p_service_request_id;

    if v_dispatch_status = 'DISPATCH_STOPPED'::public.service_request_dispatch_status then
      raise exception 'DISPATCH_STOPPED'
        using
          errcode = 'P0001',
          detail = jsonb_build_object('code', 'DISPATCH_STOPPED')::text;
    end if;

    v_slot_cap := public.platform_constant_int('chats.max_active_slots_per_service_request', 4);

    select count(*)::int
    into v_inflight_count
    from public.provider_proposals pp
    where pp.service_request_id = p_service_request_id
      and pp.status in (
        'PENDING'::public.proposal_status,
        'REVISION_REQUESTED'::public.proposal_status
      );

    if v_inflight_count >= v_slot_cap then
      raise exception 'DISPATCH_STOPPED'
        using
          errcode = 'P0001',
          detail = jsonb_build_object(
            'code', 'DISPATCH_STOPPED',
            'reason', 'proposal_cap',
            'limit', v_slot_cap,
            'active_count', v_inflight_count
          )::text;
    end if;
  end if;

  begin
    insert into public.provider_proposals (
      provider_id,
      service_request_id,
      proposed_amount,
      proposal_description,
      proposal_duration_value,
      proposal_duration_unit,
      proposal_suggested_slots,
      photos,
      tax_rate,
      tax_amount,
      final_amount,
      pricing_signature,
      status,
      version,
      revision_count,
      submitted_at
    )
    values (
      v_actor,
      p_service_request_id,
      round(p_proposed_amount::numeric, 2),
      trim(p_proposal_description),
      p_proposal_duration_value,
      p_proposal_duration_unit,
      p_proposal_suggested_slots,
      coalesce(p_photos, '{}'::text[]),
      round(p_tax_rate::numeric, 4),
      round(p_tax_amount::numeric, 2),
      round(p_final_amount::numeric, 2),
      p_pricing_signature,
      'PENDING'::public.proposal_status,
      v_version,
      v_revision_count,
      now()
    )
    returning * into v_proposal;
  exception
    when others then
      if sqlerrm ilike '%pricing%' or sqlerrm ilike '%signature%' then
        raise exception 'INVALID_PRICING'
          using
            errcode = 'P0001',
            detail = jsonb_build_object(
              'code', 'INVALID_PRICING',
              'message', sqlerrm
            )::text;
      end if;

      raise;
  end;

  v_chat_id := public.resolve_proposal_chat_id(p_service_request_id, v_actor);

  if v_chat_id is not null then
    insert into public.chat_messages (
      chat_id,
      sender_user_id,
      message_type,
      payload,
      linked_entity_type,
      linked_entity_id,
      idempotency_key
    )
    values (
      v_chat_id,
      v_actor,
      'PROPOSAL'::public.cns_message_type,
      jsonb_build_object(
        'proposal_id', v_proposal.id,
        'version', v_proposal.version
      ),
      'proposal',
      v_proposal.id,
      public.mmd_idempotency_uuid(format('proposal:%s:timeline', v_proposal.id))
    )
    returning * into v_message;

    update public.chats
    set
      last_interaction_at = v_message.created_at,
      updated_at = now()
    where id = v_chat_id;

    v_timeline_message := jsonb_build_object(
      'id', v_message.id,
      'chat_id', v_message.chat_id,
      'message_type', v_message.message_type,
      'linked_entity_type', v_message.linked_entity_type,
      'linked_entity_id', v_message.linked_entity_id,
      'created_at', v_message.created_at
    );
  end if;
  v_response := jsonb_build_object(
    'id', v_proposal.id,
    'proposal', jsonb_build_object(
      'id', v_proposal.id,
      'service_request_id', v_proposal.service_request_id,
      'provider_id', v_proposal.provider_id,
      'status', v_proposal.status,
      'version', v_proposal.version,
      'revision_count', v_proposal.revision_count,
      'submitted_at', v_proposal.submitted_at,
      'proposed_amount', v_proposal.proposed_amount,
      'final_amount', v_proposal.final_amount,
      'proposal_suggested_slots', v_proposal.proposal_suggested_slots
    ),
    'timeline_message', v_timeline_message
  );

  perform public.evaluate_service_request_dispatch_gates(p_service_request_id);

  perform public.idempotency_commit(
    'chats.submit_proposal',
    p_idempotency_key,
    v_request_hash,
    200,
    v_response
  );

  return v_response;
end;
$$;

comment on function public.create_provider_proposal(
  uuid, uuid, numeric, text, integer, text, jsonb, text[], numeric, numeric, numeric, text
) is
  'Unified proposal creation RPC; enforces DISPATCH_STOPPED cap and re-evaluates dispatch gates inline.';

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
  v_rate_limit jsonb;
  v_competitor_system_message constant text :=
    'Outra proposta foi aceita neste pedido.';
begin
  if v_actor is null then
    raise exception 'Authentication required for accept_proposal'
      using errcode = '42501';
  end if;

  v_rate_limit := public.platform_check_rate_limit(
    format('accept_proposal:%s', v_actor),
    5
  );

  if not coalesce((v_rate_limit->>'allowed')::boolean, false) then
    raise exception 'RATE_LIMITED'
      using errcode = 'P0001';
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

  -- CHK-028: CPF/phone are required for payment checkout; UI steps alone are insufficient.
  if not exists (
    select 1
    from public.client_profiles_private cpp
    where cpp.client_id = v_actor
      and nullif(trim(cpp.cpf), '') is not null
  )
    or not exists (
      select 1
      from public.profiles p
      where p.id = v_actor
        and nullif(trim(p.phone), '') is not null
    ) then
    raise exception 'PROFILE_INCOMPLETE'
      using
        errcode = 'P0001',
        detail = jsonb_build_object('code', 'PROFILE_INCOMPLETE')::text;
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

  perform public.cns_assert_slot_start_date_allowed(
    (p_selected_slot->>'start_date')::date
  );

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

  if not public.payment_provider_is_credentialed(
    v_proposal.provider_id,
    'netcred'::public.payment_gateway_slug
  ) then
    raise exception 'PROVIDER_NOT_CREDENTIALED'
      using
        errcode = 'P0001',
        detail = jsonb_build_object('code', 'PROVIDER_NOT_CREDENTIALED')::text;
  end if;

  if p_client_card_token_id is null then
    raise exception 'PAYMENT_REQUIRED'
      using
        errcode = 'P0001',
        detail = jsonb_build_object('code', 'PAYMENT_REQUIRED')::text;
  end if;

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

  -- Reject client-forged ClearSale UUIDs; require a server-minted unused session (CHK-011).
  perform public.payment_consume_clearsale_session(
    trim(p_clearsale_session_id),
    v_actor,
    'accept',
    p_proposal_id,
    null
  );

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

  -- Token must be issued under Prestway platform NetCred company (marketplace model).
  if nullif(btrim(v_card_token.netcred_company_id), '')
    is distinct from public.payment_netcred_platform_company_id() then
    raise exception 'PAYMENT_TOKEN_COMPANY_MISMATCH'
      using
        errcode = 'P0001',
        detail = jsonb_build_object('code', 'PAYMENT_TOKEN_COMPANY_MISMATCH')::text;
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
    gateway_reference_code,
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
    v_service.id,
    trim(p_clearsale_session_id),
    -- CHK-011: do not persist client-asserted IP on accept (Edge headers only on manual).
    null,
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
    ),
    'payment_schedule', jsonb_build_object(
      'id', v_schedule_id,
      'state', 'SCHEDULED',
      'charge_scheduled_at', v_charge_at
    )
  );

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
  'Client accepts proposal; requires ACTIVE NetCred onboarding and full payment payload.';

create or replace function public.cns_confirm_service_reschedule(
  p_contracted_service_id uuid,
  p_new_slot jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_cs public.contracted_services%rowtype;
  v_shift text;
  v_start_date date;
  v_end_date date;
  v_payment jsonb;
  v_actor_id uuid;
begin
  if p_contracted_service_id is null then
    raise exception 'p_contracted_service_id is required'
      using errcode = '22023';
  end if;

  if p_new_slot is null or jsonb_typeof(p_new_slot) <> 'object' then
    raise exception 'INVALID_SLOT'
      using errcode = '22023';
  end if;

  v_actor_id := auth.uid();
  if v_actor_id is null then
    raise exception 'Authentication required for cns_confirm_service_reschedule'
      using errcode = '42501';
  end if;

  v_shift := nullif(btrim(p_new_slot->>'shift'), '');
  if v_shift not in ('morning', 'afternoon', 'full_day') then
    raise exception 'INVALID_SLOT_SHIFT'
      using errcode = '22023';
  end if;

  begin
    v_start_date := (p_new_slot->>'start_date')::date;
  exception
    when others then
      raise exception 'INVALID_SLOT_START_DATE'
        using errcode = '22023';
  end;

  if v_start_date is null then
    raise exception 'INVALID_SLOT_START_DATE'
      using errcode = '22023';
  end if;

  perform public.cns_assert_slot_start_date_allowed(v_start_date);

  v_end_date := nullif(btrim(p_new_slot->>'end_date'), '')::date;

  select cs.*
  into v_cs
  from public.contracted_services cs
  where cs.id = p_contracted_service_id
  for update;

  if not found then
    raise exception 'CONTRACTED_SERVICE_NOT_FOUND'
      using errcode = 'P0002';
  end if;

  if v_actor_id <> v_cs.client_id and v_actor_id <> v_cs.provider_id then
    raise exception 'FORBIDDEN'
      using errcode = '42501';
  end if;

  if v_cs.status = 'CANCELLED'::public.contracted_service_status then
    raise exception 'SERVICE_CANCELLED'
      using errcode = 'P0001';
  end if;

  if v_cs.status in (
    'EXECUTED'::public.contracted_service_status,
    'COMPLETED'::public.contracted_service_status
  ) then
    raise exception 'RESCHEDULE_NOT_ALLOWED'
      using errcode = 'P0001';
  end if;

  update public.contracted_services cs
  set
    scheduled_start_date = v_start_date,
    scheduled_end_date = v_end_date,
    scheduled_shift = v_shift,
    agreed_slot = p_new_slot,
    updated_at = now()
  where cs.id = p_contracted_service_id
  returning * into v_cs;

  perform set_config('request.jwt.claim.role', 'service_role', true);
  perform set_config(
    'request.jwt.claims',
    json_build_object('role', 'service_role')::text,
    true
  );

  v_payment := public.payment_reschedule_charge_date(p_contracted_service_id);

  raise log 'cns_confirm_service_reschedule service_id=% actor_id=% payment_outcome=%',
    p_contracted_service_id,
    v_actor_id,
    v_payment->>'outcome';

  return jsonb_build_object(
    'contracted_service_id', p_contracted_service_id,
    'scheduled_start_date', v_cs.scheduled_start_date,
    'scheduled_end_date', v_cs.scheduled_end_date,
    'scheduled_shift', v_cs.scheduled_shift,
    'agreed_slot', v_cs.agreed_slot,
    'service_status', v_cs.status,
    'payment', v_payment
  );
end;
$$;

comment on function public.cns_confirm_service_reschedule(uuid, jsonb) is
  'Confirms negotiated service reschedule, updates slot columns, and invokes payment_reschedule_charge_date.';

revoke all on function public.cns_confirm_service_reschedule(uuid, jsonb) from public;
revoke all on function public.cns_confirm_service_reschedule(uuid, jsonb) from anon;
revoke all on function public.cns_confirm_service_reschedule(uuid, jsonb) from service_role;

grant execute on function public.cns_confirm_service_reschedule(uuid, jsonb) to authenticated;

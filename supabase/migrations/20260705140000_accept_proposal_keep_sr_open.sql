-- Keep service_requests OPEN after accept; SR COMPLETED only when the contracted service is fulfilled later.

comment on column public.service_requests.completed_at is
  'Set when status becomes COMPLETED after contracted service fulfillment (not on proposal accept).';

-- Keep the accepted provider's chat open; close only competing provider chats on accept.

create or replace function public.accept_proposal(
  p_proposal_id uuid,
  p_selected_slot jsonb,
  p_idempotency_key uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_actor uuid := auth.uid();
  v_proposal public.provider_proposals%rowtype;
  v_sr public.service_requests%rowtype;
  v_service public.services%rowtype;
  v_cached jsonb;
  v_request_hash text;
  v_sla_hours int;
  v_chat_ids jsonb;
  v_chat_id uuid;
  v_response jsonb;
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

  perform public.cns_set_local_statement_timeout('5s');

  v_request_hash := md5(
    concat_ws(
      '|',
      p_proposal_id::text,
      p_selected_slot::text
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

  update public.provider_proposals
  set
    status = 'ACCEPTED'::public.proposal_status,
    selected_slot = p_selected_slot
  where id = p_proposal_id
  returning * into v_proposal;

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

  insert into public.services (
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

  update public.service_requests
  set contracted_service_id = v_service.id
  where id = v_sr.id;

  perform public.record_domain_event(
    'PROPOSAL_ACCEPTED',
    'proposal',
    v_proposal.id,
    v_sr.id,
    v_chat_id,
    jsonb_build_object(
      'idempotency_key',
      format('proposal:%s:accepted', v_proposal.id),
      'proposal_id', v_proposal.id,
      'service_id', v_service.id,
      'selected_slot', p_selected_slot
    )
  );

  perform public.record_domain_event(
    'CHATS_CLOSED_BULK',
    'service_request',
    v_sr.id,
    v_sr.id,
    null,
    jsonb_build_object(
      'idempotency_key',
      format('service_request:%s:chats_closed_bulk', v_sr.id),
      'service_request_id', v_sr.id,
      'chat_ids', v_chat_ids,
      'closed_count', jsonb_array_length(v_chat_ids),
      'kept_open_provider_id', v_proposal.provider_id
    )
  );

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

comment on function public.accept_proposal(uuid, jsonb, uuid) is
  'Atomic accept cascade: proposal ACCEPTED, contracted services row, SR stays OPEN; closes competing chats only (SERVICE_REQUEST_COMPLETED deferred until service fulfillment).';


-- Block new proposals once a proposal has been accepted (contract exists).

create or replace function public.create_provider_proposal(
  p_service_request_id uuid,
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

    if v_start_date < current_date then
      raise exception 'Suggested slot start_date cannot be in the past'
        using errcode = '22023';
    end if;

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

      if (v_end_date - v_start_date + 1) <> p_proposal_duration_value then
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
      raise exception 'PROPOSAL_ALREADY_PENDING'
        using
          errcode = 'P0001',
          detail = jsonb_build_object('code', 'PROPOSAL_ALREADY_PENDING')::text;
    end if;

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

  perform public.record_domain_event(
    'PROPOSAL_SUBMITTED',
    'proposal',
    v_proposal.id,
    p_service_request_id,
    v_chat_id,
    jsonb_build_object(
      'idempotency_key',
      format('proposal:%s:submitted', v_proposal.id),
      'proposal_id', v_proposal.id,
      'version', v_proposal.version,
      'chat_id', v_chat_id
    )
  );

  return jsonb_build_object(
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
end;
$$;

comment on function public.create_provider_proposal(
  uuid,
  numeric,
  text,
  integer,
  text,
  jsonb,
  text[],
  numeric,
  numeric,
  numeric,
  text
) is
  'Canonical proposal creation by service_request_id; terminal rejections stay unchanged; REVISED only supersedes REVISION_REQUESTED.';

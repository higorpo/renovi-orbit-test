-- Remove domain_events emission from mutation RPCs (notifications via triggers).

-- cns_send_message (from 20260705201000_support_chat_audio_messages.sql)
create or replace function public.cns_send_message(
  p_message_type public.cns_message_type,
  p_idempotency_key uuid,
  p_payload jsonb default '{}'::jsonb,
  p_chat_id uuid default null,
  p_service_request_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_started_at timestamptz := clock_timestamp();
  v_actor uuid := auth.uid();
  v_chat public.chats%rowtype;
  v_sr public.service_requests%rowtype;
  v_stats public.service_request_negotiation_stats%rowtype;
  v_message public.chat_messages%rowtype;
  v_existing_message public.chat_messages%rowtype;
  v_slot_limit int;
  v_is_new_chat boolean := false;
  v_upload_session_id uuid;
  v_image_paths text[];
  v_audio_path text;
  v_duration_ms bigint;
begin
  if v_actor is null then
    raise exception 'Authentication required for cns_send_message'
      using errcode = '42501';
  end if;

  if p_idempotency_key is null then
    raise exception 'p_idempotency_key is required'
      using errcode = '22023';
  end if;

  if p_payload is null then
    raise exception 'p_payload must not be null'
      using errcode = '22023';
  end if;

  if p_message_type not in (
    'TEXT'::public.cns_message_type,
    'IMAGE'::public.cns_message_type,
    'AUDIO'::public.cns_message_type
  ) then
    raise exception 'Unsupported message_type for cns_send_message: %', p_message_type
      using errcode = '22023';
  end if;

  if p_message_type = 'IMAGE'::public.cns_message_type then
    begin
      v_upload_session_id := (p_payload->>'upload_session_id')::uuid;
    exception
      when others then
        raise exception 'upload_session_id must be a valid uuid for IMAGE messages'
          using errcode = '22023';
    end;

    if v_upload_session_id is null then
      raise exception 'upload_session_id required for IMAGE messages'
        using errcode = '22023';
    end if;

    if jsonb_typeof(p_payload->'paths') <> 'array'
      or jsonb_array_length(p_payload->'paths') < 1 then
      raise exception 'paths array required for IMAGE messages'
        using errcode = '22023';
    end if;

    select array_agg(value order by ordinality)
    into v_image_paths
    from jsonb_array_elements_text(p_payload->'paths') with ordinality as t(value, ordinality);

    if v_image_paths is null or array_length(v_image_paths, 1) > 5 then
      raise exception 'IMAGE messages support 1 to 5 storage paths'
        using errcode = '22023';
    end if;
  end if;

  if p_message_type = 'AUDIO'::public.cns_message_type then
    begin
      v_upload_session_id := (p_payload->>'upload_session_id')::uuid;
    exception
      when others then
        raise exception 'upload_session_id must be a valid uuid for AUDIO messages'
          using errcode = '22023';
    end;

    if v_upload_session_id is null then
      raise exception 'upload_session_id required for AUDIO messages'
        using errcode = '22023';
    end if;

    v_audio_path := nullif(trim(p_payload->>'path'), '');

    if v_audio_path is null then
      raise exception 'path required for AUDIO messages'
        using errcode = '22023';
    end if;

    begin
      v_duration_ms := (p_payload->>'duration_ms')::bigint;
    exception
      when others then
        raise exception 'duration_ms must be a valid integer for AUDIO messages'
          using errcode = '22023';
    end;

    if v_duration_ms is null or v_duration_ms < 1 or v_duration_ms > 120000 then
      raise exception 'AUDIO duration_ms must be between 1 and 120000'
        using errcode = '22023';
    end if;

    if nullif(trim(p_payload->>'mime_type'), '') is null then
      raise exception 'mime_type required for AUDIO messages'
        using errcode = '22023';
    end if;
  end if;

  if p_chat_id is not null then
    select *
    into v_chat
    from public.chats c
    where c.id = p_chat_id
    for update;

    if not found then
      raise exception 'Chat not found'
        using errcode = '42501';
    end if;

    if v_actor not in (v_chat.client_id, v_chat.provider_id) then
      raise exception 'NOT_A_PARTICIPANT'
        using errcode = '42501';
    end if;

    select *
    into v_sr
    from public.service_requests sr
    where sr.id = v_chat.service_request_id
    for update;
  else
    if p_service_request_id is null then
      raise exception 'p_chat_id or p_service_request_id is required'
        using errcode = '22023';
    end if;

    select *
    into v_sr
    from public.service_requests sr
    where sr.id = p_service_request_id
    for update;

    if not found then
      raise exception 'Service request not found: %', p_service_request_id
        using errcode = '22023';
    end if;

    select *
    into v_chat
    from public.chats c
    where c.service_request_id = p_service_request_id
      and c.provider_id = v_actor
    for update;

    if not found then
      if v_actor = v_sr.client_id then
        raise exception 'Only the provider may initiate a new conversation'
          using errcode = '42501';
      end if;

      insert into public.service_request_negotiation_stats (service_request_id)
      values (v_sr.id)
      on conflict (service_request_id) do nothing;

      select *
      into v_stats
      from public.service_request_negotiation_stats s
      where s.service_request_id = v_sr.id
      for update;

      v_slot_limit := public.platform_constant_int(
        'chats.max_active_slots_per_service_request',
        4
      );

      if v_stats.active_chat_count >= v_slot_limit then
        raise log 'cns_slot_rejection_total service_request_id=% active_chat_count=% slot_limit=%',
          v_sr.id,
          v_stats.active_chat_count,
          v_slot_limit;

        raise exception 'NO_ACTIVE_SLOT'
          using
            errcode = 'P0001',
            detail = jsonb_build_object('code', 'NO_ACTIVE_SLOT')::text;
      end if;

      begin
        insert into public.chats (
          service_request_id,
          client_id,
          provider_id,
          status,
          activated_at,
          last_interaction_at
        )
        values (
          v_sr.id,
          v_sr.client_id,
          v_actor,
          'ACTIVE'::public.cns_conversation_status,
          now(),
          now()
        )
        returning * into v_chat;

        v_is_new_chat := true;
      exception
        when unique_violation then
          select *
          into v_chat
          from public.chats c
          where c.service_request_id = p_service_request_id
            and c.provider_id = v_actor
          for update;
      end;

      if v_is_new_chat then
        update public.service_request_negotiation_stats
        set
          active_chat_count = active_chat_count + 1,
          version = version + 1
        where service_request_id = v_sr.id;
      end if;
    elsif v_actor not in (v_chat.client_id, v_chat.provider_id) then
      raise exception 'NOT_A_PARTICIPANT'
        using errcode = '42501';
    end if;
  end if;

  if not public.cns_service_request_allows_chat_messaging(v_sr.id, v_chat.id) then
    raise exception 'SR_NOT_OPEN'
      using
        errcode = 'P0001',
        detail = jsonb_build_object('code', 'SR_NOT_OPEN')::text;
  end if;

  if v_chat.status = 'CLOSED'::public.cns_conversation_status then
    raise exception 'CONVERSATION_CLOSED'
      using
        errcode = 'P0001',
        detail = jsonb_build_object(
          'code', 'CONVERSATION_CLOSED',
          'closure_type', v_chat.closure_type,
          'closure_reason', v_chat.closure_reason
        )::text;
  end if;

  if v_chat.status = 'INACTIVE'::public.cns_conversation_status then
    update public.chats
    set
      status = 'ACTIVE'::public.cns_conversation_status,
      inactivated_at = null,
      inactivation_reason = null,
      activated_at = coalesce(activated_at, now()),
      updated_at = now()
    where id = v_chat.id
    returning * into v_chat;
  end if;

  select *
  into v_existing_message
  from public.chat_messages m
  where m.chat_id = v_chat.id
    and m.sender_user_id = v_actor
    and m.idempotency_key = p_idempotency_key;

  if found then
    raise log 'cns_send_message_idempotency_hit chat_id=% message_id=% idempotency_key=%',
      v_chat.id,
      v_existing_message.id,
      p_idempotency_key;

    return jsonb_build_object(
      'message', jsonb_build_object(
        'id', v_existing_message.id,
        'chat_id', v_existing_message.chat_id,
        'sender_user_id', v_existing_message.sender_user_id,
        'message_type', v_existing_message.message_type,
        'payload', v_existing_message.payload,
        'idempotency_key', v_existing_message.idempotency_key,
        'created_at', v_existing_message.created_at
      ),
      'conversation', jsonb_build_object(
        'id', v_chat.id,
        'service_request_id', v_chat.service_request_id,
        'client_id', v_chat.client_id,
        'provider_id', v_chat.provider_id,
        'status', v_chat.status,
        'last_interaction_at', v_chat.last_interaction_at
      )
    );
  end if;

  if not public.cns_chat_free_messaging_allowed(v_chat.id) then
    raise exception 'FREE_MESSAGING_DISABLED_PROPOSAL_PENDING'
      using
        errcode = 'P0001',
        detail = jsonb_build_object(
          'code', 'FREE_MESSAGING_DISABLED_PROPOSAL_PENDING'
        )::text;
  end if;

  perform public.cns_check_message_rate_limit(v_chat.id);

  insert into public.chat_messages (
    chat_id,
    sender_user_id,
    message_type,
    payload,
    idempotency_key
  )
  values (
    v_chat.id,
    v_actor,
    p_message_type,
    p_payload,
    p_idempotency_key
  )
  returning * into v_message;

  if p_message_type = 'IMAGE'::public.cns_message_type then
    perform public.cns_attach_message_media(
      v_chat.id,
      v_upload_session_id,
      v_image_paths
    );
  end if;

  if p_message_type = 'AUDIO'::public.cns_message_type then
    perform public.cns_attach_message_media(
      v_chat.id,
      v_upload_session_id,
      array[v_audio_path]
    );
  end if;

  update public.chats
  set
    last_interaction_at = v_message.created_at,
    updated_at = now()
  where id = v_chat.id
  returning * into v_chat;
  raise log 'cns_send_message_duration_ms=% chat_id=% message_id=% message_type=% new_chat=%',
    round(extract(epoch from (clock_timestamp() - v_started_at)) * 1000)::bigint,
    v_chat.id,
    v_message.id,
    p_message_type,
    v_is_new_chat;

  return jsonb_build_object(
    'message', jsonb_build_object(
      'id', v_message.id,
      'chat_id', v_message.chat_id,
      'sender_user_id', v_message.sender_user_id,
      'message_type', v_message.message_type,
      'payload', v_message.payload,
      'idempotency_key', v_message.idempotency_key,
      'created_at', v_message.created_at
    ),
    'conversation', jsonb_build_object(
      'id', v_chat.id,
      'service_request_id', v_chat.service_request_id,
      'client_id', v_chat.client_id,
      'provider_id', v_chat.provider_id,
      'status', v_chat.status,
      'last_interaction_at', v_chat.last_interaction_at
    )
  );
end;
$$;

-- create_provider_proposal (from 20260705218100_create_provider_proposal_idempotency.sql)
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

-- accept_proposal (from 20260705207000_rename_services_to_contracted_services.sql)
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
  v_service public.contracted_services%rowtype;
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

-- reject_proposal (from 20260701110200_proposal_update_dependent_rpcs.sql)
create or replace function public.reject_proposal(
  p_proposal_id uuid,
  p_idempotency_key uuid,
  p_rejection_reason text
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
  v_cached jsonb;
  v_request_hash text;
  v_chat_id uuid;
  v_response jsonb;
begin
  if v_actor is null then
    raise exception 'Authentication required for reject_proposal'
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

  if nullif(trim(p_rejection_reason), '') is null then
    raise exception 'p_rejection_reason is required'
      using errcode = '22023';
  end if;

  v_request_hash := md5(
    concat_ws('|', p_proposal_id::text, trim(p_rejection_reason))
  );

  v_cached := public.idempotency_begin(
    'chats.reject_proposal',
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

  if v_actor <> v_sr.client_id then
    raise exception 'Only the service request client may reject a proposal'
      using errcode = '42501';
  end if;

  if v_sr.status <> 'OPEN'::public.service_request_status then
    raise exception 'SR_NOT_OPEN'
      using
        errcode = 'P0001',
        detail = jsonb_build_object('code', 'SR_NOT_OPEN')::text;
  end if;

  update public.provider_proposals
  set
    status = 'REJECTED'::public.proposal_status,
    client_rejection_response = trim(p_rejection_reason),
    updated_at = now()
  where id = p_proposal_id
    and status = 'PENDING'::public.proposal_status
  returning * into v_proposal;

  if not found then
    raise exception 'PROPOSAL_NOT_ACCEPTABLE'
      using
        errcode = 'P0001',
        detail = jsonb_build_object('code', 'PROPOSAL_NOT_ACCEPTABLE')::text;
  end if;
  v_response := jsonb_build_object(
    'proposal', jsonb_build_object(
      'id', v_proposal.id,
      'status', v_proposal.status,
      'client_rejection_response', v_proposal.client_rejection_response,
      'chat_id', v_chat_id,
      'service_request_id', v_proposal.service_request_id,
      'rejected_at', v_proposal.updated_at
    )
  );

  perform public.idempotency_commit(
    'chats.reject_proposal',
    p_idempotency_key,
    v_request_hash,
    200,
    v_response
  );

  raise log 'reject_proposal_total proposal_id=% chat_id=%',
    v_proposal.id,
    v_chat_id;

  return v_response;
end;
$$;

-- request_proposal_revision (from 20260701110200_proposal_update_dependent_rpcs.sql)
create or replace function public.request_proposal_revision(
  p_proposal_id uuid,
  p_idempotency_key uuid,
  p_revision_reason public.proposal_revision_reason,
  p_revision_notes text default null
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
  v_cached jsonb;
  v_request_hash text;
  v_chat_id uuid;
  v_response jsonb;
begin
  if v_actor is null then
    raise exception 'Authentication required for request_proposal_revision'
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

  if p_revision_reason is null then
    raise exception 'p_revision_reason is required'
      using errcode = '22023';
  end if;

  if p_revision_notes is not null
    and char_length(trim(p_revision_notes)) > 2000 then
    raise exception 'p_revision_notes must be at most 2000 characters'
      using errcode = '22023';
  end if;

  v_request_hash := md5(
    concat_ws(
      '|',
      p_proposal_id::text,
      p_revision_reason::text,
      coalesce(trim(p_revision_notes), '')
    )
  );

  v_cached := public.idempotency_begin(
    'chats.request_proposal_revision',
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

  if v_actor <> v_sr.client_id then
    raise exception 'Only the service request client may request a proposal revision'
      using errcode = '42501';
  end if;

  if v_sr.status <> 'OPEN'::public.service_request_status then
    raise exception 'SR_NOT_OPEN'
      using
        errcode = 'P0001',
        detail = jsonb_build_object('code', 'SR_NOT_OPEN')::text;
  end if;

  if v_proposal.revision_count >= 2 then
    raise exception 'REVISION_LIMIT_EXCEEDED'
      using
        errcode = 'P0001',
        detail = jsonb_build_object('code', 'REVISION_LIMIT_EXCEEDED')::text;
  end if;

  update public.provider_proposals
  set
    status = 'REVISION_REQUESTED'::public.proposal_status,
    revision_reason = p_revision_reason,
    revision_notes = nullif(trim(p_revision_notes), ''),
    updated_at = now()
  where id = p_proposal_id
    and status = 'PENDING'::public.proposal_status
  returning * into v_proposal;

  if not found then
    raise exception 'PROPOSAL_NOT_ACCEPTABLE'
      using
        errcode = 'P0001',
        detail = jsonb_build_object('code', 'PROPOSAL_NOT_ACCEPTABLE')::text;
  end if;
  v_response := jsonb_build_object(
    'proposal', jsonb_build_object(
      'id', v_proposal.id,
      'status', v_proposal.status,
      'revision_count', v_proposal.revision_count,
      'revision_reason', v_proposal.revision_reason,
      'revision_notes', v_proposal.revision_notes,
      'chat_id', v_chat_id,
      'service_request_id', v_proposal.service_request_id
    )
  );

  perform public.idempotency_commit(
    'chats.request_proposal_revision',
    p_idempotency_key,
    v_request_hash,
    200,
    v_response
  );

  raise log 'request_proposal_revision_total proposal_id=% revision_reason=%',
    v_proposal.id,
    p_revision_reason;

  return v_response;
end;
$$;

-- cns_close_conversation (from 20260701103400_create_cns_close_conversation.sql)
create or replace function public.cns_close_conversation(
  p_chat_id uuid,
  p_idempotency_key uuid,
  p_confirm boolean,
  p_closure_reason text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_actor uuid := auth.uid();
  v_chat public.chats%rowtype;
  v_stats public.service_request_negotiation_stats%rowtype;
  v_was_active boolean;
  v_cached jsonb;
  v_request_hash text;
  v_response jsonb;
begin
  if v_actor is null then
    raise exception 'Authentication required for cns_close_conversation'
      using errcode = '42501';
  end if;

  if p_chat_id is null then
    raise exception 'p_chat_id is required'
      using errcode = '22023';
  end if;

  if p_idempotency_key is null then
    raise exception 'p_idempotency_key is required'
      using errcode = '22023';
  end if;

  if p_confirm is distinct from true then
    raise exception 'Manual close requires p_confirm = true'
      using errcode = '22023';
  end if;

  if p_closure_reason is not null
    and char_length(trim(p_closure_reason)) > 2000 then
    raise exception 'p_closure_reason must be at most 2000 characters'
      using errcode = '22023';
  end if;

  v_request_hash := md5(
    concat_ws(
      '|',
      p_chat_id::text,
      coalesce(nullif(trim(p_closure_reason), ''), '')
    )
  );

  v_cached := public.idempotency_begin(
    'chats.close_conversation',
    p_idempotency_key,
    v_request_hash
  );

  if v_cached is not null then
    return v_cached->'response_body';
  end if;

  select *
  into v_chat
  from public.chats c
  where c.id = p_chat_id
  for update;

  if not found then
    raise exception 'Chat not found: %', p_chat_id
      using errcode = '22023';
  end if;

  if v_actor not in (v_chat.client_id, v_chat.provider_id) then
    raise exception 'NOT_A_PARTICIPANT'
      using errcode = '42501';
  end if;

  if v_chat.status = 'CLOSED'::public.cns_conversation_status then
    raise exception 'CONVERSATION_CLOSED'
      using
        errcode = 'P0001',
        detail = jsonb_build_object('code', 'CONVERSATION_CLOSED')::text;
  end if;

  v_was_active := v_chat.status = 'ACTIVE'::public.cns_conversation_status;

  update public.chats
  set
    status = 'CLOSED'::public.cns_conversation_status,
    closure_type = 'MANUAL'::public.cns_closure_type,
    closed_at = now(),
    closed_by_user_id = v_actor,
    closure_reason = nullif(trim(p_closure_reason), ''),
    updated_at = now()
  where id = p_chat_id
  returning * into v_chat;

  if v_was_active then
    select *
    into v_stats
    from public.service_request_negotiation_stats s
    where s.service_request_id = v_chat.service_request_id
    for update;

    if found then
      update public.service_request_negotiation_stats
      set
        active_chat_count = greatest(active_chat_count - 1, 0),
        version = version + 1
      where service_request_id = v_chat.service_request_id;
    end if;
  end if;
  v_response := jsonb_build_object(
    'conversation', jsonb_build_object(
      'id', v_chat.id,
      'service_request_id', v_chat.service_request_id,
      'client_id', v_chat.client_id,
      'provider_id', v_chat.provider_id,
      'status', v_chat.status,
      'closure_type', v_chat.closure_type,
      'closure_reason', v_chat.closure_reason,
      'closed_at', v_chat.closed_at,
      'closed_by_user_id', v_chat.closed_by_user_id
    )
  );

  perform public.idempotency_commit(
    'chats.close_conversation',
    p_idempotency_key,
    v_request_hash,
    200,
    v_response
  );

  raise log 'cns_close_conversation_total chat_id=% was_active=%',
    v_chat.id,
    v_was_active;

  return v_response;
end;
$$;

-- cancel_service_request (from 20260706040000_align_sr_cancel_proposal_rejection.sql)
create or replace function public.cancel_service_request(
  p_service_request_id uuid,
  p_idempotency_key uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_actor uuid := auth.uid();
  v_sr public.service_requests%rowtype;
  v_cached jsonb;
  v_request_hash text;
  v_chat_ids jsonb;
  v_response jsonb;
begin
  if v_actor is null then
    raise exception 'Authentication required for cancel_service_request'
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

  v_request_hash := md5(p_service_request_id::text);

  v_cached := public.idempotency_begin(
    'chats.cancel_service_request',
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
    raise exception 'Service request not found: %', p_service_request_id
      using errcode = '22023';
  end if;

  if v_actor <> v_sr.client_id then
    raise exception 'Only the service request client may cancel'
      using errcode = '42501';
  end if;

  if v_sr.status = 'COMPLETED'::public.service_request_status then
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

  perform 1
  from public.provider_proposals pp
  where pp.service_request_id = v_sr.id
  for update;

  perform public.reject_non_terminal_proposals_on_sr_cancel(v_sr.id);

  update public.service_requests
  set
    status = 'CANCELLED'::public.service_request_status,
    cancelled_at = now(),
    updated_at = now()
  where id = v_sr.id
  returning * into v_sr;

  with closed as (
    update public.chats c
    set
      status = 'CLOSED'::public.cns_conversation_status,
      closure_type = 'SERVICE_REQUEST_CANCELLED'::public.cns_closure_type,
      closed_at = now(),
      closed_by_user_id = v_actor,
      updated_at = now()
    where c.service_request_id = v_sr.id
      and c.status <> 'CLOSED'::public.cns_conversation_status
    returning c.id
  )
  select coalesce(jsonb_agg(to_jsonb(closed.id)), '[]'::jsonb)
  into v_chat_ids
  from closed;

  update public.service_request_negotiation_stats
  set
    active_chat_count = 0,
    version = version + 1
  where service_request_id = v_sr.id;
  v_response := jsonb_build_object(
    'service_request', jsonb_build_object(
      'id', v_sr.id,
      'client_id', v_sr.client_id,
      'status', v_sr.status,
      'cancelled_at', v_sr.cancelled_at
    )
  );

  perform public.idempotency_commit(
    'chats.cancel_service_request',
    p_idempotency_key,
    v_request_hash,
    200,
    v_response
  );

  raise log 'cancel_service_request_total service_request_id=% closed_chats=%',
    v_sr.id,
    jsonb_array_length(v_chat_ids);

  return v_response;
end;
$$;

-- expire_pending_proposals (from 20260701110200_proposal_update_dependent_rpcs.sql)
create or replace function public.expire_pending_proposals(
  p_batch_size int default 500
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_started_at timestamptz := clock_timestamp();
  v_job_run_id bigint;
  v_sla_hours int;
  v_window_hours int;
  v_processed int := 0;
  v_expired_count int := 0;
  v_inactivated_count int := 0;
  v_error_count int := 0;
  v_max_lag_seconds numeric := 0;
  v_row_lag_seconds numeric;
  v_proposal record;
  v_chat public.chats%rowtype;
  v_chat_id uuid;
  v_active_count int;
  v_duration_ms int;
  v_has_recent_activity boolean;
begin
  if p_batch_size is null or p_batch_size < 1 or p_batch_size > 500 then
    raise exception 'p_batch_size must be between 1 and 500'
      using errcode = '22023';
  end if;

  perform public.cns_set_local_statement_timeout('120s');

  v_job_run_id := public.job_run_begin('proposal_expire_pending', 'v1');

  v_sla_hours := public.platform_constant_int('chats.proposal_response_sla_hours', 24);
  v_window_hours := public.platform_constant_int('chats.reciprocity_window_hours', 24);

  for v_proposal in
    select pp.*
    from public.provider_proposals pp
    inner join public.service_requests sr on sr.id = pp.service_request_id
    where pp.status = 'PENDING'::public.proposal_status
      and coalesce(pp.submitted_at, pp.created_at)
        + make_interval(hours => v_sla_hours) < now()
      and sr.status = 'OPEN'::public.service_request_status
    order by pp.submitted_at
    for update of pp skip locked
    limit p_batch_size
  loop
    begin
      v_processed := v_processed + 1;

      v_row_lag_seconds := extract(
        epoch from (
          now() - (
            coalesce(v_proposal.submitted_at, v_proposal.created_at)
            + make_interval(hours => v_sla_hours)
          )
        )
      );

      if v_row_lag_seconds > v_max_lag_seconds then
        v_max_lag_seconds := v_row_lag_seconds;
      end if;

      update public.provider_proposals
      set
        status = 'EXPIRED'::public.proposal_status,
        expired_at = now(),
        updated_at = now()
      where id = v_proposal.id
        and status = 'PENDING'::public.proposal_status
      returning * into v_proposal;

      if not found then
        continue;
      end if;

      v_chat_id := public.resolve_proposal_chat_id(
        v_proposal.service_request_id,
        v_proposal.provider_id
      );
      v_expired_count := v_expired_count + 1;

      if v_chat_id is null then
        continue;
      end if;

      select *
      into v_chat
      from public.chats c
      where c.id = v_chat_id;

      if v_chat.status = 'CLOSED'::public.cns_conversation_status then
        continue;
      end if;

      select exists (
        select 1
        from public.chat_messages m
        where m.chat_id = v_chat.id
          and m.message_type in (
            'TEXT'::public.cns_message_type,
            'IMAGE'::public.cns_message_type,
            'PROPOSAL'::public.cns_message_type
          )
          and m.created_at >= now() - (v_window_hours || ' hours')::interval
      )
      into v_has_recent_activity;

      if v_has_recent_activity
        or v_chat.status <> 'ACTIVE'::public.cns_conversation_status then
        continue;
      end if;

      update public.chats
      set
        status = 'INACTIVE'::public.cns_conversation_status,
        inactivated_at = now(),
        inactivation_reason = 'NO_RECIPROCITY'::public.cns_inactivation_reason,
        updated_at = now()
      where id = v_chat.id
        and status = 'ACTIVE'::public.cns_conversation_status;

      if not found then
        continue;
      end if;

      insert into public.service_request_negotiation_stats (service_request_id)
      values (v_chat.service_request_id)
      on conflict (service_request_id) do nothing;

      update public.service_request_negotiation_stats
      set
        active_chat_count = greatest(active_chat_count - 1, 0),
        version = version + 1
      where service_request_id = v_chat.service_request_id
      returning active_chat_count into v_active_count;
      v_inactivated_count := v_inactivated_count + 1;
    exception
      when others then
        v_error_count := v_error_count + 1;
        raise log 'expire_pending_proposals row_error proposal_id=% sqlstate=% message=%',
          v_proposal.id,
          sqlstate,
          sqlerrm;
    end;
  end loop;

  v_duration_ms := (
    extract(epoch from (clock_timestamp() - v_started_at)) * 1000
  )::int;

  perform public.job_run_finish(
    v_job_run_id,
    v_started_at,
    v_processed,
    v_expired_count,
    v_error_count,
    jsonb_build_object(
      'inactivated_count', v_inactivated_count,
      'max_lag_seconds', v_max_lag_seconds
    )
  );

  raise log 'cns_proposal_expiry_lag_seconds=% processed=% expired=% inactivated=%',
    v_max_lag_seconds,
    v_processed,
    v_expired_count,
    v_inactivated_count;

  return jsonb_build_object(
    'job_run_id', v_job_run_id,
    'processed_count', v_processed,
    'expired_count', v_expired_count,
    'inactivated_count', v_inactivated_count,
    'error_count', v_error_count,
    'duration_ms', v_duration_ms,
    'max_lag_seconds', v_max_lag_seconds
  );
end;
$$;

-- cns_evaluate_reciprocity_batch (from 20260701107300_add_statement_timeout_guards.sql)
create or replace function public.cns_evaluate_reciprocity_batch(
  p_batch_size int default 500
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_started_at timestamptz := clock_timestamp();
  v_job_run_id bigint;
  v_window_hours int;
  v_processed int := 0;
  v_transitioned int := 0;
  v_error_count int := 0;
  v_chat record;
  v_active_count int;
  v_duration_ms int;
begin
  if p_batch_size is null or p_batch_size < 1 or p_batch_size > 500 then
    raise exception 'p_batch_size must be between 1 and 500'
      using errcode = '22023';
  end if;

  perform public.cns_set_local_statement_timeout('120s');

  v_job_run_id := public.job_run_begin('chat_evaluate_reciprocity', 'v1');

  v_window_hours := public.platform_constant_int('chats.reciprocity_window_hours', 24);

  for v_chat in
    select c.*
    from public.chats c
    inner join public.service_requests sr on sr.id = c.service_request_id
    where c.status = 'ACTIVE'::public.cns_conversation_status
      and c.last_interaction_at < now() - (v_window_hours || ' hours')::interval
      and sr.status = 'OPEN'::public.service_request_status
    order by c.last_interaction_at
    for update of c skip locked
    limit p_batch_size
  loop
    begin
      v_processed := v_processed + 1;

      if public.cns_has_bilateral_reciprocity(v_chat.id, v_window_hours) then
        continue;
      end if;

      update public.chats
      set
        status = 'INACTIVE'::public.cns_conversation_status,
        inactivated_at = now(),
        inactivation_reason = 'NO_RECIPROCITY'::public.cns_inactivation_reason,
        updated_at = now()
      where id = v_chat.id
        and status = 'ACTIVE'::public.cns_conversation_status;

      if not found then
        continue;
      end if;

      insert into public.service_request_negotiation_stats (service_request_id)
      values (v_chat.service_request_id)
      on conflict (service_request_id) do nothing;

      update public.service_request_negotiation_stats
      set
        active_chat_count = greatest(active_chat_count - 1, 0),
        version = version + 1
      where service_request_id = v_chat.service_request_id
      returning active_chat_count into v_active_count;
      v_transitioned := v_transitioned + 1;

      raise log 'cns_reciprocity_transitions_total chat_id=% service_request_id=%',
        v_chat.id,
        v_chat.service_request_id;
    exception
      when others then
        v_error_count := v_error_count + 1;
        raise log 'cns_evaluate_reciprocity_batch row_error chat_id=% sqlstate=% message=%',
          v_chat.id,
          sqlstate,
          sqlerrm;
    end;
  end loop;

  v_duration_ms := (
    extract(epoch from (clock_timestamp() - v_started_at)) * 1000
  )::int;

  perform public.job_run_finish(
    v_job_run_id,
    v_started_at,
    v_processed,
    v_transitioned,
    v_error_count
  );

  return jsonb_build_object(
    'job_run_id', v_job_run_id,
    'processed_count', v_processed,
    'transitioned_count', v_transitioned,
    'error_count', v_error_count,
    'duration_ms', v_duration_ms
  );
end;
$$;

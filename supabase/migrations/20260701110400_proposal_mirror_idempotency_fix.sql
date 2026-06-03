-- Corrective migration: PROPOSAL timeline mirror requires chat_messages.idempotency_key.

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
  v_active_count int;
  v_max_active int;
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

  v_max_active := public.platform_constant_int('chats.max_active_slots_per_service_request', 4);

  select count(*)::int
  into v_active_count
  from public.provider_proposals pp
  where pp.service_request_id = p_service_request_id
    and pp.status in (
      'PENDING'::public.proposal_status,
      'REVISION_REQUESTED'::public.proposal_status
    );

  if v_active_count >= v_max_active then
    raise exception 'PROPOSAL_LIMIT_REACHED'
      using
        errcode = 'P0001',
        detail = jsonb_build_object(
          'code', 'PROPOSAL_LIMIT_REACHED',
          'limit', v_max_active,
          'active_count', v_active_count
        )::text;
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
      and pp.status <> 'REVISED'::public.proposal_status
    for update;

    if found then
      if v_prev.status = 'ACCEPTED'::public.proposal_status then
        raise exception 'Accepted proposals cannot be replaced'
          using errcode = '22023';
      end if;

      if v_prev.status in (
        'REJECTED'::public.proposal_status,
        'EXPIRED'::public.proposal_status,
        'REJECTED_AUTOMATICALLY'::public.proposal_status
      ) then
        update public.provider_proposals
        set status = 'REVISED'::public.proposal_status
        where id = v_prev.id;

        v_version := v_prev.version + 1;
        v_revision_count := v_prev.revision_count;
      elsif v_prev.status = 'PENDING'::public.proposal_status then
        raise exception 'PROPOSAL_ALREADY_PENDING'
          using
            errcode = 'P0001',
            detail = jsonb_build_object('code', 'PROPOSAL_ALREADY_PENDING')::text;
      elsif v_prev.status = 'REVISION_REQUESTED'::public.proposal_status then
        null;
      end if;
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
  'Canonical proposal creation by service_request_id; optional PROPOSAL timeline mirror when chat exists.';

revoke all on function public.create_provider_proposal(
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
) from public;
revoke all on function public.create_provider_proposal(
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
) from anon;
grant execute on function public.create_provider_proposal(
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
) to authenticated;


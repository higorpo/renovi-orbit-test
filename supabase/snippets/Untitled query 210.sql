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
set search_path = public
as $$
declare
  v_provider_id uuid;
  v_role text;
  v_service_request_status text;
  v_proposal_id uuid;
  v_previous_proposal_id uuid;
  v_previous_proposal_status text;
  v_suggested_slots_count integer;
  v_slot jsonb;
  v_start_date date;
  v_end_date date;
begin
  v_provider_id := auth.uid();
  if v_provider_id is null then
    raise exception 'Unauthorized';
  end if;

  select p.role
  into v_role
  from public.profiles p
  where p.id = v_provider_id;

  if v_role <> 'provider' then
    raise exception 'Only providers can create proposals';
  end if;

  if p_service_request_id is null then
    raise exception 'Service request is required';
  end if;

  select sr.status
  into v_service_request_status
  from public.service_requests sr
  where sr.id = p_service_request_id;

  if v_service_request_status is null then
    raise exception 'Service request not found';
  end if;

  if v_service_request_status <> 'open' then
    raise exception 'This service request is not open for proposals';
  end if;

  if p_proposed_amount is null or p_proposed_amount <= 0 then
    raise exception 'Proposed amount must be greater than zero';
  end if;

  if nullif(trim(p_proposal_description), '') is null then
    raise exception 'Proposal description is required';
  end if;

  if p_proposal_duration_value is null or p_proposal_duration_value <= 0 then
    raise exception 'Proposal duration value must be greater than zero';
  end if;

  if p_proposal_duration_unit not in ('hours', 'days') then
    raise exception 'Proposal duration unit must be hours or days';
  end if;

  if p_proposal_suggested_slots is null or jsonb_typeof(p_proposal_suggested_slots) <> 'array' then
    raise exception 'Suggested slots must be a JSON array';
  end if;

  v_suggested_slots_count := jsonb_array_length(p_proposal_suggested_slots);
  if v_suggested_slots_count < 1 or v_suggested_slots_count > 3 then
    raise exception 'Suggested slots must contain between 1 and 3 options';
  end if;

  for v_slot in
    select value
    from jsonb_array_elements(p_proposal_suggested_slots)
  loop
    if jsonb_typeof(v_slot) <> 'object' then
      raise exception 'Each suggested slot must be an object';
    end if;

    if coalesce(v_slot->>'shift', '') not in ('morning', 'afternoon', 'full_day') then
      raise exception 'Each suggested slot must include a valid shift';
    end if;

    if coalesce(v_slot->>'start_date', '') = '' then
      raise exception 'Each suggested slot must include start_date';
    end if;

    begin
      v_start_date := (v_slot->>'start_date')::date;
    exception when others then
      raise exception 'Invalid start_date in suggested slots';
    end;

    if p_proposal_duration_unit = 'hours' then
      if v_slot ? 'end_date' and coalesce(v_slot->>'end_date', '') <> '' then
        raise exception 'Hourly proposals must not include end_date in suggested slots';
      end if;
    else
      if coalesce(v_slot->>'end_date', '') = '' then
        raise exception 'Day-based proposals must include end_date in suggested slots';
      end if;

      begin
        v_end_date := (v_slot->>'end_date')::date;
      exception when others then
        raise exception 'Invalid end_date in suggested slots';
      end;

      if v_end_date < v_start_date then
        raise exception 'Suggested slot end_date cannot be before start_date';
      end if;

      if (v_end_date - v_start_date + 1) <> p_proposal_duration_value then
        raise exception 'Each day-based slot must match the informed duration value';
      end if;
    end if;
  end loop;

  select pp.id, pp.status
  into v_previous_proposal_id, v_previous_proposal_status
  from public.provider_proposals pp
  where pp.provider_id = v_provider_id
    and pp.service_request_id = p_service_request_id
    and pp.status <> 'withdrawn'
  order by pp.created_at desc
  limit 1;

  if v_previous_proposal_id is not null and v_previous_proposal_status = 'accepted' then
    raise exception 'Accepted proposals cannot be replaced';
  end if;

  if v_previous_proposal_id is not null then
    update public.provider_proposals
    set status = 'withdrawn'
    where id = v_previous_proposal_id;
  end if;

  if exists (
    select 1
    from public.provider_proposals pp
    where pp.provider_id = v_provider_id
      and pp.service_request_id = p_service_request_id
      and pp.status <> 'withdrawn'
  ) then
    raise exception 'Unable to replace previous active proposal';
  end if;

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
    status
  ) values (
    v_provider_id,
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
    'submitted'
  )
  returning id into v_proposal_id;

  return jsonb_build_object('id', v_proposal_id);
end;
$$;
-- Proposal chat decouple (plan: migration 3) — update dependent RPCs/policies to resolve chat by (service_request_id, provider_id).

create or replace function public.cns_chat_free_messaging_allowed(p_chat_id uuid)
returns boolean
language sql
stable
security invoker
set search_path = public
as $$
  select
    (select public.is_chat_participant(p_chat_id))
    and not exists (
      select 1
      from public.chats c
      inner join public.provider_proposals pp
        on pp.service_request_id = c.service_request_id
       and pp.provider_id = c.provider_id
      where c.id = p_chat_id
        and pp.status = 'PENDING'::public.proposal_status
    );
$$;

create or replace function public.get_proposal_for_timeline(
  p_chat_id uuid,
  p_proposal_id uuid
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, auth
as $$
declare
  v_actor uuid := auth.uid();
  v_result jsonb;
begin
  if v_actor is null then
    raise exception 'Authentication required for get_proposal_for_timeline'
      using errcode = '42501';
  end if;

  if p_chat_id is null or p_proposal_id is null then
    raise exception 'p_chat_id and p_proposal_id are required'
      using errcode = '22023';
  end if;

  if not public.is_chat_participant(p_chat_id) then
    raise exception 'PROPOSAL_NOT_FOUND'
      using
        errcode = 'P0001',
        detail = jsonb_build_object('code', 'PROPOSAL_NOT_FOUND')::text;
  end if;

  select jsonb_build_object(
    'proposal', jsonb_build_object(
      'id', pp.id,
      'chat_id', p_chat_id,
      'service_request_id', pp.service_request_id,
      'provider_id', pp.provider_id,
      'status', pp.status,
      'version', pp.version,
      'revision_count', pp.revision_count,
      'revision_reason', pp.revision_reason,
      'revision_notes', pp.revision_notes,
      'submitted_at', pp.submitted_at,
      'expired_at', pp.expired_at,
      'selected_slot', pp.selected_slot,
      'proposed_amount', pp.proposed_amount,
      'tax_rate', pp.tax_rate,
      'tax_amount', pp.tax_amount,
      'final_amount', pp.final_amount,
      'proposal_description', pp.proposal_description,
      'proposal_duration_unit', pp.proposal_duration_unit,
      'proposal_duration_value', pp.proposal_duration_value,
      'proposal_suggested_slots', pp.proposal_suggested_slots,
      'photos', coalesce(to_jsonb(pp.photos), '[]'::jsonb),
      'client_rejection_response', pp.client_rejection_response,
      'client_response_deadline_at', pp.client_response_deadline_at,
      'created_at', pp.created_at,
      'updated_at', pp.updated_at
    )
  )
  into v_result
  from public.provider_proposals pp
  inner join public.chats c
    on c.id = p_chat_id
   and pp.service_request_id = c.service_request_id
   and pp.provider_id = c.provider_id
  where pp.id = p_proposal_id;

  if v_result is null then
    raise exception 'PROPOSAL_NOT_FOUND'
      using
        errcode = 'P0001',
        detail = jsonb_build_object('code', 'PROPOSAL_NOT_FOUND')::text;
  end if;

  return v_result;
end;
$$;

create or replace function public.list_proposal_versions(p_chat_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, auth
as $$
declare
  v_actor uuid := auth.uid();
  v_items jsonb;
begin
  if v_actor is null then
    raise exception 'Authentication required for list_proposal_versions'
      using errcode = '42501';
  end if;

  if p_chat_id is null then
    raise exception 'p_chat_id is required'
      using errcode = '22023';
  end if;

  if not public.is_chat_participant(p_chat_id) then
    raise exception 'CONVERSATION_NOT_FOUND'
      using
        errcode = 'P0001',
        detail = jsonb_build_object('code', 'CONVERSATION_NOT_FOUND')::text;
  end if;

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'id', pp.id,
        'chat_id', p_chat_id,
        'service_request_id', pp.service_request_id,
        'provider_id', pp.provider_id,
        'status', pp.status,
        'version', pp.version,
        'revision_count', pp.revision_count,
        'revision_reason', pp.revision_reason,
        'revision_notes', pp.revision_notes,
        'submitted_at', pp.submitted_at,
        'expired_at', pp.expired_at,
        'selected_slot', pp.selected_slot,
        'proposed_amount', pp.proposed_amount,
        'tax_rate', pp.tax_rate,
        'tax_amount', pp.tax_amount,
        'final_amount', pp.final_amount,
        'proposal_description', pp.proposal_description,
        'proposal_duration_unit', pp.proposal_duration_unit,
        'proposal_duration_value', pp.proposal_duration_value,
        'proposal_suggested_slots', pp.proposal_suggested_slots,
        'photos', coalesce(to_jsonb(pp.photos), '[]'::jsonb),
        'client_rejection_response', pp.client_rejection_response,
        'client_response_deadline_at', pp.client_response_deadline_at,
        'created_at', pp.created_at,
        'updated_at', pp.updated_at
      )
      order by pp.version asc, pp.created_at asc
    ),
    '[]'::jsonb
  )
  into v_items
  from public.provider_proposals pp
  inner join public.chats c
    on c.id = p_chat_id
   and pp.service_request_id = c.service_request_id
   and pp.provider_id = c.provider_id;

  return jsonb_build_object('items', v_items);
end;
$$;

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

  update public.service_requests
  set
    status = 'COMPLETED'::public.service_request_status,
    completed_at = now()
  where id = v_sr.id
  returning * into v_sr;

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
    'SERVICE_REQUEST_COMPLETED',
    'service_request',
    v_sr.id,
    v_sr.id,
    null,
    jsonb_build_object(
      'idempotency_key',
      format('service_request:%s:completed', v_sr.id),
      'service_request_id', v_sr.id,
      'contracted_service_id', v_service.id
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
      'closed_count', jsonb_array_length(v_chat_ids)
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

  perform public.record_domain_event(
    'PROPOSAL_REJECTED',
    'proposal',
    v_proposal.id,
    v_sr.id,
    v_chat_id,
    jsonb_build_object(
      'idempotency_key',
      format('proposal:%s:rejected', v_proposal.id),
      'proposal_id', v_proposal.id,
      'rejection_reason', trim(p_rejection_reason)
    )
  );

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

  perform public.record_domain_event(
    'PROPOSAL_REVISION_REQUESTED',
    'proposal',
    v_proposal.id,
    v_sr.id,
    v_chat_id,
    jsonb_build_object(
      'idempotency_key',
      format('proposal:%s:revision_requested', v_proposal.id),
      'proposal_id', v_proposal.id,
      'revision_reason', p_revision_reason,
      'revision_notes', v_proposal.revision_notes
    )
  );

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

create or replace function public.decline_revision_request(
  p_proposal_id uuid,
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
  v_cached jsonb;
  v_request_hash text;
  v_chat_id uuid;
  v_response jsonb;
begin
  if v_actor is null then
    raise exception 'Authentication required for decline_revision_request'
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

  v_request_hash := md5(p_proposal_id::text);

  v_cached := public.idempotency_begin(
    'chats.decline_revision_request',
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

  if v_actor <> v_proposal.provider_id then
    raise exception 'Only the proposal provider may decline a revision request'
      using errcode = '42501';
  end if;

  select *
  into v_sr
  from public.service_requests sr
  where sr.id = v_proposal.service_request_id
  for update;

  if v_sr.status <> 'OPEN'::public.service_request_status then
    raise exception 'SR_NOT_OPEN'
      using
        errcode = 'P0001',
        detail = jsonb_build_object('code', 'SR_NOT_OPEN')::text;
  end if;

  update public.provider_proposals
  set
    status = 'PENDING'::public.proposal_status,
    updated_at = now()
  where id = p_proposal_id
    and status = 'REVISION_REQUESTED'::public.proposal_status
  returning * into v_proposal;

  if not found then
    raise exception 'PROPOSAL_NOT_ACCEPTABLE'
      using
        errcode = 'P0001',
        detail = jsonb_build_object(
          'code', 'PROPOSAL_NOT_ACCEPTABLE',
          'expected_status', 'REVISION_REQUESTED'
        )::text;
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
    'chats.decline_revision_request',
    p_idempotency_key,
    v_request_hash,
    200,
    v_response
  );

  raise log 'decline_revision_request_total proposal_id=% chat_id=%',
    v_proposal.id,
    v_chat_id;

  return v_response;
end;
$$;

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

      perform public.record_domain_event(
        'PROPOSAL_EXPIRED',
        'proposal',
        v_proposal.id,
        v_proposal.service_request_id,
        v_chat_id,
        jsonb_build_object(
          'idempotency_key',
          format('proposal:%s:expired', v_proposal.id),
          'proposal_id', v_proposal.id,
          'chat_id', v_chat_id,
          'expired_at', v_proposal.expired_at
        )
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

      perform public.record_domain_event(
        'CONVERSATION_INACTIVATED',
        'chat',
        v_chat.id,
        v_chat.service_request_id,
        v_chat.id,
        jsonb_build_object(
          'chat_id', v_chat.id,
          'inactivation_reason', 'NO_RECIPROCITY',
          'service_request_id', v_chat.service_request_id,
          'trigger', 'proposal_expiry'
        )
      );

      perform public.record_domain_event(
        'SLOT_RELEASED',
        'chat',
        v_chat.id,
        v_chat.service_request_id,
        v_chat.id,
        jsonb_build_object(
          'active_chat_count', coalesce(v_active_count, 0),
          'service_request_id', v_chat.service_request_id,
          'trigger', 'proposal_expiry'
        )
      );

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

create or replace function public.enqueue_proposal_expiring_soon_reminders(
  p_batch_size int default 100
)
returns jsonb
language plpgsql
security definer
set search_path = public, message_dispatcher
as $$
declare
  v_sla_hours int;
  v_processed int := 0;
  v_enqueued int := 0;
  v_skipped int := 0;
  v_error_count int := 0;
  v_proposal record;
  v_chat public.chats%rowtype;
  v_chat_id uuid;
  v_sr public.service_requests%rowtype;
  v_idempotency_key text;
  v_template_variables jsonb;
  v_result jsonb;
begin
  if p_batch_size is null or p_batch_size < 1 or p_batch_size > 500 then
    raise exception 'p_batch_size must be between 1 and 500'
      using errcode = '22023';
  end if;

  v_sla_hours := public.platform_constant_int('chats.proposal_response_sla_hours', 24);

  for v_proposal in
    select pp.*
    from public.provider_proposals pp
    inner join public.service_requests sr on sr.id = pp.service_request_id
    where pp.status = 'PENDING'::public.proposal_status
      and sr.status = 'OPEN'::public.service_request_status
      and public.resolve_proposal_chat_id(pp.service_request_id, pp.provider_id) is not null
      and coalesce(pp.submitted_at, pp.created_at)
        + make_interval(hours => v_sla_hours - 4) < now()
      and coalesce(pp.submitted_at, pp.created_at)
        + make_interval(hours => v_sla_hours) > now()
    order by pp.submitted_at
    limit p_batch_size
  loop
    begin
      v_processed := v_processed + 1;
      v_chat_id := public.resolve_proposal_chat_id(
        v_proposal.service_request_id,
        v_proposal.provider_id
      );

      if v_chat_id is null then
        v_skipped := v_skipped + 1;
        continue;
      end if;

      v_idempotency_key := format('proposal:%s:expiring_soon', v_proposal.id);

      if exists (
        select 1
        from message_dispatcher.message_dispatches d
        where d.idempotency_key = public.mmd_idempotency_uuid(v_idempotency_key || ':push')
           or d.idempotency_key = public.mmd_idempotency_uuid(v_idempotency_key || ':email')
      ) then
        v_skipped := v_skipped + 1;
        continue;
      end if;

      select *
      into v_chat
      from public.chats c
      where c.id = v_chat_id;

      select *
      into v_sr
      from public.service_requests sr
      where sr.id = v_proposal.service_request_id;

      v_template_variables := jsonb_build_object(
        'chat_id', v_chat.id,
        'service_request_id', v_sr.id,
        'service_request_title', coalesce(v_sr.title, 'Service request'),
        'sender_display_name', 'Prestway',
        'message_preview', 'Proposal expiring soon',
        'deep_link_path', format('/dashboard/chats/%s', v_chat.id),
        'proposal_id', v_proposal.id
      );

      v_result := public.cns_mmd_ingest(
        'PROPOSAL_EXPIRING_SOON',
        v_chat.client_id,
        v_idempotency_key,
        v_template_variables,
        jsonb_build_object(
          'proposal_id', v_proposal.id,
          'submitted_at', v_proposal.submitted_at
        )
      );

      if coalesce((v_result->>'ingested_count')::int, 0) > 0 then
        v_enqueued := v_enqueued + 1;
        raise log 'proposal_expiring_soon_reminder_total proposal_id=% chat_id=% ingested=%',
          v_proposal.id,
          v_chat.id,
          v_result->>'ingested_count';
      else
        v_skipped := v_skipped + 1;
      end if;
    exception
      when others then
        v_error_count := v_error_count + 1;
        raise log 'enqueue_proposal_expiring_soon_reminders row_error proposal_id=% sqlstate=% message=%',
          v_proposal.id,
          sqlstate,
          sqlerrm;
    end;
  end loop;

  return jsonb_build_object(
    'processed_count', v_processed,
    'enqueued_count', v_enqueued,
    'skipped_count', v_skipped,
    'error_count', v_error_count
  );
end;
$$;

create or replace function public.cns_emit_analytics(p_event_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_started_at timestamptz := clock_timestamp();
  v_event public.domain_events%rowtype;
  v_chat public.chats%rowtype;
  v_proposal public.provider_proposals%rowtype;
  v_analytics_name text;
  v_properties jsonb := '{}'::jsonb;
  v_lag_seconds numeric;
begin
  if p_event_id is null then
    raise exception 'p_event_id is required'
      using errcode = '22023';
  end if;

  begin
    select *
    into v_event
    from public.domain_events de
    where de.id = p_event_id;

    if not found then
      raise exception 'domain event not found: %', p_event_id
        using errcode = '22023';
    end if;

    v_lag_seconds := extract(epoch from (now() - v_event.created_at));

    case v_event.event_type
      when 'CHAT_MESSAGE_SENT' then
        v_analytics_name := 'negotiation_message_sent';
        v_properties := jsonb_build_object(
          'message_id', v_event.aggregate_id,
          'message_type', v_event.payload->>'message_type',
          'sender_user_id', v_event.payload->>'sender_user_id',
          'chat_id', v_event.chat_id,
          'service_request_id', v_event.service_request_id
        );

      when 'PROPOSAL_SUBMITTED' then
        v_analytics_name := 'proposal_submitted';

        select *
        into v_proposal
        from public.provider_proposals pp
        where pp.id = coalesce(
          nullif(v_event.payload->>'proposal_id', '')::uuid,
          v_event.aggregate_id
        );

        if v_event.chat_id is not null then
          select *
          into v_chat
          from public.chats c
          where c.id = v_event.chat_id;
        end if;

        v_properties := jsonb_build_object(
          'proposal_id', coalesce(v_proposal.id, v_event.aggregate_id),
          'chat_id', coalesce(
            public.resolve_proposal_chat_id(v_proposal.service_request_id, v_proposal.provider_id),
            v_event.chat_id
          ),
          'service_request_id', coalesce(v_proposal.service_request_id, v_event.service_request_id),
          'version', v_proposal.version,
          'revision_count', v_proposal.revision_count
        );

        if v_chat.activated_at is not null and v_proposal.submitted_at is not null then
          v_properties := v_properties || jsonb_build_object(
            'time_to_proposal_ms',
            round(
              extract(epoch from (v_proposal.submitted_at - v_chat.activated_at)) * 1000
            )::bigint
          );
        end if;

      when 'PROPOSAL_ACCEPTED' then
        v_analytics_name := 'proposal_accepted';
        v_properties := jsonb_build_object(
          'proposal_id', coalesce(nullif(v_event.payload->>'proposal_id', '')::uuid, v_event.aggregate_id),
          'chat_id', v_event.chat_id,
          'service_request_id', v_event.service_request_id,
          'service_id', v_event.payload->>'service_id'
        );

      when 'PROPOSAL_REJECTED' then
        v_analytics_name := 'proposal_rejected';
        v_properties := jsonb_build_object(
          'proposal_id', coalesce(nullif(v_event.payload->>'proposal_id', '')::uuid, v_event.aggregate_id),
          'chat_id', v_event.chat_id,
          'service_request_id', v_event.service_request_id
        );

      when 'PROPOSAL_EXPIRED' then
        v_analytics_name := 'proposal_expired';
        v_properties := jsonb_build_object(
          'proposal_id', coalesce(nullif(v_event.payload->>'proposal_id', '')::uuid, v_event.aggregate_id),
          'chat_id', v_event.chat_id,
          'service_request_id', v_event.service_request_id
        );

      when 'PROPOSAL_REVISION_REQUESTED' then
        v_analytics_name := 'revision_requested';
        v_properties := jsonb_build_object(
          'proposal_id', coalesce(nullif(v_event.payload->>'proposal_id', '')::uuid, v_event.aggregate_id),
          'chat_id', v_event.chat_id,
          'service_request_id', v_event.service_request_id,
          'revision_reason', v_event.payload->>'revision_reason'
        );

      when 'CONVERSATION_CLOSED' then
        v_analytics_name := 'conversation_closed';
        v_properties := jsonb_build_object(
          'chat_id', v_event.chat_id,
          'service_request_id', v_event.service_request_id,
          'closure_type', v_event.payload->>'closure_type',
          'closed_by_user_id', v_event.payload->>'closed_by_user_id'
        );

      when 'CONVERSATION_INACTIVATED' then
        v_analytics_name := 'conversation_inactivated';
        v_properties := jsonb_build_object(
          'chat_id', v_event.chat_id,
          'service_request_id', v_event.service_request_id,
          'inactivation_reason', v_event.payload->>'inactivation_reason'
        );

      when 'SERVICE_REQUEST_COMPLETED' then
        v_analytics_name := 'service_request_completed';
        v_properties := jsonb_build_object(
          'service_request_id', coalesce(v_event.service_request_id, v_event.aggregate_id),
          'contracted_service_id', v_event.payload->>'contracted_service_id'
        );

      when 'SERVICE_REQUEST_CANCELLED' then
        v_analytics_name := 'service_request_cancelled';
        v_properties := jsonb_build_object(
          'service_request_id', coalesce(v_event.service_request_id, v_event.aggregate_id)
        );

      else
        return jsonb_build_object(
          'event_id', v_event.id,
          'event_type', v_event.event_type,
          'skipped', true,
          'reason', 'not_analytics_event'
        );
    end case;

    raise log 'cns_analytics_event event_name=% schema_version=v1 domain_event_id=% lag_seconds=% properties=%',
      v_analytics_name,
      v_event.id,
      v_lag_seconds,
      v_properties;

    raise log 'cns_analytics_emit_duration_ms=% domain_event_id=% event_name=%',
      round(extract(epoch from (clock_timestamp() - v_started_at)) * 1000)::bigint,
      v_event.id,
      v_analytics_name;

    return jsonb_build_object(
      'event_id', v_event.id,
      'event_type', v_event.event_type,
      'analytics_event', v_analytics_name,
      'schema_version', 'v1',
      'lag_seconds', v_lag_seconds,
      'properties', v_properties,
      'skipped', false
    );
  exception
    when others then
      raise log 'cns_analytics_emit_failed domain_event_id=% sqlstate=% message=%',
        p_event_id,
        sqlstate,
        sqlerrm;

      return jsonb_build_object(
        'event_id', p_event_id,
        'skipped', true,
        'reason', sqlerrm
      );
  end;
end;
$$;

create or replace function public.get_negotiation_audit_timeline(p_service_request_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, auth
as $$
declare
  v_items jsonb;
begin
  if (select auth.uid()) is null then
    raise exception 'Authentication required for get_negotiation_audit_timeline'
      using errcode = '42501';
  end if;

  if not public.is_platform_admin() then
    raise exception 'ADMIN_REQUIRED'
      using
        errcode = '42501',
        detail = jsonb_build_object('code', 'ADMIN_REQUIRED')::text;
  end if;

  if p_service_request_id is null then
    raise exception 'p_service_request_id is required'
      using errcode = '22023';
  end if;

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'source', e.source,
        'entity_id', e.entity_id,
        'chat_id', e.chat_id,
        'proposal_id', e.proposal_id,
        'from_status', e.from_status,
        'to_status', e.to_status,
        'actor_id', e.actor_id,
        'metadata', e.metadata,
        'created_at', e.created_at,
        'audit_id', e.audit_id
      )
      order by e.created_at asc, e.audit_id asc
    ),
    '[]'::jsonb
  )
  into v_items
  from (
    select
      'chat'::text as source,
      ca.chat_id as entity_id,
      ca.chat_id,
      null::uuid as proposal_id,
      ca.from_status::text as from_status,
      ca.to_status::text as to_status,
      ca.actor_id,
      ca.metadata,
      ca.created_at,
      ca.id as audit_id
    from public.chat_audit ca
    inner join public.chats c on c.id = ca.chat_id
    where c.service_request_id = p_service_request_id

    union all

    select
      'proposal'::text as source,
      pa.proposal_id as entity_id,
      public.resolve_proposal_chat_id(pp.service_request_id, pp.provider_id) as chat_id,
      pa.proposal_id,
      pa.from_status::text as from_status,
      pa.to_status::text as to_status,
      pa.actor_id,
      pa.metadata,
      pa.created_at,
      pa.id as audit_id
    from public.proposal_audit pa
    inner join public.provider_proposals pp on pp.id = pa.proposal_id
    where pp.service_request_id = p_service_request_id
  ) e;

  return jsonb_build_object(
    'service_request_id', p_service_request_id,
    'items', v_items
  );
end;
$$;

create or replace function public.match_provider_jobs(
  p_provider_id uuid,
  p_lat double precision,
  p_lng double precision,
  p_radius_km integer default 10,
  p_service_id uuid default null,
  p_sort_mode text default 'nearest',
  p_page_size integer default 20,
  p_page integer default 1
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, extensions
as $$
declare
  v_result jsonb;
  v_provider_point geography;
  v_offset integer;
  v_sort text;
begin
  v_sort := case
    when p_sort_mode in ('nearest', 'newest', 'least_competitive') then p_sort_mode
    else 'nearest'
  end;
  p_page := greatest(p_page, 1);
  p_page_size := least(greatest(p_page_size, 1), 50);
  p_radius_km := least(greatest(p_radius_km, 1), 100);

  v_provider_point := st_setsrid(st_makepoint(p_lng, p_lat), 4326)::geography;
  v_offset := (p_page - 1) * p_page_size;

  with offered_services as (
    select pos.service_id
    from provider_offered_services pos
    where pos.provider_id = p_provider_id
  ),
  provider_city_ids as (
    select distinct pn.city_id
    from provider_service_area_neighborhoods psan
    join platform_neighborhoods pn on pn.id = psan.neighborhood_id
    where psan.provider_id = p_provider_id
  ),
  provider_area_names as (
    select
      pn.city_id,
      lower(trim(pn.name)) as normalized_name
    from provider_service_area_neighborhoods psan
    join platform_neighborhoods pn on pn.id = psan.neighborhood_id
    where psan.provider_id = p_provider_id
  ),
  provider_proposed_ids as (
    select pp.service_request_id
    from provider_proposals pp
    where pp.provider_id = p_provider_id
      and pp.status <> 'REVISED'::public.proposal_status
  ),
  eligible_base as (
    select
      sr.id,
      sr.title,
      sr.description,
      sr.service_id,
      sr.photos,
      sr.form_data,
      sr.form_schema,
      sr.urgency,
      sr.scope_complexity,
      sr.estimated_duration_hint,
      sr.tags,
      sr.suggested_questions,
      sr.suggested_equipment,
      sr.suggested_materials,
      sr.created_at,
      ca.neighborhood as address_neighborhood,
      pc.name as city_name,
      pst.abbreviation as state_abbreviation,
      s.title as service_title,
      s.slug as service_slug,
      s.icon_key as service_icon_key,
      s.color_key as service_color_key,
      s.parent_id as service_parent_id,
      (
        split_part(p.full_name, ' ', 1) ||
        case
          when array_length(string_to_array(p.full_name, ' '), 1) > 1
          then ' ' || left(
            split_part(
              p.full_name, ' ',
              array_length(string_to_array(p.full_name, ' '), 1)
            ), 1
          ) || '.'
          else ''
        end
      ) as masked_client_name,
      round(
        (st_distance(sr.location, v_provider_point) / 1000.0)::numeric, 1
      ) as distance_km,
      exists (
        select 1
        from provider_area_names pan
        where pan.city_id = ca.city_id
          and pan.normalized_name = lower(trim(ca.neighborhood))
      ) as exact_area_match
    from service_requests sr
    join client_addresses ca on ca.id = sr.address_id
    join platform_cities pc on pc.id = ca.city_id
    join platform_states pst on pst.id = ca.state_id
    join platform_services s on s.id = sr.service_id
    join profiles p on p.id = sr.client_id
    where
      sr.status = 'OPEN'::public.service_request_status
      and sr.location is not null
      and st_dwithin(sr.location, v_provider_point, p_radius_km * 1000)
      and (p_service_id is null or sr.service_id = p_service_id)
      and (
        sr.service_id in (select os.service_id from offered_services os)
        or s.parent_id in (select os.service_id from offered_services os)
      )
      and ca.city_id in (select pci.city_id from provider_city_ids pci)
      and not exists (
        select 1
        from provider_proposed_ids ppi
        where ppi.service_request_id = sr.id
      )
  ),
  proposal_counts as (
    select
      pp.service_request_id,
      count(*)::integer as active_count
    from provider_proposals pp
    join eligible_base eb on eb.id = pp.service_request_id
    where pp.status in (
      'PENDING'::public.proposal_status,
      'REVISION_REQUESTED'::public.proposal_status
    )
    group by pp.service_request_id
  ),
  eligible as (
    select
      eb.*,
      coalesce(pc_agg.active_count, 0)::integer as proposal_count,
      pp_latest.id as provider_proposal_id,
      pp_latest.proposed_amount as provider_proposed_amount,
      pp_latest.tax_rate as provider_tax_rate,
      pp_latest.tax_amount as provider_tax_amount,
      pp_latest.final_amount as provider_final_amount,
      pp_latest.proposal_description as provider_proposal_description,
      pp_latest.proposal_duration_value as provider_proposal_duration_value,
      pp_latest.proposal_duration_unit as provider_proposal_duration_unit,
      pp_latest.proposal_suggested_slots as provider_proposal_suggested_slots,
      pp_latest.photos as provider_proposal_photos,
      pp_latest.status as provider_proposal_status,
      pp_latest.client_rejection_response as provider_proposal_client_rejection_response
    from eligible_base eb
    left join proposal_counts pc_agg on pc_agg.service_request_id = eb.id
    left join lateral (
      select
        pp.id,
        pp.proposed_amount,
        pp.tax_rate,
        pp.tax_amount,
        pp.final_amount,
        pp.proposal_description,
        pp.proposal_duration_value,
        pp.proposal_duration_unit,
        pp.proposal_suggested_slots,
        pp.photos,
        pp.status,
        pp.client_rejection_response
      from provider_proposals pp
      where pp.service_request_id = eb.id
        and pp.provider_id = p_provider_id
      order by pp.updated_at desc, pp.created_at desc
      limit 1
    ) pp_latest on true
    where coalesce(pc_agg.active_count, 0) < public.platform_constant_int(
      'chats.max_active_slots_per_service_request',
      4
    )
  ),
  total as (
    select count(*)::integer as cnt from eligible
  ),
  sorted as (
    select *
    from eligible
    order by
      case when v_sort = 'nearest' then distance_km end asc nulls last,
      case when v_sort = 'least_competitive' then proposal_count end asc nulls last,
      case when v_sort = 'newest' then extract(epoch from created_at) end desc nulls last,
      created_at desc,
      distance_km asc nulls last
    limit p_page_size
    offset v_offset
  )
  select jsonb_build_object(
    'items', coalesce(
      (select jsonb_agg(
        jsonb_build_object(
          'id', s.id,
          'title', s.title,
          'description', s.description,
          'service_id', s.service_id,
          'service_title', s.service_title,
          'service_slug', s.service_slug,
          'service_icon_key', s.service_icon_key,
          'service_color_key', s.service_color_key,
          'service_parent_id', s.service_parent_id,
          'photos', s.photos,
          'form_data', s.form_data,
          'form_schema', s.form_schema,
          'urgency', s.urgency,
          'scope_complexity', s.scope_complexity,
          'estimated_duration_hint', s.estimated_duration_hint,
          'tags', s.tags,
          'suggested_questions', s.suggested_questions,
          'suggested_equipment', s.suggested_equipment,
          'suggested_materials', s.suggested_materials,
          'masked_client_name', s.masked_client_name,
          'neighborhood', s.address_neighborhood,
          'city', s.city_name,
          'state', s.state_abbreviation,
          'distance_km', s.distance_km,
          'proposal_count', s.proposal_count,
          'provider_proposal_id', s.provider_proposal_id,
          'provider_proposed_amount', s.provider_proposed_amount,
          'provider_tax_rate', s.provider_tax_rate,
          'provider_tax_amount', s.provider_tax_amount,
          'provider_final_amount', s.provider_final_amount,
          'provider_proposal_description', s.provider_proposal_description,
          'provider_proposal_duration_value', s.provider_proposal_duration_value,
          'provider_proposal_duration_unit', s.provider_proposal_duration_unit,
          'provider_proposal_suggested_slots', s.provider_proposal_suggested_slots,
          'provider_proposal_photos', s.provider_proposal_photos,
          'provider_proposal_status', s.provider_proposal_status,
          'provider_proposal_client_rejection_response', s.provider_proposal_client_rejection_response,
          'is_latest_provider_proposal', case when s.provider_proposal_id is not null then true else null end,
          'exact_area_match', s.exact_area_match,
          'created_at', s.created_at
        )
      ) from sorted s),
      '[]'::jsonb
    ),
    'total_count', (select cnt from total),
    'page', p_page,
    'page_size', p_page_size
  ) into v_result;

  return v_result;
end;
$$;

drop policy if exists provider_proposals_select on public.provider_proposals;
create policy provider_proposals_select on public.provider_proposals for select to authenticated using (
  (select public.is_platform_admin())
  or exists (
    select 1 from public.chats c
    where c.service_request_id = provider_proposals.service_request_id
      and c.provider_id = provider_proposals.provider_id
      and (c.client_id = auth.uid() or c.provider_id = auth.uid())
  )
  or (
    provider_proposals.provider_id = auth.uid() and (select public.is_provider())
  )
  or exists (
    select 1 from public.service_requests sr
    where sr.id = provider_proposals.service_request_id and sr.client_id = auth.uid()
  )
);

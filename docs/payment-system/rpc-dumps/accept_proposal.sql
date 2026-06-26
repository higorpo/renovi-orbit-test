-- Baseline dump captured at migration 20260723120000
CREATE OR REPLACE FUNCTION public.accept_proposal(p_proposal_id uuid, p_selected_slot jsonb, p_idempotency_key uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'auth'
AS $function$
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
$function$

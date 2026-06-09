-- Close provider-client chat when the client rejects a pending proposal.

alter type public.cns_closure_type add value if not exists 'PROPOSAL_REJECTED';

comment on type public.cns_closure_type is
  'Why a conversation reached CLOSED. PROPOSAL_ACCEPTED_ELSEWHERE: accept cascade on another chat. PROPOSAL_REJECTED: client rejected the provider proposal.';

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
  v_chat public.chats%rowtype;
  v_cached jsonb;
  v_request_hash text;
  v_chat_id uuid;
  v_was_active boolean;
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

  if v_chat_id is not null then
    select *
    into v_chat
    from public.chats c
    where c.id = v_chat_id
    for update;

    if found
      and v_chat.status <> 'CLOSED'::public.cns_conversation_status then
      v_was_active := v_chat.status = 'ACTIVE'::public.cns_conversation_status;

      update public.chats
      set
        status = 'CLOSED'::public.cns_conversation_status,
        closure_type = 'PROPOSAL_REJECTED'::public.cns_closure_type,
        closed_at = now(),
        closed_by_user_id = v_actor,
        closure_reason = trim(p_rejection_reason),
        updated_at = now()
      where id = v_chat_id
      returning * into v_chat;

      if v_was_active then
        update public.service_request_negotiation_stats
        set
          active_chat_count = greatest(active_chat_count - 1, 0),
          version = version + 1
        where service_request_id = v_proposal.service_request_id;
      end if;
    end if;
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

comment on function public.reject_proposal(uuid, uuid, text) is
  'Client rejects PENDING proposal and closes the provider conversation when one exists.';

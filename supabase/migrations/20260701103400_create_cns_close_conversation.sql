-- CNS Wave B — task 35: manual conversation close RPC (design §4.8, Req. 11).
-- Migration order: runs AFTER tasks 2, 3, 23, 24.

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

  perform public.record_domain_event(
    'CONVERSATION_CLOSED',
    'chat',
    v_chat.id,
    v_chat.service_request_id,
    v_chat.id,
    jsonb_build_object(
      'idempotency_key',
      format('chat:%s:closed', v_chat.id),
      'chat_id', v_chat.id,
      'closure_type', v_chat.closure_type,
      'closure_reason', v_chat.closure_reason,
      'closed_by_user_id', v_actor
    )
  );

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

comment on function public.cns_close_conversation(uuid, uuid, boolean, text) is
  'Participant manual close: CLOSED/MANUAL irreversible; decrements slot when prior status was ACTIVE (R11-AC02, R11-AC03).';

grant execute on function public.cns_close_conversation(uuid, uuid, boolean, text) to authenticated;

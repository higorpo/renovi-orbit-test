-- CNS Wave B — task 29: optional standalone conversation initiation (design §5.1, §3.3.1).
-- Folded into cns_send_message for first-message path; this RPC exposes explicit create/get without a message.

create or replace function public.cns_initiate_conversation(
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
  v_chat public.chats%rowtype;
  v_sr public.service_requests%rowtype;
  v_stats public.service_request_negotiation_stats%rowtype;
  v_slot_limit int;
  v_is_new_chat boolean := false;
begin
  if v_actor is null then
    raise exception 'Authentication required for cns_initiate_conversation'
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

  select *
  into v_sr
  from public.service_requests sr
  where sr.id = p_service_request_id
  for update;

  if not found then
    raise exception 'Service request not found: %', p_service_request_id
      using errcode = '22023';
  end if;

  if v_sr.status <> 'OPEN'::public.service_request_status then
    raise exception 'SR_NOT_OPEN'
      using
        errcode = 'P0001',
        detail = jsonb_build_object('code', 'SR_NOT_OPEN')::text;
  end if;

  if v_actor = v_sr.client_id then
    raise exception 'Only the provider may initiate a new conversation'
      using errcode = '42501';
  end if;

  select *
  into v_chat
  from public.chats c
  where c.service_request_id = p_service_request_id
    and c.provider_id = v_actor
  for update;

  if not found then
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
  elsif v_actor <> v_chat.provider_id then
    raise exception 'NOT_A_PARTICIPANT'
      using errcode = '42501';
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

  raise log 'cns_initiate_conversation chat_id=% service_request_id=% idempotency_key=% new_chat=%',
    v_chat.id,
    p_service_request_id,
    p_idempotency_key,
    v_is_new_chat;

  return jsonb_build_object(
    'conversation', jsonb_build_object(
      'id', v_chat.id,
      'service_request_id', v_chat.service_request_id,
      'client_id', v_chat.client_id,
      'provider_id', v_chat.provider_id,
      'status', v_chat.status,
      'activated_at', v_chat.activated_at,
      'last_interaction_at', v_chat.last_interaction_at
    )
  );
end;
$$;

comment on function public.cns_initiate_conversation(uuid, uuid) is
  'Provider-only explicit chat create/get without message; same slot semantics as cns_send_message first path (R29-AC03).';

grant execute on function public.cns_initiate_conversation(uuid, uuid) to authenticated;

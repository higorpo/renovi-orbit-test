-- Support AUDIO chat messages: validation, media attach, inbox preview (voice in chat-media bucket).

create or replace function public.cns_message_preview_text(
  p_message_type public.cns_message_type,
  p_payload jsonb
)
returns text
language sql
immutable
set search_path = public
as $$
  select case p_message_type
    when 'IMAGE'::public.cns_message_type then '📷 Foto'
    when 'AUDIO'::public.cns_message_type then '🎤 Áudio'
    when 'PROPOSAL'::public.cns_message_type then '📋 Proposta'
    when 'SYSTEM'::public.cns_message_type then coalesce(
      nullif(trim(p_payload->>'text'), ''),
      'Mensagem do sistema'
    )
    when 'WORKFLOW_ACTION'::public.cns_message_type then coalesce(
      nullif(trim(p_payload->>'text'), ''),
      'Atualização'
    )
    else left(
      coalesce(nullif(trim(p_payload->>'text'), ''), 'Nova mensagem'),
      120
    )
  end;
$$;

comment on function public.cns_message_preview_text(public.cns_message_type, jsonb) is
  'Inbox and push preview label for chat messages (R17-AC03).';

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

  perform public.record_domain_event(
    'CHAT_MESSAGE_SENT',
    'chat_message',
    v_message.id,
    v_chat.service_request_id,
    v_chat.id,
    jsonb_build_object(
      'idempotency_key', p_idempotency_key::text,
      'message_id', v_message.id,
      'sender_user_id', v_actor,
      'message_type', p_message_type
    )
  );

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

comment on function public.cns_send_message(
  public.cns_message_type,
  uuid,
  jsonb,
  uuid,
  uuid
) is
  'Primary CNS message ingress: TEXT/IMAGE/AUDIO, media attach, outbox CHAT_MESSAGE_SENT.';

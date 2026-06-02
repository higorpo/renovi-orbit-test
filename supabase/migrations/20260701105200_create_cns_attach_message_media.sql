-- CNS Phase 7 — task 55: complete upload session after message insert (design §5.2, R3-AC06, R26-AC02).
-- Internal to cns_send_message; not exposed to authenticated clients.
-- Migration order: runs AFTER tasks 15, 53; updates cns_send_message from task 28.

create or replace function public.cns_assert_chat_media_path_shape(p_path text)
returns void
language plpgsql
immutable
set search_path = public, storage
as $$
declare
  v_parts text[];
  v_filename text;
begin
  if p_path is null or btrim(p_path) = '' then
    raise exception 'Invalid empty path in p_paths'
      using errcode = '22023';
  end if;

  if position('..' in p_path) > 0 then
    raise exception 'UPLOAD_PATH_INVALID'
      using errcode = '42501';
  end if;

  v_parts := storage.foldername(p_path);

  -- storage.foldername returns directory segments only ({chat_id}/{session_id}), not the filename.
  if coalesce(array_length(v_parts, 1), 0) <> 2 then
    raise exception 'UPLOAD_PATH_INVALID_DEPTH'
      using errcode = '42501';
  end if;

  -- LIKE wildcards only forbidden in UUID directory segments, not in filenames (Edge uses {ts}_{i}.ext).
  if v_parts[1] ~ '[%_]' or v_parts[2] ~ '[%_]' then
    raise exception 'UPLOAD_PATH_INVALID'
      using errcode = '42501';
  end if;

  v_filename := storage.filename(p_path);

  if v_filename is null or btrim(v_filename) = '' then
    raise exception 'UPLOAD_PATH_INVALID'
      using errcode = '42501';
  end if;

  if v_filename ~ '[%/\\]' or position('..' in v_filename) > 0 then
    raise exception 'UPLOAD_PATH_INVALID'
      using errcode = '42501';
  end if;

  begin
    perform v_parts[1]::uuid;
    perform v_parts[2]::uuid;
  exception
    when invalid_text_representation then
      raise exception 'UPLOAD_PATH_INVALID'
        using errcode = '42501';
  end;
end;
$$;

comment on function public.cns_assert_chat_media_path_shape(text) is
  'Validates chat-media path shape {chat_id}/{session_id}/{filename}; wildcards banned in folder segments only.';

create or replace function public.cns_assert_chat_media_storage_path(
  p_path text,
  p_chat_id uuid,
  p_upload_session_id uuid
)
returns void
language plpgsql
immutable
set search_path = public
as $$
declare
  v_prefix text := p_chat_id::text || '/' || p_upload_session_id::text || '/';
begin
  perform public.cns_assert_chat_media_path_shape(p_path);

  if not starts_with(p_path, v_prefix) then
    raise exception 'UPLOAD_PATH_SESSION_MISMATCH'
      using errcode = '42501';
  end if;
end;
$$;

comment on function public.cns_assert_chat_media_storage_path(text, uuid, uuid) is
  'Validates a storage path belongs to the upload session prefix (used by cns_attach_message_media).';

revoke all on function public.cns_assert_chat_media_path_shape(text) from public;
revoke all on function public.cns_assert_chat_media_path_shape(text) from authenticated;
revoke all on function public.cns_assert_chat_media_path_shape(text) from anon;

revoke all on function public.cns_assert_chat_media_storage_path(text, uuid, uuid) from public;
revoke all on function public.cns_assert_chat_media_storage_path(text, uuid, uuid) from authenticated;
revoke all on function public.cns_assert_chat_media_storage_path(text, uuid, uuid) from anon;

create or replace function public.cns_attach_message_media(
  p_chat_id uuid,
  p_upload_session_id uuid,
  p_paths text[]
)
returns void
language plpgsql
security definer
set search_path = public, storage, auth
as $$
declare
  v_actor uuid := auth.uid();
  v_session public.chat_media_upload_sessions%rowtype;
  v_path text;
begin
  if v_actor is null then
    raise exception 'Authentication required for cns_attach_message_media'
      using errcode = '42501';
  end if;

  if p_chat_id is null or p_upload_session_id is null then
    raise exception 'p_chat_id and p_upload_session_id are required'
      using errcode = '22023';
  end if;

  if p_paths is null or array_length(p_paths, 1) is null then
    raise exception 'p_paths must contain at least one storage path'
      using errcode = '22023';
  end if;

  if array_length(p_paths, 1) > 5 then
    raise exception 'Maximum of 5 image paths allowed'
      using errcode = '22023';
  end if;

  select *
  into v_session
  from public.chat_media_upload_sessions s
  where s.id = p_upload_session_id
  for update;

  if not found then
    raise exception 'UPLOAD_SESSION_NOT_FOUND'
      using errcode = '42501';
  end if;

  if v_session.chat_id <> p_chat_id then
    raise exception 'UPLOAD_SESSION_CHAT_MISMATCH'
      using errcode = '42501';
  end if;

  if v_session.uploader_id <> v_actor then
    raise exception 'UPLOAD_SESSION_UPLOADER_MISMATCH'
      using errcode = '42501';
  end if;

  if not public.is_chat_participant(p_chat_id) then
    raise exception 'NOT_A_PARTICIPANT'
      using errcode = '42501';
  end if;

  if v_session.status <> 'pending' then
    raise exception 'UPLOAD_SESSION_NOT_PENDING'
      using errcode = '42501';
  end if;

  if v_session.expires_at <= now() then
    raise exception 'UPLOAD_SESSION_EXPIRED'
      using errcode = '42501';
  end if;

  foreach v_path in array p_paths loop
    perform public.cns_assert_chat_media_storage_path(
      v_path,
      p_chat_id,
      p_upload_session_id
    );

    if not exists (
      select 1
      from storage.objects o
      where o.bucket_id = 'chat-media'
        and o.name = v_path
    ) then
      raise exception 'MEDIA_OBJECT_NOT_FOUND'
        using errcode = '42501';
    end if;
  end loop;

  update public.chat_media_upload_sessions
  set status = 'completed'
  where id = p_upload_session_id
    and status = 'pending';

  raise log 'cns_media_attach_total session_id=% chat_id=% path_count=%',
    p_upload_session_id,
    p_chat_id,
    array_length(p_paths, 1);
end;
$$;

comment on function public.cns_attach_message_media(uuid, uuid, text[]) is
  'Internal: completes upload session after cns_send_message insert; validates paths and storage objects (task 55).';

revoke all on function public.cns_attach_message_media(uuid, uuid, text[]) from public;
revoke all on function public.cns_attach_message_media(uuid, uuid, text[]) from authenticated;
revoke all on function public.cns_attach_message_media(uuid, uuid, text[]) from anon;

grant execute on function public.cns_attach_message_media(uuid, uuid, text[]) to service_role;

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
    'IMAGE'::public.cns_message_type
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

  if v_sr.status <> 'OPEN'::public.service_request_status then
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
  'Primary CNS message ingress: chat create/reactivate, slot gate, free-messaging gate, rate limit, IMAGE attach, outbox CHAT_MESSAGE_SENT (R1-AC01, R3-AC01, OAC-02).';

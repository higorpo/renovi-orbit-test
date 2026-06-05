-- Authorize AUDIO message paths when refreshing signed URLs by message id.

create or replace function public.cns_refresh_media_signed_urls(
  p_message_ids uuid[] default null,
  p_paths text[] default null,
  p_expires_in int default 3600
)
returns jsonb
language plpgsql
security definer
set search_path = public, storage, auth
as $$
declare
  v_actor uuid := auth.uid();
  v_expires_in int;
  v_authorized_paths text[] := array[]::text[];
  v_path text;
  v_seen text[] := array[]::text[];
begin
  if v_actor is null then
    raise exception 'Authentication required for cns_refresh_media_signed_urls'
      using errcode = '42501';
  end if;

  if (p_message_ids is null or cardinality(p_message_ids) = 0)
    and (p_paths is null or cardinality(p_paths) = 0) then
    raise exception 'p_message_ids or p_paths is required'
      using errcode = '22023';
  end if;

  v_expires_in := greatest(60, least(coalesce(p_expires_in, 3600), 86400));

  if p_message_ids is not null and cardinality(p_message_ids) > 0 then
    for v_path in
      select distinct path_value
      from public.chat_messages m
      inner join public.chats c on c.id = m.chat_id
      cross join lateral jsonb_array_elements_text(m.payload->'paths') as path_value
      where m.id = any (p_message_ids)
        and m.message_type = 'IMAGE'::public.cns_message_type
        and jsonb_typeof(m.payload->'paths') = 'array'
        and v_actor in (c.client_id, c.provider_id)
    loop
      if not (v_path = any (v_seen)) then
        v_seen := array_append(v_seen, v_path);
        v_authorized_paths := array_append(v_authorized_paths, v_path);
      end if;
    end loop;

    for v_path in
      select distinct nullif(trim(m.payload->>'path'), '')
      from public.chat_messages m
      inner join public.chats c on c.id = m.chat_id
      where m.id = any (p_message_ids)
        and m.message_type = 'AUDIO'::public.cns_message_type
        and nullif(trim(m.payload->>'path'), '') is not null
        and v_actor in (c.client_id, c.provider_id)
    loop
      if not (v_path = any (v_seen)) then
        v_seen := array_append(v_seen, v_path);
        v_authorized_paths := array_append(v_authorized_paths, v_path);
      end if;
    end loop;
  end if;

  if p_paths is not null and cardinality(p_paths) > 0 then
    foreach v_path in array p_paths loop
      perform public.cns_assert_chat_media_path_shape(v_path);

      if not exists (
        select 1
        from public.chats c
        where c.id = ((storage.foldername(v_path))[1])::uuid
          and v_actor in (c.client_id, c.provider_id)
      ) then
        raise exception 'NOT_A_PARTICIPANT'
          using errcode = '42501';
      end if;

      if not (v_path = any (v_seen)) then
        v_seen := array_append(v_seen, v_path);
        v_authorized_paths := array_append(v_authorized_paths, v_path);
      end if;
    end loop;
  end if;

  if cardinality(v_authorized_paths) = 0 then
    raise exception 'No authorized media paths found'
      using errcode = '42501';
  end if;

  if cardinality(v_authorized_paths) > 20 then
    raise exception 'Maximum of 20 media paths per refresh request'
      using errcode = '22023';
  end if;

  foreach v_path in array v_authorized_paths loop
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

  raise log 'cns_media_url_refresh_total actor_id=% path_count=% expires_in=%',
    v_actor,
    cardinality(v_authorized_paths),
    v_expires_in;

  return jsonb_build_object(
    'bucket', 'chat-media',
    'expires_in', v_expires_in,
    'paths', to_jsonb(v_authorized_paths)
  );
end;
$$;

comment on function public.cns_refresh_media_signed_urls(uuid[], text[], int) is
  'Participant-only refresh gate for chat-media IMAGE and AUDIO paths (max 20). Returns bucket, expires_in, and authorized paths for client createSignedUrl (R31-AC06).';

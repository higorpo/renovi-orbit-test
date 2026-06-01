-- Fix 42P01 "relation page_rows does not exist": CTEs from WITH are not visible
-- in separate PL/pgSQL statements after SELECT ... INTO (next_cursor block).

create or replace function public.list_chat_messages(
  p_chat_id uuid,
  p_limit integer default 20,
  p_cursor_created_at timestamptz default null,
  p_cursor_id uuid default null,
  p_after boolean default false
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, auth
as $$
declare
  v_actor uuid := auth.uid();
  v_limit integer;
  v_items jsonb;
  v_has_more boolean := false;
  v_next_cursor jsonb;
  v_result jsonb;
begin
  if v_actor is null then
    raise exception 'Authentication required for list_chat_messages'
      using errcode = '42501';
  end if;

  if p_chat_id is null then
    raise exception 'p_chat_id is required'
      using errcode = '22023';
  end if;

  if not public.is_chat_participant(p_chat_id) then
    return jsonb_build_object(
      'items', '[]'::jsonb,
      'has_more', false,
      'next_cursor', null
    );
  end if;

  v_limit := least(greatest(coalesce(p_limit, 20), 1), 100);

  if p_cursor_created_at is not null and p_cursor_id is null then
    raise exception 'p_cursor_id is required when p_cursor_created_at is set'
      using errcode = '22023';
  end if;

  if p_after and p_cursor_created_at is null then
    raise exception 'p_cursor_created_at is required when p_after is true'
      using errcode = '22023';
  end if;

  if p_after then
    with filtered as (
      select
        m.id,
        m.chat_id,
        m.sender_user_id,
        m.message_type,
        m.payload,
        m.linked_entity_type,
        m.linked_entity_id,
        m.idempotency_key,
        m.delivery_status,
        m.created_at,
        m.updated_at
      from public.chat_messages m
      where m.chat_id = p_chat_id
        and (m.created_at, m.id) > (p_cursor_created_at, p_cursor_id)
      order by m.created_at asc, m.id asc
      limit v_limit + 1
    ),
    page_rows as (
      select *
      from filtered
      limit v_limit
    ),
    page_count as (
      select count(*)::integer as cnt from filtered
    )
    select
      coalesce(
        (
          select jsonb_agg(
            jsonb_build_object(
              'id', r.id,
              'chat_id', r.chat_id,
              'sender_user_id', r.sender_user_id,
              'message_type', r.message_type,
              'payload', public.cns_project_message_payload_for_list(r.message_type, r.payload),
              'linked_entity_type', r.linked_entity_type,
              'linked_entity_id', r.linked_entity_id,
              'idempotency_key', r.idempotency_key,
              'delivery_status', r.delivery_status,
              'created_at', r.created_at,
              'updated_at', r.updated_at
            )
            order by r.created_at desc, r.id desc
          )
          from page_rows r
        ),
        '[]'::jsonb
      ),
      (select cnt > v_limit from page_count),
      case
        when (select cnt > v_limit from page_count) then (
          select jsonb_build_object(
            'created_at', pr.created_at,
            'id', pr.id
          )
          from page_rows pr
          order by pr.created_at desc, pr.id desc
          limit 1
        )
        else null
      end
    into v_items, v_has_more, v_next_cursor;
  else
    with filtered as (
      select
        m.id,
        m.chat_id,
        m.sender_user_id,
        m.message_type,
        m.payload,
        m.linked_entity_type,
        m.linked_entity_id,
        m.idempotency_key,
        m.delivery_status,
        m.created_at,
        m.updated_at
      from public.chat_messages m
      where m.chat_id = p_chat_id
        and (
          p_cursor_created_at is null
          or (m.created_at, m.id) < (p_cursor_created_at, p_cursor_id)
        )
      order by m.created_at desc, m.id desc
      limit v_limit + 1
    ),
    page_rows as (
      select *
      from filtered
      limit v_limit
    ),
    page_count as (
      select count(*)::integer as cnt from filtered
    )
    select
      coalesce(
        (
          select jsonb_agg(
            jsonb_build_object(
              'id', r.id,
              'chat_id', r.chat_id,
              'sender_user_id', r.sender_user_id,
              'message_type', r.message_type,
              'payload', public.cns_project_message_payload_for_list(r.message_type, r.payload),
              'linked_entity_type', r.linked_entity_type,
              'linked_entity_id', r.linked_entity_id,
              'idempotency_key', r.idempotency_key,
              'delivery_status', r.delivery_status,
              'created_at', r.created_at,
              'updated_at', r.updated_at
            )
            order by r.created_at desc, r.id desc
          )
          from page_rows r
        ),
        '[]'::jsonb
      ),
      (select cnt > v_limit from page_count),
      case
        when (select cnt > v_limit from page_count) then (
          select jsonb_build_object(
            'created_at', pr.created_at,
            'id', pr.id
          )
          from page_rows pr
          order by pr.created_at asc, pr.id asc
          limit 1
        )
        else null
      end
    into v_items, v_has_more, v_next_cursor;
  end if;

  v_result := jsonb_build_object(
    'items', v_items,
    'has_more', v_has_more,
    'next_cursor', v_next_cursor
  );

  return public.cns_assert_list_response_size(v_result);
end;
$$;

create or replace function public.list_conversations(
  p_page_size integer default 20,
  p_cursor_last_interaction_at timestamptz default null,
  p_cursor_id uuid default null
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, auth
as $$
declare
  v_actor uuid := auth.uid();
  v_limit integer;
  v_items jsonb;
  v_has_more boolean := false;
  v_next_cursor jsonb;
  v_result jsonb;
begin
  if v_actor is null then
    raise exception 'Authentication required for list_conversations'
      using errcode = '42501';
  end if;

  v_limit := least(greatest(coalesce(p_page_size, 20), 1), 100);

  if p_cursor_last_interaction_at is not null and p_cursor_id is null then
    raise exception 'p_cursor_id is required when p_cursor_last_interaction_at is set'
      using errcode = '22023';
  end if;

  with filtered as (
    select
      c.id,
      c.service_request_id,
      c.client_id,
      c.provider_id,
      c.status,
      c.last_interaction_at,
      c.activated_at,
      c.inactivated_at,
      c.closed_at,
      c.created_at,
      c.updated_at,
      case
        when v_actor = c.client_id then c.provider_id
        else c.client_id
      end as counterparty_id,
      sr.title as service_request_title,
      ps.id as service_id,
      ps.title as service_title,
      ps.slug as service_slug,
      ps.icon_key as service_icon_key,
      ps.color_key as service_color_key,
      ps.image_url as service_image_url,
      last_msg.id as last_message_id,
      last_msg.message_type as last_message_type,
      last_msg.created_at as last_message_at,
      last_msg.linked_entity_type as last_message_linked_entity_type,
      last_msg.linked_entity_id as last_message_linked_entity_id,
      public.cns_message_preview_text(last_msg.message_type, last_msg.payload) as last_message_preview,
      coalesce(
        last_msg.created_at is not null
        and (
          rr.last_read_at is null
          or last_msg.created_at > rr.last_read_at
        ),
        false
      ) as is_unread,
      rr.last_read_at
    from public.chats c
    inner join public.service_requests sr on sr.id = c.service_request_id
    inner join public.platform_services ps on ps.id = sr.service_id
    left join public.chat_read_receipts rr
      on rr.chat_id = c.id
      and rr.user_id = v_actor
    left join lateral (
      select
        m.id,
        m.message_type,
        m.created_at,
        m.payload,
        m.linked_entity_type,
        m.linked_entity_id
      from public.chat_messages m
      where m.chat_id = c.id
      order by m.created_at desc, m.id desc
      limit 1
    ) last_msg on true
    where v_actor in (c.client_id, c.provider_id)
      and (
        p_cursor_last_interaction_at is null
        or (c.last_interaction_at, c.id) < (p_cursor_last_interaction_at, p_cursor_id)
      )
    order by c.last_interaction_at desc, c.id desc
    limit v_limit + 1
  ),
  page_rows as (
    select *
    from filtered
    limit v_limit
  ),
  page_count as (
    select count(*)::integer as cnt from filtered
  )
  select
    coalesce(
      (
        select jsonb_agg(
          jsonb_build_object(
            'id', r.id,
            'service_request_id', r.service_request_id,
            'client_id', r.client_id,
            'provider_id', r.provider_id,
            'status', r.status,
            'last_interaction_at', r.last_interaction_at,
            'activated_at', r.activated_at,
            'inactivated_at', r.inactivated_at,
            'closed_at', r.closed_at,
            'created_at', r.created_at,
            'updated_at', r.updated_at,
            'counterparty', jsonb_build_object(
              'id', cp.id,
              'full_name', cp.full_name,
              'profile_image_path', cp.profile_image_path,
              'role', cp.role
            ),
            'service_request_title', r.service_request_title,
            'service', jsonb_build_object(
              'id', r.service_id,
              'title', r.service_title,
              'slug', r.service_slug,
              'icon_key', r.service_icon_key,
              'color_key', r.service_color_key,
              'image_url', r.service_image_url
            ),
            'last_message', case
              when r.last_message_id is null then null
              else jsonb_build_object(
                'id', r.last_message_id,
                'message_type', r.last_message_type,
                'created_at', r.last_message_at,
                'preview_text', r.last_message_preview,
                'linked_entity_type', r.last_message_linked_entity_type,
                'linked_entity_id', r.last_message_linked_entity_id
              )
            end,
            'is_unread', r.is_unread,
            'last_read_at', r.last_read_at
          )
          order by r.last_interaction_at desc, r.id desc
        )
        from page_rows r
        inner join public.profiles cp on cp.id = r.counterparty_id
      ),
      '[]'::jsonb
    ),
    (select cnt > v_limit from page_count),
    case
      when (select cnt > v_limit from page_count) then (
        select jsonb_build_object(
          'last_interaction_at', pr.last_interaction_at,
          'id', pr.id
        )
        from page_rows pr
        order by pr.last_interaction_at asc, pr.id asc
        limit 1
      )
      else null
    end
  into v_items, v_has_more, v_next_cursor;

  v_result := jsonb_build_object(
    'items', v_items,
    'has_more', v_has_more,
    'next_cursor', v_next_cursor
  );

  return public.cns_assert_list_response_size(v_result);
end;
$$;

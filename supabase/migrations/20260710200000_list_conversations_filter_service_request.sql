-- Optional service_request_id filter for list_conversations (client deep link from Meus Serviços).

drop function if exists public.list_conversations(integer, timestamptz, uuid);

create or replace function public.list_conversations(
  p_page_size integer default 20,
  p_cursor_last_interaction_at timestamptz default null,
  p_cursor_id uuid default null,
  p_service_request_id uuid default null
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
      public.cns_chat_is_unread_for_user(c.id, v_actor) as is_unread,
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
        p_service_request_id is null
        or c.service_request_id = p_service_request_id
      )
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

comment on function public.list_conversations(integer, timestamptz, uuid, uuid) is
  'Paginated inbox for authenticated participant; optional filter by service_request_id.';

revoke all on function public.list_conversations(integer, timestamptz, uuid, uuid) from public;
revoke all on function public.list_conversations(integer, timestamptz, uuid, uuid) from anon;
grant execute on function public.list_conversations(integer, timestamptz, uuid, uuid) to authenticated;

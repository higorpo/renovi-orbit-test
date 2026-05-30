-- CNS Wave C — task 59: keyset message history RPC (design §3.4, §4.9; Req. 3, 13, 22).
-- Depends on chat_messages (task 4). Uses chat_messages_conversation_created_idx / _cursor_idx.

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
              'payload', r.payload,
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
      (select cnt > v_limit from page_count)
    into v_items, v_has_more;

    if v_has_more then
      select jsonb_build_object(
        'created_at', r.created_at,
        'id', r.id
      )
      into v_next_cursor
      from (
        select pr.created_at, pr.id
        from page_rows pr
        order by pr.created_at desc, pr.id desc
        limit 1
      ) r;
    end if;
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
              'payload', r.payload,
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
      (select cnt > v_limit from page_count)
    into v_items, v_has_more;

    if v_has_more then
      select jsonb_build_object(
        'created_at', r.created_at,
        'id', r.id
      )
      into v_next_cursor
      from (
        select pr.created_at, pr.id
        from page_rows pr
        order by pr.created_at asc, pr.id asc
        limit 1
      ) r;
    end if;
  end if;

  return jsonb_build_object(
    'items', v_items,
    'has_more', v_has_more,
    'next_cursor', v_next_cursor
  );
end;
$$;

comment on function public.list_chat_messages(uuid, integer, timestamptz, uuid, boolean) is
  'Participant message history: keyset on (created_at, id); p_after=true for Realtime gap fill (R3-AC08, R13-AC04).';

revoke all on function public.list_chat_messages(uuid, integer, timestamptz, uuid, boolean) from public;
revoke all on function public.list_chat_messages(uuid, integer, timestamptz, uuid, boolean) from anon;
grant execute on function public.list_chat_messages(uuid, integer, timestamptz, uuid, boolean) to authenticated;

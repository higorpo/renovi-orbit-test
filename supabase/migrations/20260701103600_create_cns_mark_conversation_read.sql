-- CNS Wave B — task 37: per-participant read cursor upsert RPC (design §5.1, Req. 3, 17).
-- Migration order: runs AFTER task 5 (chat_read_receipts).

create or replace function public.cns_mark_conversation_read(
  p_chat_id uuid,
  p_last_read_message_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_actor uuid := auth.uid();
  v_last_read_at timestamptz := now();
  v_message public.chat_messages%rowtype;
begin
  if v_actor is null then
    raise exception 'Authentication required for cns_mark_conversation_read'
      using errcode = '42501';
  end if;

  if p_chat_id is null then
    raise exception 'p_chat_id is required'
      using errcode = '22023';
  end if;

  if not public.is_chat_participant(p_chat_id) then
    raise exception 'NOT_A_PARTICIPANT'
      using errcode = '42501';
  end if;

  if p_last_read_message_id is not null then
    select *
    into v_message
    from public.chat_messages cm
    where cm.id = p_last_read_message_id;

    if not found or v_message.chat_id <> p_chat_id then
      raise exception 'INVALID_MESSAGE_ID'
        using
          errcode = 'P0001',
          detail = jsonb_build_object('code', 'INVALID_MESSAGE_ID')::text;
    end if;

    v_last_read_at := v_message.created_at;
  end if;

  insert into public.chat_read_receipts (
    chat_id,
    user_id,
    last_read_at,
    last_read_message_id
  )
  values (
    p_chat_id,
    v_actor,
    v_last_read_at,
    p_last_read_message_id
  )
  on conflict (chat_id, user_id) do update
  set
    last_read_at = greatest(excluded.last_read_at, chat_read_receipts.last_read_at),
    last_read_message_id = case
      when excluded.last_read_at >= chat_read_receipts.last_read_at
        then excluded.last_read_message_id
      else chat_read_receipts.last_read_message_id
    end
  returning last_read_at into v_last_read_at;

  raise log 'cns_mark_conversation_read_total chat_id=% user_id=%',
    p_chat_id,
    v_actor;

  return jsonb_build_object('last_read_at', v_last_read_at);
end;
$$;

comment on function public.cns_mark_conversation_read(uuid, uuid) is
  'Upsert participant read cursor; optional message anchor validated against conversation (R3-AC10, R17-AC04).';

grant execute on function public.cns_mark_conversation_read(uuid, uuid) to authenticated;

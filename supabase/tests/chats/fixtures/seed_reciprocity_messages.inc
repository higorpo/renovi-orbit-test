-- pgTAP fixture: insert chat_messages for reciprocity scenarios (CNS task 27).
-- Included via: \ir fixtures/seed_reciprocity_messages.inc
--
-- Prerequisites: chat row from pg_temp.cns_seed_chat; temp table _reciprocity_chat(chat_id).

create or replace function pg_temp.cns_seed_reciprocity_message(
  p_chat_id uuid,
  p_sender_user_id uuid,
  p_message_type public.cns_message_type,
  p_created_at timestamptz default now(),
  p_idempotency_key uuid default gen_random_uuid()
)
returns uuid
language plpgsql
as $$
declare
  v_message_id uuid;
begin
  insert into public.chat_messages (
    chat_id,
    sender_user_id,
    message_type,
    payload,
    idempotency_key,
    created_at
  )
  values (
    p_chat_id,
    p_sender_user_id,
    p_message_type,
    '{}'::jsonb,
    p_idempotency_key,
    p_created_at
  )
  returning id into v_message_id;

  return v_message_id;
end;
$$;

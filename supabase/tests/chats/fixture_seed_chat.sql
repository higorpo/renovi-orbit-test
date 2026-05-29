-- pgTAP fixture seed helper for public.chats (CNS task 2).
-- Include at the start of a test transaction: \ir fixture_seed_chat.sql
--
-- Prerequisites (existing rows): service_requests.id, profiles for client_id and provider_id.
--
-- Usage:
--   select pg_temp.cns_seed_chat(
--     p_service_request_id := '<sr uuid>',
--     p_client_id := '<client profile uuid>',
--     p_provider_id := '<provider profile uuid>'
--   );

create or replace function pg_temp.cns_seed_chat(
  p_service_request_id uuid,
  p_client_id uuid,
  p_provider_id uuid,
  p_status public.cns_conversation_status default 'ACTIVE',
  p_last_interaction_at timestamptz default now()
)
returns uuid
language plpgsql
as $$
declare
  v_chat_id uuid;
begin
  insert into public.chats (
    service_request_id,
    client_id,
    provider_id,
    status,
    last_interaction_at
  )
  values (
    p_service_request_id,
    p_client_id,
    p_provider_id,
    p_status,
    p_last_interaction_at
  )
  on conflict (service_request_id, provider_id) do update
    set
      status = excluded.status,
      last_interaction_at = excluded.last_interaction_at,
      updated_at = now()
  returning id into v_chat_id;

  return v_chat_id;
end;
$$;

comment on function pg_temp.cns_seed_chat(uuid, uuid, uuid, public.cns_conversation_status, timestamptz) is
  'pgTAP-only: idempotent chat insert for CNS tests (unique pair upsert).';

-- Proposal decouple from chat (plan: migration 1) — lookup helper only.

create or replace function public.resolve_proposal_chat_id(
  p_service_request_id uuid,
  p_provider_id uuid
)
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select c.id
  from public.chats c
  where c.service_request_id = p_service_request_id
    and c.provider_id = p_provider_id
  order by c.updated_at desc
  limit 1;
$$;

comment on function public.resolve_proposal_chat_id(uuid, uuid) is
  'Returns chat id for provider+service_request when a conversation exists; used for timeline mirror and domain events.';

revoke all on function public.resolve_proposal_chat_id(uuid, uuid) from public;
revoke all on function public.resolve_proposal_chat_id(uuid, uuid) from anon;
grant execute on function public.resolve_proposal_chat_id(uuid, uuid) to authenticated;

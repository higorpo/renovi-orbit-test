-- CNS Phase 11 — task 78: GRANT SELECT only on CNS tables; mutations via SECURITY DEFINER RPCs (§11.2, OAC-01).
-- Depends on RLS policies tasks 72–75. Complements RLS deny policies with explicit privilege revocation.

revoke insert, update, delete on table public.chats from authenticated;
revoke insert, update, delete on table public.chat_messages from authenticated;
revoke insert, update, delete on table public.provider_proposals from authenticated;
revoke insert, update, delete on table public.services from authenticated;

grant select on table public.chats to authenticated;
grant select on table public.chat_messages to authenticated;
grant select on table public.provider_proposals to authenticated;
grant select on table public.services to authenticated;

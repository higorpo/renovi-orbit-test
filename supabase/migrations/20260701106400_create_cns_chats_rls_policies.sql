-- CNS Phase 11 — task 72: RLS on public.chats (design §11.2, Req. 31/35).
-- Depends on task 17 (is_platform_admin, is_chat_participant). Mutations: RPC only (task 78 REVOKE).

alter table public.chats enable row level security;

-- Single permissive SELECT: admin OR conversation participant (R35-AC01, R31-AC01).
-- Participant check is inlined (not is_chat_participant) to avoid RLS recursion on this table.
create policy chats_select
  on public.chats
  for select
  to authenticated
  using (
    (select public.is_platform_admin())
    or (select auth.uid()) in (client_id, provider_id)
  );

-- Defense in depth: deny direct PostgREST mutations for authenticated (§11.2, R35-AC08/09).
create policy chats_insert_denied
  on public.chats
  for insert
  to authenticated
  with check (false);

create policy chats_update_denied
  on public.chats
  for update
  to authenticated
  using (false)
  with check (false);

create policy chats_delete_denied
  on public.chats
  for delete
  to authenticated
  using (false);

comment on policy chats_select on public.chats is
  'Admin reads all conversations; client/provider read own rows only (task 72).';

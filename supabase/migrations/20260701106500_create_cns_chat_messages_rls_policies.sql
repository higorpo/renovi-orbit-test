-- CNS Phase 11 — task 73: RLS on public.chat_messages (design §11.2, Req. 3/35).
-- Depends on task 17 helpers and task 72 (chats RLS). Mutations: RPC only (task 78 REVOKE).

alter table public.chat_messages enable row level security;

create policy chat_messages_select
  on public.chat_messages
  for select
  to authenticated
  using (
    (select public.is_platform_admin())
    or (select public.is_chat_participant(chat_id))
  );

create policy chat_messages_insert_denied
  on public.chat_messages
  for insert
  to authenticated
  with check (false);

create policy chat_messages_update_denied
  on public.chat_messages
  for update
  to authenticated
  using (false)
  with check (false);

create policy chat_messages_delete_denied
  on public.chat_messages
  for delete
  to authenticated
  using (false);

comment on policy chat_messages_select on public.chat_messages is
  'Admin or chat participant may read messages; Realtime uses same RLS (R13-AC02, task 73).';

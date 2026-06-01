-- CNS Wave A — task 5: per-user read cursors (design §3.5).
-- Depends on chats; last_read_message_id references chat_messages (task 4).

create table public.chat_read_receipts (
  chat_id uuid not null references public.chats (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  last_read_at timestamptz not null default now(),
  last_read_message_id uuid references public.chat_messages (id),
  primary key (chat_id, user_id)
);

comment on table public.chat_read_receipts is
  'Per-participant read cursor for unread badges (list_conversations) and mark_read upserts.';

comment on column public.chat_read_receipts.last_read_message_id is
  'Optional anchor message; may be null until first explicit mark_read.';

alter table public.chat_read_receipts enable row level security;

create policy chat_read_receipts_select
  on public.chat_read_receipts
  for select
  to authenticated
  using (
    (select public.is_platform_admin())
    or (select public.is_chat_participant(chat_id))
  );

create policy chat_read_receipts_insert_denied
  on public.chat_read_receipts
  for insert
  to authenticated
  with check (false);

create policy chat_read_receipts_update_denied
  on public.chat_read_receipts
  for update
  to authenticated
  using (false)
  with check (false);

create policy chat_read_receipts_delete_denied
  on public.chat_read_receipts
  for delete
  to authenticated
  using (false);

comment on policy chat_read_receipts_select on public.chat_read_receipts is
  'Participants (and admins) may read all receipts in a chat for read indicators and Realtime.';

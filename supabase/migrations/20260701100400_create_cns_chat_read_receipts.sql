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

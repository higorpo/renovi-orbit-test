-- CNS Wave A — task 4: append-only chat_messages (design §3.4).
-- Depends on chats + cns enums. RLS policies: task 73.

create table public.chat_messages (
  id uuid primary key default gen_random_uuid(),
  chat_id uuid not null references public.chats (id) on delete restrict,
  sender_user_id uuid references public.profiles (id),
  message_type public.cns_message_type not null,
  payload jsonb not null default '{}'::jsonb,
  linked_entity_type text check (linked_entity_type in ('proposal', 'service_request', 'workflow')),
  linked_entity_id uuid,
  idempotency_key uuid not null,
  delivery_status public.cns_delivery_status not null default 'SENT',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint chat_messages_idempotency_scoped unique (chat_id, sender_user_id, idempotency_key),
  constraint chat_messages_payload_size check (octet_length(payload::text) <= 65536),
  constraint chat_messages_linked_pair check (
    (linked_entity_type is null and linked_entity_id is null)
    or (linked_entity_type is not null and linked_entity_id is not null)
  )
);

comment on table public.chat_messages is
  'Append-only chat log. Idempotency scope: (chat_id, sender_user_id, idempotency_key) per Req. 14.';

comment on column public.chat_messages.sender_user_id is
  'Null for system-generated messages (WORKFLOW_ACTION, SYSTEM types).';

comment on column public.chat_messages.idempotency_key is
  'Client UUID per logical operation; duplicate triple returns existing row in cns_send_message.';

comment on constraint chat_messages_idempotency_scoped on public.chat_messages is
  'Scoped idempotency for send_message replay (design §3.4, R14-AC01).';

create index chat_messages_conversation_created_idx
  on public.chat_messages (chat_id, created_at desc, id desc);

comment on index public.chat_messages_conversation_created_idx is
  'Keyset pagination: newest-first history (list_chat_messages).';

create index chat_messages_conversation_cursor_idx
  on public.chat_messages (chat_id, created_at asc, id asc);

comment on index public.chat_messages_conversation_cursor_idx is
  'Keyset pagination: forward cursor / sync from oldest anchor.';

create trigger chat_messages_updated_at
  before update on public.chat_messages
  for each row execute procedure public.set_updated_at();

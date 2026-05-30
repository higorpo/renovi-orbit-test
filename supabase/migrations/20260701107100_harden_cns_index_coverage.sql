-- CNS Phase 12 — task 80: verify §3 index coverage; add inbox + cron-aligned indexes (design §3, §9.2).
-- Audit: core §3 indexes present in migrations 20260701100100–20260701100600, 20260701101300,
-- 20260701103800 (provider_proposals_pending_sla_idx), 20260701104900 (chat_messages_pending_delivery_idx).
-- list_conversations: participant filter + ORDER BY last_interaction_at DESC, id DESC (tasks 58, 2).
-- list_chat_messages: chat_messages_conversation_*_idx (task 4).
-- cns_evaluate_reciprocity_batch: chats_reciprocity_poll_idx partial ACTIVE (task 2, R25-AC06).
-- expire_pending_proposals: provider_proposals_pending_sla_idx (task 39).
-- cns_process_domain_events: domain_events_unprocessed_idx (task 7).

-- Inbox keyset: avoids status column in index middle when list_conversations does not filter status.
create index if not exists chats_client_inbox_keyset_idx
  on public.chats (client_id, last_interaction_at desc, id desc);

create index if not exists chats_provider_inbox_keyset_idx
  on public.chats (provider_id, last_interaction_at desc, id desc);

comment on index public.chats_client_inbox_keyset_idx is
  'list_conversations keyset for clients: WHERE client_id = actor ORDER BY last_interaction_at DESC (task 80).';

comment on index public.chats_provider_inbox_keyset_idx is
  'list_conversations keyset for providers: WHERE provider_id = actor ORDER BY last_interaction_at DESC (task 80).';

-- Reciprocity cron: ACTIVE + stale last_interaction_at + OPEN SR (task 38).
-- chats_reciprocity_poll_idx covers the chat-side predicate; support SR OPEN filter on join.
create index if not exists service_requests_open_id_idx
  on public.service_requests (id)
  where status = 'OPEN'::public.service_request_status;

comment on index public.service_requests_open_id_idx is
  'Nested-loop join anchor for reciprocity cron when filtering OPEN service requests (task 80).';

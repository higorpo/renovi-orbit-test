-- CNS Wave A — task 7: transactional outbox (design §3.8).
-- Decouples mutation commits from MMD/async consumers (OAC-09). RLS: task 76.

create table public.domain_events (
  id uuid primary key default gen_random_uuid(),
  event_type text not null,
  aggregate_type text not null,
  aggregate_id uuid not null,
  service_request_id uuid references public.service_requests (id),
  chat_id uuid references public.chats (id),
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  processed_at timestamptz,
  locked_until timestamptz,
  locked_by text,
  retry_count int not null default 0,
  dead_letter boolean not null default false,
  dead_letter_at timestamptz,
  last_error text,
  constraint domain_events_type_check check (event_type ~ '^[A-Z][A-Z0-9_]*$')
);

comment on table public.domain_events is
  'CNS transactional outbox. Insert in same TX as mutation; cns_process_domain_events consumes at-least-once.';

comment on column public.domain_events.processed_at is
  'Set when consumer succeeds; null rows are eligible for checkout (SKIP LOCKED batches).';

create index domain_events_unprocessed_idx
  on public.domain_events (created_at)
  where processed_at is null and dead_letter = false;

create index domain_events_dead_letter_idx
  on public.domain_events (dead_letter_at)
  where dead_letter = true and processed_at is null;

create index domain_events_stale_lease_idx
  on public.domain_events (locked_until)
  where processed_at is null and locked_until is not null;

/*
 * Normative event_type registry (design §3.8). Do not emit ad-hoc aliases.
 *
 * | event_type                  | When emitted                          | Notes |
 * |-----------------------------|---------------------------------------|-------|
 * | CHAT_MESSAGE_SENT           | After text/image persisted            | MMD push |
 * | PROPOSAL_SUBMITTED          | cns_submit_proposal commit            | |
 * | PROPOSAL_ACCEPTED           | cns_accept_proposal commit            | |
 * | PROPOSAL_REJECTED           | Client reject                         | |
 * | PROPOSAL_EXPIRED            | Expiry cron                           | |
 * | PROPOSAL_REVISION_REQUESTED | Client revision request               | |
 * | CONVERSATION_INACTIVATED    | Reciprocity job                       | Per conversation |
 * | CONVERSATION_CLOSED         | Manual cns_close_conversation         | Single conversation |
 * | CHATS_CLOSED_BULK           | Accept cascade or SR cancel           | ONE row per SR; payload MUST include service_request_id and chat_ids (uuid[]) or closed_count |
 * | SLOT_RELEASED               | ACTIVE → INACTIVE                     | Optional matching hook |
 * | SERVICE_REQUEST_COMPLETED   | Accept                                | |
 * | SERVICE_REQUEST_CANCELLED   | Client cancel                         | |
 * | NEGOTIATION_TERMINATED      | Accept or cancel                      | SR-level optional matching hook |
 *
 * CHATS_CLOSED_BULK: consumers MUST NOT require N separate CONVERSATION_CLOSED rows for bulk close.
 * Retry policy: increment retry_count on failure; dead_letter after 5 failures (task 7 observability).
 */

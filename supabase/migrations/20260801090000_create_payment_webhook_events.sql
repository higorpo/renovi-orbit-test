-- Payment Task 11: payment_webhook_events (design.md §3.7, §11.2).
-- Webhook ingestion store; service_role only — no authenticated/anon access.

create table public.payment_webhook_events (
  id uuid primary key default gen_random_uuid(),
  gateway_slug public.payment_gateway_slug not null,
  event_type text not null,
  gateway_event_id text not null,
  raw_payload jsonb not null,
  raw_headers jsonb not null,
  state public.payment_webhook_event_state not null default 'RECEIVED',
  retry_count smallint not null default 0,
  next_retry_at timestamptz,
  processed_at timestamptz,
  failure_reason text,
  is_duplicate boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint payment_webhook_events_dedup_unique
    unique (gateway_slug, event_type, gateway_event_id)
);

comment on table public.payment_webhook_events is
  'Raw NetCred webhook events with deduplication and processing state machine.';

comment on constraint payment_webhook_events_dedup_unique on public.payment_webhook_events is
  'Primary deduplication key; conflicts mark is_duplicate without reprocessing.';

create index payment_webhook_events_retry_idx
  on public.payment_webhook_events (next_retry_at)
  where state = 'FAILED'::public.payment_webhook_event_state
    and next_retry_at is not null;

create index payment_webhook_events_pending_idx
  on public.payment_webhook_events (created_at)
  where state in (
    'RECEIVED'::public.payment_webhook_event_state,
    'VALIDATING'::public.payment_webhook_event_state
  );

create index payment_webhook_events_dead_letter_idx
  on public.payment_webhook_events (state, created_at)
  where state = 'DEAD_LETTER'::public.payment_webhook_event_state;

create trigger payment_webhook_events_updated_at
  before update on public.payment_webhook_events
  for each row
  execute procedure public.set_updated_at();

alter table public.payment_webhook_events enable row level security;

revoke all on table public.payment_webhook_events from public;
revoke all on table public.payment_webhook_events from anon;
revoke all on table public.payment_webhook_events from authenticated;

grant select, insert, update on table public.payment_webhook_events to service_role;

revoke delete on table public.payment_webhook_events from service_role;

-- Payment Task 12: payment_webhook_processing_queue (design.md §3.8, §11.2).
-- Async heavy webhook worker queue; service_role only.

create table public.payment_webhook_processing_queue (
  id uuid primary key default gen_random_uuid(),
  webhook_event_id uuid not null references public.payment_webhook_events (id) on delete restrict,
  gateway_slug public.payment_gateway_slug not null default 'netcred',
  event_type text not null,
  scheduled_at timestamptz not null default now(),
  attempted_at timestamptz,
  state public.payment_webhook_queue_state not null default 'PENDING',
  attempt_count smallint not null default 0,
  failure_reason text,
  created_at timestamptz not null default now(),
  constraint payment_webhook_processing_queue_event_unique
    unique (webhook_event_id)
);

comment on table public.payment_webhook_processing_queue is
  'Heavy-path webhook processing queue; drained by payment_cron_process_webhook_retry.';

create index payment_webhook_processing_queue_pending_idx
  on public.payment_webhook_processing_queue (state, scheduled_at)
  where state = 'PENDING'::public.payment_webhook_queue_state;

alter table public.payment_webhook_processing_queue enable row level security;

revoke all on table public.payment_webhook_processing_queue from public;
revoke all on table public.payment_webhook_processing_queue from anon;
revoke all on table public.payment_webhook_processing_queue from authenticated;

grant select, insert, update on table public.payment_webhook_processing_queue to service_role;

revoke delete on table public.payment_webhook_processing_queue from service_role;

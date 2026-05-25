-- Multichannel Message Dispatcher (MMD) — migration 1 of 4 (design §13.1).
-- Wave W0: schema, enums, tables, indexes, RLS (tasks 1–10 in docs/message-dispatcher/tasks.md).
--
-- PostgREST / API exposure (design §2.0, task 10):
--   - [api].schemas and [api].extra_search_path in supabase/config.toml MUST include
--     `message_dispatcher` so REST can invoke RPCs (e.g. /rest/v1/rpc/message_dispatcher_ingest).
--   - Mirror the same schema list on linked remote projects (Supabase dashboard → API).
--   - Orbit features MUST call MMD via feature api/ wrappers → RPC by name only.
--   - Forbidden: direct client INSERT/UPDATE on message_dispatches.status (FSM integrity).
--   - authenticated: USAGE + SELECT on tables (RLS enforces row scope on owner reads).
--   - service_role: USAGE on schema; mutations via SECURITY DEFINER RPCs only.
--   - public: no USAGE on message_dispatcher (isolated from domain tables).
--
-- Grant matrix (schema-level; table/RPC grants added in later sections of this file):
--   Role            | SCHEMA USAGE | Default on new tables (created by migration runner)
--   ----------------|--------------|--------------------------------------------------------
--   PUBLIC          | REVOKED      | —
--   authenticated   | GRANTED      | SELECT (read paths; RLS on each table)
--   service_role    | GRANTED      | ALL (RPC backend + cron; RLS bypassed where applicable)
--   postgres        | owner        | ALL (implicit via owner)

create schema if not exists message_dispatcher;

comment on schema message_dispatcher is
  'MMD-owned transactional outbox: dispatches, deliveries, audit, templates, limits (design §2.0).';

revoke all on schema message_dispatcher from public;
grant usage on schema message_dispatcher to service_role, authenticated;

alter default privileges in schema message_dispatcher
  grant select on tables to authenticated;

alter default privileges in schema message_dispatcher
  grant all on tables to service_role;

alter default privileges in schema message_dispatcher
  grant all on sequences to service_role;

alter default privileges in schema message_dispatcher
  grant execute on functions to service_role;

-- Enums (design §3.1, task 2). Channel allowlist is the first anti-abuse boundary (Req. 2 AC3).
create type message_dispatcher.message_channel as enum ('email', 'push');

comment on type message_dispatcher.message_channel is
  'Allowed dispatch channels only';

create type message_dispatcher.message_dispatch_status as enum (
  'PENDING_EVALUATION',
  'SCHEDULED',
  'CANCELED',
  'QUEUED',
  'PROCESSING',
  'DELIVERED',
  'FAILED_RETRYABLE',
  'FAILED_TERMINAL'
);

comment on type message_dispatcher.message_dispatch_status is
  'Parent dispatch FSM. Terminal: DELIVERED, FAILED_TERMINAL, CANCELED. Transient/retryable: PENDING_EVALUATION, SCHEDULED, QUEUED, PROCESSING, FAILED_RETRYABLE.';

create type message_dispatcher.message_delivery_outcome as enum (
  'pending',
  'sent',
  'failed_retryable',
  'failed_terminal'
);

comment on type message_dispatcher.message_delivery_outcome is
  'Per-device push delivery outcome. Terminal: sent, failed_terminal. Transient: pending, failed_retryable.';

-- message_templates (design §3.2, task 3). Ingest rejects unknown or inactive templates before Edge.
create table message_dispatcher.message_templates (
  template_key text not null,
  channel message_dispatcher.message_channel not null,
  subject_template text,
  body_template text not null,
  variable_schema jsonb not null default '{}'::jsonb,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  primary key (template_key, channel)
);

comment on table message_dispatcher.message_templates is
  'Registry of renderable templates; inactive or missing (template_key, channel) rejects at ingest.';

-- message_dispatches (design §3.3, task 4). FSM authority; recipient resolved at checkout, not stored here.
create table message_dispatcher.message_dispatches (
  id uuid primary key default gen_random_uuid(),
  idempotency_key uuid not null,
  profile_id uuid not null references public.profiles (id) on delete cascade,
  channel message_dispatcher.message_channel not null,
  template_key text not null,
  template_variables jsonb not null default '{}'::jsonb,
  status message_dispatcher.message_dispatch_status not null default 'PENDING_EVALUATION',
  scheduled_for timestamptz not null default now(),
  locked_until timestamptz,
  locked_by text,
  retry_count integer not null default 0,
  max_retries integer not null default 3,
  next_retry_at timestamptz,
  cancel_reason text,
  failure_reason text,
  failure_code text,
  vendor_message_id text,
  correlation_id uuid not null default gen_random_uuid(),
  source_system text not null default 'orbit',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint message_dispatches_idempotency_key_unique unique (idempotency_key),
  constraint message_dispatches_template_variables_max_bytes check (
    octet_length(template_variables::text) <= 8192
  ),
  constraint message_dispatches_retry_count_nonneg check (retry_count >= 0),
  constraint message_dispatches_max_retries_positive check (max_retries > 0),
  foreign key (template_key, channel)
    references message_dispatcher.message_templates (template_key, channel)
);

comment on table message_dispatcher.message_dispatches is
  'Canonical dispatch FSM record; status mutations via RPC only (not direct client UPDATE).';

comment on column message_dispatcher.message_dispatches.locked_until is
  'Lease expiry; NULL when not in PROCESSING.';

comment on column message_dispatcher.message_dispatches.correlation_id is
  'Stable id for logs, FCM collapse_key, Resend idempotency header.';

-- Partial indexes on message_dispatches (design §3.3.2, task 9). idempotency_key already UNIQUE-indexed.
create index message_dispatches_queued_poll_idx
  on message_dispatcher.message_dispatches (scheduled_for, created_at)
  where status = 'QUEUED';

create index message_dispatches_scheduled_due_idx
  on message_dispatcher.message_dispatches (scheduled_for)
  where status = 'SCHEDULED';

create index message_dispatches_retry_due_idx
  on message_dispatcher.message_dispatches (next_retry_at)
  where status = 'FAILED_RETRYABLE';

create index message_dispatches_stale_lease_idx
  on message_dispatcher.message_dispatches (locked_until)
  where status = 'PROCESSING';

create index message_dispatches_profile_channel_created_idx
  on message_dispatcher.message_dispatches (profile_id, channel, created_at desc);

create index message_dispatches_vendor_message_id_idx
  on message_dispatcher.message_dispatches (vendor_message_id)
  where vendor_message_id is not null;

-- message_dispatcher_user_limits (design §3.4, task 5). One row per profile; ingest locks FOR UPDATE.
create table message_dispatcher.message_dispatcher_user_limits (
  profile_id uuid primary key references public.profiles (id) on delete cascade,
  last_push_sent_at timestamptz,
  email_window_start timestamptz not null default now(),
  push_window_start timestamptz not null default now(),
  email_count_24h integer not null default 0,
  push_count_24h integer not null default 0
);

comment on table message_dispatcher.message_dispatcher_user_limits is
  'Per-profile serialization anchor for ingest quota and push cooldown (FOR UPDATE in ingest RPC).';

comment on column message_dispatcher.message_dispatcher_user_limits.email_count_24h is
  'Optimization cache; authoritative email quota uses live COUNT on message_dispatches in ingest txn. Updated on email DELIVERED.';

comment on column message_dispatcher.message_dispatcher_user_limits.push_count_24h is
  'Optimization cache; authoritative push quota uses live COUNT on message_dispatches in ingest txn. Updated on push DELIVERED.';

-- message_dispatch_deliveries (design §3.5, task 6). Per-device push fan-out; token snapshot at checkout.
create table message_dispatcher.message_dispatch_deliveries (
  id uuid primary key default gen_random_uuid(),
  dispatch_id uuid not null references message_dispatcher.message_dispatches (id) on delete cascade,
  device_id text not null,
  fcm_token_snapshot text,
  outcome message_dispatcher.message_delivery_outcome not null default 'pending',
  vendor_error_code text,
  vendor_response jsonb,
  attempt_no integer not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint message_dispatch_deliveries_dispatch_device_attempt_unique
    unique (dispatch_id, device_id, attempt_no)
);

comment on table message_dispatcher.message_dispatch_deliveries is
  'Per-device push delivery rows; fcm_token_snapshot is immutable after checkout.';

comment on column message_dispatcher.message_dispatch_deliveries.fcm_token_snapshot is
  'FCM token at checkout; worker must not re-read live beacons during send.';

-- message_dispatcher_audit (design §3.6, task 7). Append-only; indexes in task 19.
create table message_dispatcher.message_dispatcher_audit (
  id bigserial primary key,
  dispatch_id uuid not null references message_dispatcher.message_dispatches (id) on delete cascade,
  profile_id uuid not null,
  old_status message_dispatcher.message_dispatch_status,
  new_status message_dispatcher.message_dispatch_status not null,
  changed_by text not null default 'system',
  correlation_id uuid,
  delta jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

comment on table message_dispatcher.message_dispatcher_audit is
  'Immutable dispatch transition history; populated by trigger on parent UPDATE (task 12). Growth: monthly RANGE(created_at) stub task 110.';

-- message_dispatcher_vendor_events (design §3.7, task 8). Insert-only webhook ingress log.
create table message_dispatcher.message_dispatcher_vendor_events (
  vendor_event_id text primary key,
  dispatch_id uuid references message_dispatcher.message_dispatches (id),
  vendor text not null check (vendor in ('resend', 'fcm')),
  event_type text not null,
  payload jsonb not null,
  processed_at timestamptz not null default now()
);

comment on table message_dispatcher.message_dispatcher_vendor_events is
  'Idempotent vendor webhook ingress; UNIQUE vendor_event_id dedupes at-least-once replays.';

-- message_dispatcher_stats (design §10.2, task 83). Cron-refreshed gauges for Logflare / external scrape.
create table message_dispatcher.message_dispatcher_stats (
  metric_name text not null,
  labels jsonb not null default '{}'::jsonb,
  value bigint not null,
  collected_at timestamptz not null default now(),
  primary key (metric_name, labels)
);

comment on table message_dispatcher.message_dispatcher_stats is
  'Latest MMD gauge snapshots (mmd_queue_depth, mmd_queue_lag, mmd_retryable_failures). Refreshed by mmd_refresh_stats cron.';

revoke all on message_dispatcher.message_dispatcher_stats from public;
revoke all on message_dispatcher.message_dispatcher_stats from authenticated;
grant select on message_dispatcher.message_dispatcher_stats to service_role;

-- RLS: message_dispatches (design §3.8, task 13). Owner read-only; mutations via SECURITY DEFINER RPCs only.
alter table message_dispatcher.message_dispatches enable row level security;

create policy message_dispatches_select_owner
  on message_dispatcher.message_dispatches
  for select
  to authenticated
  using ((select auth.uid()) = profile_id);

revoke insert, update, delete on message_dispatcher.message_dispatches from authenticated;
revoke insert, update, delete on message_dispatcher.message_dispatches from anon;
revoke insert, update, delete on message_dispatcher.message_dispatches from public;

-- RLS: message_dispatcher_audit (design §3.8, task 14). Append-only via trigger; owner SELECT only.
alter table message_dispatcher.message_dispatcher_audit enable row level security;

create policy message_dispatcher_audit_select_owner
  on message_dispatcher.message_dispatcher_audit
  for select
  to authenticated
  using ((select auth.uid()) = profile_id);

revoke insert, update, delete on message_dispatcher.message_dispatcher_audit from authenticated;

-- RLS: message_dispatch_deliveries (design §3.8, task 15). SELECT via owned parent dispatch.
alter table message_dispatcher.message_dispatch_deliveries enable row level security;

create policy message_dispatch_deliveries_select_owner
  on message_dispatcher.message_dispatch_deliveries
  for select
  to authenticated
  using (
    exists (
      select 1
      from message_dispatcher.message_dispatches d
      where d.id = dispatch_id
        and d.profile_id = (select auth.uid())
    )
  );

revoke insert, update, delete on message_dispatcher.message_dispatch_deliveries from authenticated;

-- RLS: message_templates (design §3.8, task 16). Read-only catalog for authenticated; writes via migrations/seeds only.
alter table message_dispatcher.message_templates enable row level security;

create policy message_templates_select_authenticated
  on message_dispatcher.message_templates
  for select
  to authenticated
  using (true);

revoke insert, update, delete on message_dispatcher.message_templates from authenticated;

-- RLS: message_dispatcher_user_limits (design §3.8). Owner read-only; mutations via SECURITY DEFINER RPCs only.
alter table message_dispatcher.message_dispatcher_user_limits enable row level security;

create policy message_dispatcher_user_limits_select_owner
  on message_dispatcher.message_dispatcher_user_limits
  for select
  to authenticated
  using ((select auth.uid()) = profile_id);

revoke insert, update, delete on message_dispatcher.message_dispatcher_user_limits from authenticated;
revoke insert, update, delete on message_dispatcher.message_dispatcher_user_limits from anon;
revoke insert, update, delete on message_dispatcher.message_dispatcher_user_limits from public;

-- RLS: message_dispatcher_vendor_events (design §3.8). Internal ingress log; no direct access for end users.
alter table message_dispatcher.message_dispatcher_vendor_events enable row level security;

revoke all on message_dispatcher.message_dispatcher_vendor_events from authenticated;
revoke all on message_dispatcher.message_dispatcher_vendor_events from anon;
revoke all on message_dispatcher.message_dispatcher_vendor_events from public;
grant select, insert, update on message_dispatcher.message_dispatcher_vendor_events to service_role;

-- platform_constants defaults (design Appendix B, task 17). RPCs read keys at runtime.
insert into public.platform_constants (key, value, description)
values
  ('message_dispatcher.email_daily_limit', '5'::jsonb, 'Maximum number of emails that can be sent to a single user per day'),
  ('message_dispatcher.push_daily_limit', '20'::jsonb, 'Maximum number of push notifications that can be sent to a single user per day'),
  ('message_dispatcher.push_cooldown_minutes', '20'::jsonb, 'Minimum minutes between consecutive push notifications to the same user'),
  ('message_dispatcher.lease_seconds', '90'::jsonb, 'Duration in seconds a worker holds a lease on a dispatch before it expires'),
  ('message_dispatcher.checkout_batch_size', '50'::jsonb, 'Number of dispatches a worker checks out in a single batch'),
  ('message_dispatcher.backoff_base_seconds', '60'::jsonb, 'Base interval in seconds for exponential backoff between retries'),
  ('message_dispatcher.max_devices_per_dispatch', '10'::jsonb, 'Maximum number of devices targeted per single dispatch operation'),
  ('message_dispatcher.max_parallel_workers', '5'::jsonb, 'Maximum number of worker instances allowed to run concurrently'),
  ('message_dispatcher.retryable_depth_alert_threshold', '10000'::jsonb, 'Queue depth threshold that triggers a backpressure alert for retryable dispatches')
on conflict (key) do update set
  value = excluded.value,
  description = excluded.description,
  updated_at = now();

-- Audit timeline indexes (design §3.6, task 19). Support dispatch and profile+date queries.
create index message_dispatcher_audit_dispatch_created_idx
  on message_dispatcher.message_dispatcher_audit (dispatch_id, created_at desc);

create index message_dispatcher_audit_profile_created_idx
  on message_dispatcher.message_dispatcher_audit (profile_id, created_at desc);

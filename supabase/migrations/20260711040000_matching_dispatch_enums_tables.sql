-- Matching M5 — dispatch enums, tables, indexes, RLS deny (design §3.2–3.4, §3.8).

create type public.service_request_dispatch_status as enum (
  'DISPATCH_PENDING',
  'DISPATCH_ACTIVE',
  'DISPATCH_PAUSED',
  'DISPATCH_STOPPED',
  'DISPATCH_MATCHED',
  'DISPATCH_FALLBACK_OPEN_MARKET',
  'DISPATCH_CANCELLED',
  'DISPATCH_EXPIRED'
);

create type public.service_request_dispatch_event_type as enum (
  'state_transition',
  'batch_opened',
  'pool_exhausted',
  'provider_viewed',
  'provider_declined',
  'dispatch_expired',
  'dispatch_paused',
  'dispatch_resumed'
);

create table public.service_request_dispatches (
  id uuid primary key default gen_random_uuid(),
  service_request_id uuid not null references public.service_requests (id) on delete cascade,
  status public.service_request_dispatch_status not null default 'DISPATCH_PENDING',
  next_batch_at timestamptz,
  fallback_opened_at timestamptz,
  batch_sequence int not null default 0,
  lease_owner text,
  lease_expires_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint service_request_dispatches_sr_id_unique unique (service_request_id),
  constraint service_request_dispatches_fallback_requires_ts check (
    status <> 'DISPATCH_FALLBACK_OPEN_MARKET' or fallback_opened_at is not null
  ),
  constraint service_request_dispatches_lease_pairing check (
    (lease_owner is null and lease_expires_at is null)
    or (lease_owner is not null and lease_expires_at is not null)
  ),
  constraint service_request_dispatches_terminal_no_next_batch check (
    status not in (
      'DISPATCH_MATCHED',
      'DISPATCH_CANCELLED',
      'DISPATCH_EXPIRED'
    )
    or next_batch_at is null
  )
);

comment on table public.service_request_dispatches is
  'One dispatch FSM row per service request; bootstrap trigger creates on first OPEN.';
comment on column public.service_request_dispatches.batch_sequence is
  'Last opened progressive batch number.';
comment on column public.service_request_dispatches.lease_owner is
  'Cron worker lease holder; format matching_cron:{job_run_id}.';

create index service_request_dispatches_next_batch_at_idx
  on public.service_request_dispatches (next_batch_at)
  where next_batch_at is not null
    and status not in ('DISPATCH_MATCHED', 'DISPATCH_CANCELLED', 'DISPATCH_EXPIRED');

create index service_request_dispatches_gate_reeval_idx
  on public.service_request_dispatches (status, updated_at)
  where status in ('DISPATCH_PAUSED', 'DISPATCH_STOPPED');

create index service_request_dispatches_lifecycle_idx
  on public.service_request_dispatches (created_at)
  where status not in ('DISPATCH_MATCHED', 'DISPATCH_CANCELLED', 'DISPATCH_EXPIRED');

create trigger service_request_dispatches_updated_at
  before update on public.service_request_dispatches
  for each row
  execute procedure public.set_updated_at();

create or replace function public.trg_fn_dispatch_clear_next_batch_on_terminal()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.status in (
    'DISPATCH_MATCHED'::public.service_request_dispatch_status,
    'DISPATCH_CANCELLED'::public.service_request_dispatch_status,
    'DISPATCH_EXPIRED'::public.service_request_dispatch_status
  ) then
    new.next_batch_at := null;
  end if;
  return new;
end;
$$;

create trigger service_request_dispatches_terminal_next_batch
  before insert or update of status, next_batch_at on public.service_request_dispatches
  for each row
  execute function public.trg_fn_dispatch_clear_next_batch_on_terminal();

create table public.service_request_provider_visibility (
  id uuid primary key default gen_random_uuid(),
  service_request_id uuid not null references public.service_requests (id) on delete cascade,
  provider_id uuid not null references public.profiles (id) on delete cascade,
  source text not null check (source in ('batch', 'fallback_dismiss')),
  granted_at timestamptz,
  dismissed_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz not null default now(),
  constraint srv_visibility_batch_granted check (
    source <> 'batch' or granted_at is not null
  ),
  constraint srv_visibility_fallback_dismiss_lifecycle check (
    source <> 'fallback_dismiss'
    or (
      dismissed_at is not null
      and granted_at is null
      and revoked_at is null
    )
  )
);

comment on table public.service_request_provider_visibility is
  'Persisted batch visibility and fallback dismiss markers for provider opportunities feed.';

create unique index service_request_provider_visibility_batch_unique
  on public.service_request_provider_visibility (service_request_id, provider_id)
  where source = 'batch' and revoked_at is null;

create unique index srv_visibility_fallback_dismiss_unique
  on public.service_request_provider_visibility (service_request_id, provider_id)
  where source = 'fallback_dismiss';

create index srv_visibility_feed_idx
  on public.service_request_provider_visibility (provider_id, granted_at desc)
  where revoked_at is null and dismissed_at is null and source = 'batch';

create index srv_visibility_exposure_idx
  on public.service_request_provider_visibility (provider_id, granted_at desc)
  where source = 'batch' and revoked_at is null;

create table public.service_request_dispatch_batches (
  id uuid primary key default gen_random_uuid(),
  dispatch_id uuid not null references public.service_request_dispatches (id) on delete cascade,
  batch_number int not null,
  explored_h3_cells jsonb,
  opened_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  constraint dispatch_batches_number_unique unique (dispatch_id, batch_number),
  constraint dispatch_batches_number_positive check (batch_number >= 1)
);

comment on table public.service_request_dispatch_batches is
  'Append-only progressive batch sequence per dispatch.';
comment on column public.service_request_dispatch_batches.explored_h3_cells is
  'Audit-only H3 cells explored during discovery for this batch.';

create index service_request_dispatch_batches_dispatch_idx
  on public.service_request_dispatch_batches (dispatch_id, batch_number desc);

alter table public.service_request_provider_visibility
  add column batch_id uuid references public.service_request_dispatch_batches (id) on delete set null;

create index service_request_dispatches_fallback_feed_idx
  on public.service_request_dispatches (fallback_opened_at desc)
  where fallback_opened_at is not null
    and status not in ('DISPATCH_MATCHED', 'DISPATCH_CANCELLED', 'DISPATCH_EXPIRED');

create index contracted_services_provider_pending_schedule_idx
  on public.contracted_services (provider_id, scheduled_start_date, scheduled_end_date)
  where status = 'PENDING_PAYMENT'
    and scheduled_start_date is not null
    and scheduled_end_date is not null;

create index chats_sr_active_recent_idx
  on public.chats (service_request_id, status, last_interaction_at desc)
  where status = 'ACTIVE';

create table public.service_request_dispatch_events (
  id uuid primary key default gen_random_uuid(),
  dispatch_id uuid not null references public.service_request_dispatches (id) on delete cascade,
  service_request_id uuid not null references public.service_requests (id) on delete cascade,
  provider_id uuid references public.profiles (id) on delete set null,
  event_type public.service_request_dispatch_event_type not null,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

comment on table public.service_request_dispatch_events is
  'Append-only dispatch audit trail; RPC-only writes for authenticated users.';

create unique index dispatch_events_provider_viewed_unique
  on public.service_request_dispatch_events (service_request_id, provider_id)
  where event_type = 'provider_viewed';

create unique index dispatch_events_provider_declined_unique
  on public.service_request_dispatch_events (service_request_id, provider_id)
  where event_type = 'provider_declined';

create index dispatch_events_dispatch_id_idx
  on public.service_request_dispatch_events (dispatch_id, created_at desc);

create index dispatch_events_sr_provider_idx
  on public.service_request_dispatch_events (service_request_id, provider_id, event_type);

create table public.service_request_dispatch_batch_providers (
  id uuid primary key default gen_random_uuid(),
  batch_id uuid not null references public.service_request_dispatch_batches (id) on delete cascade,
  provider_id uuid not null references public.profiles (id) on delete cascade,
  ranking_score numeric(8, 4) not null,
  score_components jsonb not null default '{}'::jsonb,
  device_id text,
  created_at timestamptz not null default now(),
  constraint batch_providers_unique unique (batch_id, provider_id)
);

comment on table public.service_request_dispatch_batch_providers is
  'Providers included in a dispatch batch with ranking snapshot at open time.';
comment on column public.service_request_dispatch_batch_providers.device_id is
  'Originating user_device_beacons.device_id when notification was enqueued.';

create index dispatch_batch_providers_provider_created_idx
  on public.service_request_dispatch_batch_providers (provider_id, created_at desc);

-- RLS: deny direct authenticated access; mutations via SECURITY DEFINER RPCs/triggers only.
alter table public.service_request_dispatches enable row level security;
alter table public.service_request_dispatch_batches enable row level security;
alter table public.service_request_dispatch_batch_providers enable row level security;
alter table public.service_request_provider_visibility enable row level security;
alter table public.service_request_dispatch_events enable row level security;

create policy service_request_dispatches_select_denied
  on public.service_request_dispatches for select to authenticated using (false);
create policy service_request_dispatches_insert_denied
  on public.service_request_dispatches for insert to authenticated with check (false);
create policy service_request_dispatches_update_denied
  on public.service_request_dispatches for update to authenticated using (false) with check (false);
create policy service_request_dispatches_delete_denied
  on public.service_request_dispatches for delete to authenticated using (false);

create policy service_request_dispatches_anon_select_denied
  on public.service_request_dispatches for select to anon using (false);
create policy service_request_dispatches_anon_insert_denied
  on public.service_request_dispatches for insert to anon with check (false);
create policy service_request_dispatches_anon_update_denied
  on public.service_request_dispatches for update to anon using (false) with check (false);
create policy service_request_dispatches_anon_delete_denied
  on public.service_request_dispatches for delete to anon using (false);

create policy service_request_dispatch_batches_select_denied
  on public.service_request_dispatch_batches for select to authenticated using (false);
create policy service_request_dispatch_batches_insert_denied
  on public.service_request_dispatch_batches for insert to authenticated with check (false);
create policy service_request_dispatch_batches_update_denied
  on public.service_request_dispatch_batches for update to authenticated using (false) with check (false);
create policy service_request_dispatch_batches_delete_denied
  on public.service_request_dispatch_batches for delete to authenticated using (false);

create policy service_request_dispatch_batch_providers_select_denied
  on public.service_request_dispatch_batch_providers for select to authenticated using (false);
create policy service_request_dispatch_batch_providers_insert_denied
  on public.service_request_dispatch_batch_providers for insert to authenticated with check (false);
create policy service_request_dispatch_batch_providers_update_denied
  on public.service_request_dispatch_batch_providers for update to authenticated using (false) with check (false);
create policy service_request_dispatch_batch_providers_delete_denied
  on public.service_request_dispatch_batch_providers for delete to authenticated using (false);

create policy service_request_provider_visibility_select_denied
  on public.service_request_provider_visibility for select to authenticated using (false);
create policy service_request_provider_visibility_insert_denied
  on public.service_request_provider_visibility for insert to authenticated with check (false);
create policy service_request_provider_visibility_update_denied
  on public.service_request_provider_visibility for update to authenticated using (false) with check (false);
create policy service_request_provider_visibility_delete_denied
  on public.service_request_provider_visibility for delete to authenticated using (false);

create policy service_request_dispatch_events_select_denied
  on public.service_request_dispatch_events for select to authenticated using (false);
create policy service_request_dispatch_events_insert_denied
  on public.service_request_dispatch_events for insert to authenticated with check (false);
create policy service_request_dispatch_events_update_denied
  on public.service_request_dispatch_events for update to authenticated using (false) with check (false);
create policy service_request_dispatch_events_delete_denied
  on public.service_request_dispatch_events for delete to authenticated using (false);

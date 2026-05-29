-- CNS Wave A — task 6: contracted service row post-accept (design §3.7).
-- Distinct from public.platform_services (catalog). Insert only in accept_proposal TX.
-- Depends on contracted_service_status enum (task 1).
-- Scheduling mirrors provider_proposals.proposal_suggested_slots + client selected_slot at accept.

create table public.services (
  id uuid primary key default gen_random_uuid(),
  service_request_id uuid not null references public.service_requests (id) on delete restrict,
  accepted_proposal_id uuid not null references public.provider_proposals (id) on delete restrict,
  client_id uuid not null references public.profiles (id) on delete restrict,
  provider_id uuid not null references public.profiles (id) on delete restrict,
  duration_unit text not null check (duration_unit in ('hours', 'days')),
  duration_value integer not null check (duration_value > 0),
  scheduled_start_date date not null,
  scheduled_end_date date,
  scheduled_shift text not null
    check (scheduled_shift in ('morning', 'afternoon', 'full_day')),
  agreed_slot jsonb not null,
  status public.contracted_service_status not null default 'PENDING_PAYMENT',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint services_one_per_request unique (service_request_id),
  constraint services_one_per_proposal unique (accepted_proposal_id),
  constraint services_agreed_slot_object check (jsonb_typeof(agreed_slot) = 'object'),
  constraint services_hours_slot_shape check (
    duration_unit <> 'hours'
    or scheduled_end_date is null
  ),
  constraint services_days_slot_shape check (
    duration_unit <> 'days'
    or (
      scheduled_end_date is not null
      and scheduled_end_date >= scheduled_start_date
      and (scheduled_end_date - scheduled_start_date + 1) = duration_value
    )
  )
);

comment on table public.services is
  'Contracted service after proposal accept (platform-flow.mmd node BA). Not the service catalog.';

comment on column public.services.service_request_id is
  'One row per SR after accept; UNIQUE enforces Req. 23 (no COMPLETED SR without contracted service).';

comment on column public.services.accepted_proposal_id is
  'Winning proposal; UNIQUE prevents double materialization from duplicate accept.';

comment on column public.services.duration_unit is
  'Frozen from accepted proposal at accept time (hours | days).';

comment on column public.services.duration_value is
  'Frozen estimated duration from accepted proposal (hours count or inclusive calendar days).';

comment on column public.services.scheduled_start_date is
  'Agreed execution start date from client selected_slot (one of proposal_suggested_slots).';

comment on column public.services.scheduled_end_date is
  'Agreed inclusive end date when duration_unit = days; null when duration_unit = hours.';

comment on column public.services.scheduled_shift is
  'Agreed shift: morning, afternoon, or full_day (same semantics as proposal composer).';

comment on column public.services.agreed_slot is
  'Immutable snapshot of selected_slot at accept: { start_date, end_date?, shift } (ISO dates).';

create trigger services_updated_at
  before update on public.services
  for each row execute procedure public.set_updated_at();

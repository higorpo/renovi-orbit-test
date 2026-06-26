-- Payment Task 10: payment_attempts (design.md §3.6, §11.2).
-- Append-only charge attempt log; service_role only — no authenticated access.

create table public.payment_attempts (
  id uuid primary key default gen_random_uuid(),
  schedule_id uuid not null references public.payment_schedules (id) on delete restrict,
  attempt_number smallint not null,
  initiator public.payment_attempt_initiator not null,
  initiated_at timestamptz not null default now(),
  completed_at timestamptz,
  outcome public.payment_attempt_outcome,
  provider_response_summary jsonb,
  failure_code text,
  failure_reason text,
  charge_amount numeric(12, 2),
  gateway_latency_ms integer,
  created_at timestamptz not null default now(),
  constraint payment_attempts_schedule_attempt_initiator_unique
    unique (schedule_id, attempt_number, initiator)
);

comment on table public.payment_attempts is
  'Append-only charge attempt diagnostics per payment schedule. Not used for user-facing history.';

create index payment_attempts_schedule_attempt_number_idx
  on public.payment_attempts (schedule_id, attempt_number);

create trigger payment_attempts_deny_mutation
  before update or delete on public.payment_attempts
  for each row
  execute procedure public.payment_deny_row_mutation();

alter table public.payment_attempts enable row level security;

revoke all on table public.payment_attempts from public;
revoke all on table public.payment_attempts from anon;
revoke all on table public.payment_attempts from authenticated;

grant select, insert on table public.payment_attempts to service_role;

revoke update, delete on table public.payment_attempts from service_role;

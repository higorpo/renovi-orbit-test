-- Payment Task 2: extend contracted_service_status and payment lifecycle columns on contracted_services.
-- Scheduling anchor remains payment_service_execution_at() — no service_scheduled_at column.

alter type public.contracted_service_status add value if not exists 'CONFIRMED';
alter type public.contracted_service_status add value if not exists 'EXECUTED';

comment on type public.contracted_service_status is
  'Contracted service lifecycle: PENDING_PAYMENT after accept; CONFIRMED after charge capture; EXECUTED when provider marks done; COMPLETED after auto/manual completion; CANCELLED when terminated.';

alter table public.contracted_services
  add column if not exists cancellation_reason text,
  add column if not exists executed_at timestamptz,
  add column if not exists completed_at timestamptz,
  add column if not exists completed_by text;

alter table public.contracted_services
  drop constraint if exists contracted_services_completed_by_check;

alter table public.contracted_services
  add constraint contracted_services_completed_by_check
  check (completed_by is null or completed_by in ('client', 'system'))
  not valid;

alter table public.contracted_services
  validate constraint contracted_services_completed_by_check;

comment on column public.contracted_services.cancellation_reason is
  'Human-readable cancellation cause when status = CANCELLED (payment auto-cancel, client cancel, provider suspend, etc.).';

comment on column public.contracted_services.executed_at is
  'Timestamp when provider marked the service EXECUTED (payment_mark_service_executed RPC).';

comment on column public.contracted_services.completed_at is
  'Timestamp when status transitioned to COMPLETED (client confirm or auto-complete cron).';

comment on column public.contracted_services.completed_by is
  'Actor that closed the service: client (manual confirm) or system (auto-complete cron). NULL until COMPLETED.';

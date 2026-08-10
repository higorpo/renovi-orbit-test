-- Service dispute MVP Phase 1: enum IN_DISPUTE + audit columns on contracted_services.
-- Enum ADD VALUE must commit before RPCs can reference IN_DISPUTE (separate migration).

alter type public.contracted_service_status add value if not exists 'IN_DISPUTE';

comment on type public.contracted_service_status is
  'Contracted service lifecycle: PENDING_PAYMENT after accept; CONFIRMED after charge capture; EXECUTED when provider marks done; IN_DISPUTE when client opens a service dispute; COMPLETED after client/system/admin completion; CANCELLED when terminated.';

alter table public.contracted_services
  add column if not exists disputed_at timestamptz,
  add column if not exists disputed_by uuid,
  add column if not exists dispute_reason text,
  add column if not exists dispute_resolved_at timestamptz;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'contracted_services_disputed_by_fkey'
      and conrelid = 'public.contracted_services'::regclass
  ) then
    alter table public.contracted_services
      add constraint contracted_services_disputed_by_fkey
      foreign key (disputed_by) references public.profiles (id);
  end if;
end;
$$;

comment on column public.contracted_services.disputed_at is
  'Timestamp when the client opened a service dispute (EXECUTED → IN_DISPUTE).';

comment on column public.contracted_services.disputed_by is
  'Profile id of the client who opened the service dispute.';

comment on column public.contracted_services.dispute_reason is
  'Optional free-text reason supplied by the client when opening a service dispute.';

comment on column public.contracted_services.dispute_resolved_at is
  'Timestamp when an admin resolved the service dispute (IN_DISPUTE → COMPLETED).';

alter table public.contracted_services
  drop constraint if exists contracted_services_completed_by_check;

alter table public.contracted_services
  add constraint contracted_services_completed_by_check
  check (completed_by is null or completed_by in ('client', 'system', 'admin'))
  not valid;

alter table public.contracted_services
  validate constraint contracted_services_completed_by_check;

comment on column public.contracted_services.completed_by is
  'Actor that closed the service: client (manual confirm), system (auto-complete), or admin (dispute resolve). NULL until COMPLETED.';

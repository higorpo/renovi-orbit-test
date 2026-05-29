-- CNS Wave A — task 2: chats table and indexes (design §3.2).
-- Depends on 20260701100000_create_cns_enums.sql. RLS policies: task 72.

create table public.chats (
  id uuid primary key default gen_random_uuid(),
  service_request_id uuid not null references public.service_requests (id) on delete restrict,
  client_id uuid not null references public.profiles (id) on delete restrict,
  provider_id uuid not null references public.profiles (id) on delete restrict,
  status public.cns_conversation_status not null default 'ACTIVE',
  activated_at timestamptz not null default now(),
  inactivated_at timestamptz,
  inactivation_reason public.cns_inactivation_reason,
  closed_at timestamptz,
  closure_type public.cns_closure_type,
  closed_by_user_id uuid references public.profiles (id),
  closure_reason text check (closure_reason is null or char_length(trim(closure_reason)) <= 2000),
  last_interaction_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint chats_unique_pair unique (service_request_id, provider_id),
  constraint chats_closed_fields check (
    (status <> 'CLOSED')
    or (closed_at is not null and closure_type is not null)
  ),
  constraint chats_inactive_fields check (
    (status <> 'INACTIVE')
    or (inactivated_at is not null and inactivation_reason is not null)
  )
);

comment on table public.chats is
  'One chat per (service_request, provider). FSM: ACTIVE ↔ INACTIVE ↔ CLOSED (design §3.2).';

comment on column public.chats.service_request_id is
  'Parent SR; must stay OPEN for new messages until accept/cancel cascade.';

comment on column public.chats.last_interaction_at is
  'Drives inbox ordering and reciprocity cron candidate selection.';

create index chats_sr_status_idx
  on public.chats (service_request_id, status);

create index chats_last_interaction_idx
  on public.chats (last_interaction_at desc);

create index chats_provider_status_idx
  on public.chats (provider_id, status, last_interaction_at desc);

create index chats_client_status_idx
  on public.chats (client_id, status, last_interaction_at desc);

create index chats_reciprocity_poll_idx
  on public.chats (status, last_interaction_at)
  where status = 'ACTIVE';

comment on index public.chats_reciprocity_poll_idx is
  'Partial index for reciprocity job: ACTIVE rows ordered by last_interaction_at.';

create trigger chats_updated_at
  before update on public.chats
  for each row execute procedure public.set_updated_at();

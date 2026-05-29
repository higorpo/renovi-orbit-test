-- CNS Wave A — task 14: evolve provider_proposals for CNS versioning (design §3.6).
-- Adds chat-scoped versioning columns, migrates status text → proposal_status enum,
-- and enforces one PENDING proposal per conversation.

-- ---------------------------------------------------------------------------
-- 1. New CNS columns (idempotent)
-- ---------------------------------------------------------------------------

alter table public.provider_proposals
  add column if not exists chat_id uuid references public.chats (id),
  add column if not exists version integer not null default 1,
  add column if not exists revision_count integer not null default 0,
  add column if not exists revision_reason public.proposal_revision_reason,
  add column if not exists revision_notes text,
  add column if not exists submitted_at timestamptz,
  add column if not exists expired_at timestamptz,
  add column if not exists selected_slot jsonb;

alter table public.provider_proposals
  drop constraint if exists provider_proposals_revision_count_range;

alter table public.provider_proposals
  add constraint provider_proposals_revision_count_range
  check (revision_count >= 0 and revision_count <= 2);

alter table public.provider_proposals
  drop constraint if exists provider_proposals_revision_notes_length;

alter table public.provider_proposals
  add constraint provider_proposals_revision_notes_length
  check (revision_notes is null or char_length(trim(revision_notes)) <= 2000);

comment on column public.provider_proposals.chat_id is
  'CNS conversation this proposal version belongs to; set by submit_proposal.';

comment on column public.provider_proposals.version is
  'Monotonic version within a conversation (1 = initial submit).';

comment on column public.provider_proposals.revision_count is
  'Client revision rounds consumed on this conversation (max 2, Req. 10).';

comment on column public.provider_proposals.revision_reason is
  'Taxonomy when client requested revision (proposal_revision_reason enum).';

comment on column public.provider_proposals.revision_notes is
  'Optional free-text notes from client revision request (max 2000 chars).';

comment on column public.provider_proposals.submitted_at is
  'When proposal entered PENDING; SLA anchor for client response (24h default).';

comment on column public.provider_proposals.expired_at is
  'When a PENDING proposal was expired by cns_expire_pending_proposals.';

comment on column public.provider_proposals.selected_slot is
  'Client slot choice at accept; one object from proposal_suggested_slots.';

-- ---------------------------------------------------------------------------
-- 2. Drop legacy indexes / constraints / triggers before status type change
-- ---------------------------------------------------------------------------

drop index if exists public.provider_proposals_unique_active;
drop index if exists public.provider_proposals_pending_client_response_idx;
drop index if exists public.provider_proposals_active_request_idx;

drop trigger if exists provider_proposals_sync_client_response_deadline
  on public.provider_proposals;

drop trigger if exists provider_proposals_enforce_client_response_deadline
  on public.provider_proposals;

alter table public.provider_proposals
  drop constraint if exists provider_proposals_rejection_response_required;

alter table public.provider_proposals
  drop constraint if exists provider_proposals_status_check;

alter table public.provider_proposals
  alter column status drop default;

-- ---------------------------------------------------------------------------
-- 3. Migrate status text → proposal_status enum (submitted→PENDING, etc.)
-- ---------------------------------------------------------------------------

create or replace function public._migrate_legacy_proposal_status(p_status text)
returns public.proposal_status
language sql
immutable
as $$
  select case lower(btrim(p_status))
    when 'submitted' then 'PENDING'::public.proposal_status
    when 'accepted' then 'ACCEPTED'::public.proposal_status
    when 'rejected' then 'REJECTED'::public.proposal_status
    when 'withdrawn' then 'REVISED'::public.proposal_status
    else 'PENDING'::public.proposal_status
  end;
$$;

alter table public.provider_proposals rename column status to legacy_status;

alter table public.provider_proposals
  add column status public.proposal_status not null
  default 'PENDING'::public.proposal_status;

update public.provider_proposals pp
set status = public._migrate_legacy_proposal_status(pp.legacy_status);

alter table public.provider_proposals drop column legacy_status;

drop function public._migrate_legacy_proposal_status(text);

alter table public.provider_proposals
  alter column status set default 'PENDING'::public.proposal_status;

comment on column public.provider_proposals.status is
  'CNS proposal FSM: PENDING, ACCEPTED, REJECTED, EXPIRED, REVISION_REQUESTED, REVISED, REJECTED_AUTOMATICALLY.';

-- Backfill submitted_at for migrated PENDING rows (SLA anchor).
update public.provider_proposals pp
set submitted_at = coalesce(pp.submitted_at, pp.created_at)
where pp.status = 'PENDING'::public.proposal_status
  and pp.submitted_at is null;

-- ---------------------------------------------------------------------------
-- 4. Recreate constraints and indexes for CNS status semantics
-- ---------------------------------------------------------------------------

alter table public.provider_proposals
  add constraint provider_proposals_rejection_response_required
  check (
    status not in (
      'REJECTED'::public.proposal_status,
      'REJECTED_AUTOMATICALLY'::public.proposal_status
    )
    or nullif(trim(client_rejection_response), '') is not null
  );

-- One non-REVISED proposal per provider per request (legacy unique_active semantics).
create unique index provider_proposals_unique_active
  on public.provider_proposals (provider_id, service_request_id)
  where status <> 'REVISED'::public.proposal_status;

create index provider_proposals_conversation_status_idx
  on public.provider_proposals (chat_id, status);

-- Partial unique: at most one PENDING proposal per conversation.
create unique index provider_proposals_one_pending_per_conversation
  on public.provider_proposals (chat_id)
  where status = 'PENDING'::public.proposal_status
    and chat_id is not null;

create index provider_proposals_pending_client_response_idx
  on public.provider_proposals (submitted_at)
  where status = 'PENDING'::public.proposal_status;

create index provider_proposals_active_request_idx
  on public.provider_proposals (service_request_id)
  where status in (
    'PENDING'::public.proposal_status,
    'ACCEPTED'::public.proposal_status,
    'REVISION_REQUESTED'::public.proposal_status
  );

-- ---------------------------------------------------------------------------
-- 5. Update triggers / dependent functions to CNS status values
-- ---------------------------------------------------------------------------

create or replace function public.sync_provider_proposal_client_response_deadline()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.status = 'PENDING'::public.proposal_status then
    new.client_response_deadline_at := coalesce(
      new.submitted_at,
      new.created_at
    ) + interval '48 hours';
  else
    new.client_response_deadline_at := null;
  end if;
  return new;
end;
$$;

create trigger provider_proposals_sync_client_response_deadline
  before insert or update of status, created_at, submitted_at on public.provider_proposals
  for each row execute function public.sync_provider_proposal_client_response_deadline();

create or replace function public.enforce_provider_proposal_client_response_deadline()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if old.status = 'PENDING'::public.proposal_status
     and new.status = 'ACCEPTED'::public.proposal_status
     and coalesce(old.submitted_at, old.created_at) + interval '48 hours' < now() then
    raise exception 'Proposal response window (48 hours) has expired';
  end if;
  return new;
end;
$$;

create trigger provider_proposals_enforce_client_response_deadline
  before update of status on public.provider_proposals
  for each row execute function public.enforce_provider_proposal_client_response_deadline();

create or replace function public.expire_stale_provider_proposals()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_updated integer;
begin
  update public.provider_proposals
  set
    status = 'REJECTED'::public.proposal_status,
    client_rejection_response = 'Proposta recusada automaticamente: prazo de 48 horas para resposta expirado.'
  where status = 'PENDING'::public.proposal_status
    and coalesce(submitted_at, created_at) + interval '48 hours' < now();
  get diagnostics v_updated = row_count;
  return coalesce(v_updated, 0);
end;
$$;

create or replace function public.reject_submitted_proposals_on_service_request_cancel()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if old.status is distinct from new.status and new.status = 'CANCELLED' then
    update public.provider_proposals
    set
      status = 'REJECTED'::public.proposal_status,
      client_rejection_response = 'Proposta recusada automaticamente: pedido cancelado pelo cliente.'
    where service_request_id = new.id
      and status = 'PENDING'::public.proposal_status;
  end if;

  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- 6. Observability: report migrated row count
-- ---------------------------------------------------------------------------

do $obs$
declare
  v_total bigint;
  v_pending bigint;
begin
  select count(*) into v_total from public.provider_proposals;
  select count(*) into v_pending
  from public.provider_proposals
  where status = 'PENDING'::public.proposal_status;

  raise notice 'provider_proposals CNS evolution: % total rows, % PENDING after migration',
    v_total, v_pending;
end;
$obs$;

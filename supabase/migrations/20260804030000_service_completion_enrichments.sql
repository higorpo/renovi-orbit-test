-- Service completion Task 3: service_request_enrichments FSM table (design §3.2, ADR-0001).

create table public.service_request_enrichments (
  id uuid primary key default gen_random_uuid(),
  service_request_id uuid not null
    references public.service_requests (id) on delete cascade,
  status public.enrichment_status not null default 'PENDING',
  attempt_count integer not null default 0
    check (attempt_count >= 0),
  next_attempt_at timestamptz,
  -- Lease / ownership (Requirement 6)
  lease_owner text,
  lease_generation bigint not null default 0,
  locked_until timestamptz,
  -- Materialized checklist (immutable once set)
  checklist_schema jsonb,
  source public.checklist_source,
  materialized_at timestamptz,
  schema_version integer,
  last_error_code text,
  last_error_message text,
  -- Ops hold when template cascade fails after max AI attempts (stay PENDING, non-READY)
  ops_attention_at timestamptz,
  ops_attention_reason text,
  correlation_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint service_request_enrichments_sr_uk unique (service_request_id),
  -- Supports composite FK from enrichment_events (id, service_request_id).
  constraint service_request_enrichments_id_sr_uk unique (id, service_request_id),
  constraint enrichment_ready_requires_schema check (
    status <> 'READY'
    or (
      checklist_schema is not null
      and source is not null
      and materialized_at is not null
    )
  ),
  constraint enrichment_aborted_no_schema check (
    status <> 'ABORTED'
    or checklist_schema is null
  ),
  constraint enrichment_running_has_lease check (
    status <> 'RUNNING'
    or (
      lease_owner is not null
      and locked_until is not null
    )
  )
);

comment on table public.service_request_enrichments is
  'Publication readiness FSM 1:1 with service_requests. Matching MUST NOT bootstrap until READY.';

comment on column public.service_request_enrichments.lease_owner is
  'Worker instance id holding the RUNNING lease.';
comment on column public.service_request_enrichments.lease_generation is
  'Increments on every claim/reclaim; finalize CAS matches (lease_owner, lease_generation).';
comment on column public.service_request_enrichments.ops_attention_at is
  'When set, claim/sweeper MUST skip until enrichment_clear_ops_attention.';
comment on constraint service_request_enrichments_id_sr_uk on public.service_request_enrichments is
  'Composite uniqueness for enrichment_events FK (enrichment_id, service_request_id).';

-- Claim polling: due PENDING jobs excluding ops_attention holds (Task 63 / design §3.8).
create index idx_enrichments_claim_due
  on public.service_request_enrichments (next_attempt_at nulls first, created_at)
  where status = 'PENDING'::public.enrichment_status
    and ops_attention_at is null;

comment on index public.idx_enrichments_claim_due is
  'Partial index for enrichment_claim_batch: due PENDING rows excluding ops_attention holds.';

-- Lease reclaim: expired RUNNING
create index idx_enrichments_lease_expired
  on public.service_request_enrichments (locked_until)
  where status = 'RUNNING';

-- Bootstrap repair: READY without dispatch (sweeper join)
create index idx_enrichments_ready
  on public.service_request_enrichments (materialized_at)
  where status = 'READY';

-- Ops attention queue / metrics (Task 56 alerts)
create index idx_enrichments_ops_attention
  on public.service_request_enrichments (ops_attention_at)
  where ops_attention_at is not null;

comment on index public.idx_enrichments_ops_attention is
  'Partial index for ops_attention open-count metrics and CRITICAL alert sampling.';

create trigger service_request_enrichments_updated_at
  before update on public.service_request_enrichments
  for each row
  execute procedure public.set_updated_at();

-- ---------------------------------------------------------------------------
-- READY schema immutability (design §3.2 / Req 8)
-- When status is READY, refuse changes to checklist_schema, source,
-- materialized_at, or status leaving READY. Other columns remain updatable.
-- ---------------------------------------------------------------------------

create or replace function public.trg_enrichments_ready_schema_immutable()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if old.status = 'READY'::public.enrichment_status then
    if new.status is distinct from 'READY'::public.enrichment_status then
      raise exception 'READY_ENRICHMENT_IMMUTABLE'
        using errcode = '23514',
          message = 'enrichment status cannot leave READY',
          detail = 'checklist_schema, source, materialized_at, and READY status are immutable after materialization';
    end if;

    if new.checklist_schema is distinct from old.checklist_schema
      or new.source is distinct from old.source
      or new.materialized_at is distinct from old.materialized_at
    then
      raise exception 'READY_ENRICHMENT_IMMUTABLE'
        using errcode = '23514',
          message = 'READY enrichment schema fields are immutable',
          detail = 'checklist_schema, source, and materialized_at cannot change after READY';
    end if;
  end if;

  return new;
end;
$$;

comment on function public.trg_enrichments_ready_schema_immutable() is
  'BEFORE UPDATE: when old.status=READY, block schema/source/materialized_at changes and status leaving READY.';

create trigger enrichments_ready_schema_immutable
  before update on public.service_request_enrichments
  for each row
  execute function public.trg_enrichments_ready_schema_immutable();

comment on trigger enrichments_ready_schema_immutable on public.service_request_enrichments is
  'Enforces READY checklist immutability (design §3.2).';

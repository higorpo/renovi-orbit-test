-- Service completion Task 6: contracted_service_completion_evidence (design §3.5, decision 30).

create table public.contracted_service_completion_evidence (
  id uuid primary key default gen_random_uuid(),
  contracted_service_id uuid not null,
  enrichment_id uuid
    references public.service_request_enrichments (id),
  checklist_schema_hash text,
  phase public.completion_evidence_phase not null default 'draft',
  responses jsonb not null default '{}'::jsonb,
  draft_version integer not null default 1
    check (draft_version >= 1),
  executed_late boolean,
  responses_hash text,
  frozen_at timestamptz,
  idempotency_key text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint completion_evidence_cs_uk unique (contracted_service_id),
  -- RESTRICT: forensic package must not vanish if CS row is hard-deleted.
  constraint completion_evidence_cs_fk
    foreign key (contracted_service_id)
    references public.contracted_services (id)
    on delete restrict,
  constraint completion_evidence_frozen_integrity check (
    phase <> 'frozen'
    or (
      frozen_at is not null
      and responses_hash is not null
      and executed_late is not null
    )
  ),
  constraint completion_evidence_draft_no_late check (
    phase <> 'draft' or executed_late is null
  )
);

comment on table public.contracted_service_completion_evidence is
  '1:1 completion evidence package per contracted service: draft while CONFIRMED, frozen on EXECUTED.';
comment on column public.contracted_service_completion_evidence.responses_hash is
  'sha256 of canonical JSON responses; set only at freeze (mark-executed).';
comment on column public.contracted_service_completion_evidence.executed_late is
  'BRT late flag set only when freezing; MUST be null while draft.';
comment on column public.contracted_service_completion_evidence.idempotency_key is
  'Last successful EXECUTED submit key for replay.';
comment on constraint completion_evidence_cs_fk
  on public.contracted_service_completion_evidence is
  'ON DELETE RESTRICT — preserve forensic evidence if CS hard-delete is attempted.';

create unique index uq_completion_evidence_idempotency
  on public.contracted_service_completion_evidence (idempotency_key)
  where idempotency_key is not null;

-- Note: low-value idx_completion_evidence_phase intentionally omitted (low selectivity).

create trigger contracted_service_completion_evidence_updated_at
  before update on public.contracted_service_completion_evidence
  for each row
  execute procedure public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Enrichment SR must match contracted_services.service_request_id when set
-- ---------------------------------------------------------------------------

create or replace function public.trg_completion_evidence_enrichment_sr_match()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  v_enrichment_sr uuid;
  v_cs_sr uuid;
begin
  if new.enrichment_id is null then
    return new;
  end if;

  select e.service_request_id
  into v_enrichment_sr
  from public.service_request_enrichments e
  where e.id = new.enrichment_id;

  if v_enrichment_sr is null then
    raise exception 'EVIDENCE_ENRICHMENT_NOT_FOUND'
      using errcode = '23503',
        message = 'enrichment_id does not exist';
  end if;

  select cs.service_request_id
  into v_cs_sr
  from public.contracted_services cs
  where cs.id = new.contracted_service_id;

  if v_cs_sr is null then
    raise exception 'EVIDENCE_CONTRACTED_SERVICE_NOT_FOUND'
      using errcode = '23503',
        message = 'contracted_service_id does not exist';
  end if;

  if v_enrichment_sr is distinct from v_cs_sr then
    raise exception 'EVIDENCE_ENRICHMENT_SR_MISMATCH'
      using errcode = '23514',
        message = 'enrichment service_request_id must match contracted_services.service_request_id',
        detail = format(
          'enrichment_sr=%s cs_sr=%s',
          v_enrichment_sr,
          v_cs_sr
        );
  end if;

  return new;
end;
$$;

comment on function public.trg_completion_evidence_enrichment_sr_match() is
  'BEFORE INSERT/UPDATE: when enrichment_id is set, enrichment.SR must equal CS.SR.';

create trigger completion_evidence_enrichment_sr_match
  before insert or update of enrichment_id, contracted_service_id
  on public.contracted_service_completion_evidence
  for each row
  execute function public.trg_completion_evidence_enrichment_sr_match();

-- ---------------------------------------------------------------------------
-- Frozen evidence immutability (design §3.5 / Req 12)
-- ---------------------------------------------------------------------------

create or replace function public.trg_completion_evidence_frozen_immutable()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if tg_op = 'DELETE' then
    if old.phase = 'frozen'::public.completion_evidence_phase then
      raise exception 'FROZEN_EVIDENCE_IMMUTABLE'
        using errcode = '23514',
          message = 'frozen completion evidence cannot be deleted';
    end if;
    return old;
  end if;

  -- UPDATE
  if old.phase = 'frozen'::public.completion_evidence_phase then
    if new.phase is distinct from old.phase
      or new.responses is distinct from old.responses
      or new.responses_hash is distinct from old.responses_hash
      or new.frozen_at is distinct from old.frozen_at
      or new.executed_late is distinct from old.executed_late
      or new.checklist_schema_hash is distinct from old.checklist_schema_hash
      or new.enrichment_id is distinct from old.enrichment_id
      or new.contracted_service_id is distinct from old.contracted_service_id
      or new.draft_version is distinct from old.draft_version
      or new.idempotency_key is distinct from old.idempotency_key
    then
      raise exception 'FROZEN_EVIDENCE_IMMUTABLE'
        using errcode = '23514',
          message = 'frozen completion evidence critical columns are immutable';
    end if;
  end if;

  return new;
end;
$$;

comment on function public.trg_completion_evidence_frozen_immutable() is
  'BEFORE UPDATE/DELETE: frozen rows cannot change critical columns or be deleted.';

create trigger completion_evidence_frozen_immutable
  before update or delete on public.contracted_service_completion_evidence
  for each row
  execute function public.trg_completion_evidence_frozen_immutable();

comment on trigger completion_evidence_frozen_immutable
  on public.contracted_service_completion_evidence is
  'Enforces frozen package immutability (design §3.5).';

-- ---------------------------------------------------------------------------
-- EXECUTED/COMPLETED requires frozen evidence (deferred constraint trigger)
--
-- Deferred so mark-executed can INSERT/UPDATE evidence to frozen and flip CS
-- status to EXECUTED in the same transaction. Seeds and pgTAP fixtures that set
-- EXECUTED/COMPLETED MUST create frozen evidence in the same TX (or before commit).
-- ---------------------------------------------------------------------------

create or replace function public.trg_contracted_services_require_frozen_evidence()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.status in (
    'EXECUTED'::public.contracted_service_status,
    'COMPLETED'::public.contracted_service_status
  ) then
    if not exists (
      select 1
      from public.contracted_service_completion_evidence e
      where e.contracted_service_id = new.id
        and e.phase = 'frozen'::public.completion_evidence_phase
    ) then
      raise exception 'EXECUTED_REQUIRES_FROZEN_EVIDENCE'
        using errcode = '23514',
          message = 'EXECUTED/COMPLETED contracted_services require frozen completion evidence',
          detail = 'Create frozen evidence in the same transaction before commit (mark-executed, seeds, pgTAP).';
    end if;
  end if;

  return null;
end;
$$;

comment on function public.trg_contracted_services_require_frozen_evidence() is
  'Deferred AFTER INSERT/UPDATE OF status: EXECUTED/COMPLETED require a frozen evidence row. Fixtures must create evidence in-TX.';

create constraint trigger contracted_services_require_frozen_evidence
  after insert or update of status
  on public.contracted_services
  deferrable initially deferred
  for each row
  when (
    new.status = 'EXECUTED'::public.contracted_service_status
    or new.status = 'COMPLETED'::public.contracted_service_status
  )
  execute function public.trg_contracted_services_require_frozen_evidence();

comment on trigger contracted_services_require_frozen_evidence
  on public.contracted_services is
  'Deferred: EXECUTED/COMPLETED require frozen completion evidence (dev reset + tests must insert evidence).';

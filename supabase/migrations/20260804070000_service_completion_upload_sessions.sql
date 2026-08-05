-- Service completion Task 7: completion_evidence_upload_sessions (design §3.6, decision 21).
--
-- Storage bucket provisioning (Task 10 / Task 79):
--   Dedicated bucket id/name: 'completion-evidence'
--   MUST NOT reuse 'service-requests', 'chat-media', or 'provider-kyc-documents'.
--   Path layout (planned): {contracted_service_id}/{session_id}/{filename}
--   This migration does NOT create the bucket; Task 10 scaffolds Storage + policies.

create table public.completion_evidence_upload_sessions (
  id uuid primary key default gen_random_uuid(),
  -- CASCADE OK: sessions are draft/ephemeral; product rarely hard-deletes CS.
  contracted_service_id uuid not null
    references public.contracted_services (id) on delete cascade,
  provider_id uuid not null references public.profiles (id),
  criterion_block_id text not null,
  status public.completion_upload_session_status not null default 'open',
  storage_bucket text not null
    check (storage_bucket = 'completion-evidence'),
  storage_prefix text not null,
  max_files integer not null default 5
    check (max_files >= 1),
  expires_at timestamptz not null,
  idempotency_key text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint upload_session_idem_uk unique (idempotency_key)
);

comment on table public.completion_evidence_upload_sessions is
  'KYC/chat-pattern upload sessions for completion_criterion evidence photos; orphan janitor targets open+expired.';
comment on column public.completion_evidence_upload_sessions.criterion_block_id is
  'Dynamic Form block id within the enrichment checklist_schema.';
comment on column public.completion_evidence_upload_sessions.storage_bucket is
  'Dedicated completion-evidence bucket (Tasks 10/79); never request-quote/chat/KYC buckets.';
comment on column public.completion_evidence_upload_sessions.storage_prefix is
  'Object prefix: contracted_service_id/session_id/...';
comment on column public.completion_evidence_upload_sessions.max_files is
  'Default 5 from checklist_evidence_max platform constant.';

create index idx_upload_sessions_orphan
  on public.completion_evidence_upload_sessions (expires_at)
  where status = 'open';

comment on index public.idx_upload_sessions_orphan is
  'Supports orphan janitor: open sessions past expires_at.';

create index idx_upload_sessions_cs
  on public.completion_evidence_upload_sessions (contracted_service_id);

comment on index public.idx_upload_sessions_cs is
  'Lookup sessions by contracted_service_id.';

create trigger completion_evidence_upload_sessions_updated_at
  before update on public.completion_evidence_upload_sessions
  for each row
  execute procedure public.set_updated_at();

-- ---------------------------------------------------------------------------
-- provider_id must match contracted_services.provider_id
-- ---------------------------------------------------------------------------

create or replace function public.trg_upload_sessions_provider_matches_cs()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  v_provider_id uuid;
begin
  select cs.provider_id
  into v_provider_id
  from public.contracted_services cs
  where cs.id = new.contracted_service_id;

  if v_provider_id is null then
    raise exception 'UPLOAD_SESSION_CS_NOT_FOUND'
      using errcode = '23503',
        message = 'contracted_service_id does not exist';
  end if;

  if v_provider_id is distinct from new.provider_id then
    raise exception 'UPLOAD_SESSION_PROVIDER_MISMATCH'
      using errcode = '23514',
        message = 'provider_id must match contracted_services.provider_id',
        detail = format(
          'session_provider=%s cs_provider=%s',
          new.provider_id,
          v_provider_id
        );
  end if;

  return new;
end;
$$;

comment on function public.trg_upload_sessions_provider_matches_cs() is
  'BEFORE INSERT/UPDATE: upload session provider_id must equal CS.provider_id.';

create trigger upload_sessions_provider_matches_cs
  before insert or update of provider_id, contracted_service_id
  on public.completion_evidence_upload_sessions
  for each row
  execute function public.trg_upload_sessions_provider_matches_cs();

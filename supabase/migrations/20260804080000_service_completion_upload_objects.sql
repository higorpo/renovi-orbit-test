-- Service completion Task 8: completion_evidence_upload_objects registry (design §3.6).

create table public.completion_evidence_upload_objects (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null
    references public.completion_evidence_upload_sessions (id) on delete cascade,
  storage_path text not null,
  content_checksum text,
  byte_size integer check (byte_size is null or byte_size > 0),
  registered_at timestamptz not null default now(),
  referenced_in_responses boolean not null default false,
  constraint upload_object_path_uk unique (storage_path)
);

comment on table public.completion_evidence_upload_objects is
  'Registered Storage objects for completion evidence sessions; janitor deletes only unreferenced paths.';
comment on column public.completion_evidence_upload_objects.storage_path is
  'Object path within the completion-evidence bucket; UNIQUE for idempotent register.';
comment on column public.completion_evidence_upload_objects.referenced_in_responses is
  'True when path is bound into draft/frozen responses; janitor MUST NOT delete when true.';
comment on column public.completion_evidence_upload_objects.content_checksum is
  'Optional content checksum for audit after signed upload.';

-- Note: idx_upload_objects_unref omitted — superseded by idx_upload_objects_janitor_claim
-- in 20260804490000 (registered_at WHERE unreferenced AND janitor_claimed_at IS NULL).

create index idx_upload_objects_session
  on public.completion_evidence_upload_objects (session_id);

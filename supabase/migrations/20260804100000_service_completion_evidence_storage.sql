-- Service completion Task 10: dedicated completion-evidence Storage bucket + policy scaffolding
-- (design §11.4 Storage Safety; decision 21).
--
-- Path layout (stable, unique keys — no silent overwrite):
--   {contracted_service_id}/{session_id}/{uuid_filename}
-- storage_bucket column on completion_evidence_upload_sessions MUST be 'completion-evidence'.
-- MUST NOT reuse: service-requests | chat-media | provider-kyc-documents | provider-portfolio-images
--
-- Signed uploads: provider INSERT under own open session prefix; no authenticated UPDATE
-- (immutability — unique paths). DELETE is service_role/janitor only (Tasks 57–59, 79).
-- Direct client uploads under open session prefix (KYC Option A / RLS; Req 20 AC7).
-- No Edge body proxy; Task 34 uses storage.upload + register RPC.
--
-- =============================================================================
-- GRANT / REVOKE matrix scaffolding (design §11.2.2) — apply with each RPC task:
--   enrichment_claim_batch / enrichment_finalize_ready / enrichment_* ops
--     → REVOKE ALL FROM public, anon, authenticated; GRANT EXECUTE TO service_role
--   service_completion_mark_executed / confirm_with_rating / save_evidence_draft
--     → GRANT EXECUTE TO authenticated (body checks ownership)
--   service_completion_auto_complete_executed / orphan janitor claim
--     → service_role only
--   submit_service_rating / update_service_rating
--     → GRANT EXECUTE TO authenticated (post grant-hygiene restore)
-- Full EXECUTE grants land with the RPC migrations that create those functions.
-- =============================================================================

insert into storage.buckets (id, name, public)
values ('completion-evidence', 'completion-evidence', false)
on conflict (id) do update set
  name = excluded.name,
  public = excluded.public;

comment on table public.completion_evidence_upload_sessions is
  'KYC/chat-pattern upload sessions for completion_criterion evidence photos; orphan janitor targets open+expired. Storage bucket: completion-evidence (design §11.4).';

-- Path helpers: {cs_id}/{session_id}/…
create or replace function public.service_completion_evidence_storage_path_owned(
  p_storage_path text
)
returns boolean
language plpgsql
stable
security definer
set search_path = public, storage
as $$
declare
  v_path text := trim(coalesce(p_storage_path, ''));
  v_parts text[];
  v_cs_id uuid;
  v_session_id uuid;
begin
  if v_path = '' or v_path ~ '^https?://' or position(chr(10) in v_path) > 0 then
    return false;
  end if;

  v_parts := storage.foldername(v_path);
  if coalesce(array_length(v_parts, 1), 0) < 2 then
    return false;
  end if;

  begin
    v_cs_id := v_parts[1]::uuid;
    v_session_id := v_parts[2]::uuid;
  exception
    when invalid_text_representation then
      return false;
  end;

  return exists (
    select 1
    from public.completion_evidence_upload_sessions s
    join public.contracted_services cs on cs.id = s.contracted_service_id
    where s.id = v_session_id
      and s.contracted_service_id = v_cs_id
      and s.provider_id = (select auth.uid())
      and cs.provider_id = (select auth.uid())
  );
end;
$$;

comment on function public.service_completion_evidence_storage_path_owned(text) is
  'True when storage path is under {cs_id}/{session_id}/… owned by auth.uid() as contracted provider (design §11.4).';

-- Client may createSignedUrl for evidence under their CS once the package is frozen
-- (design §11.1: read frozen responses = client + provider). Draft paths stay provider-only.
create or replace function public.service_completion_evidence_storage_path_client_readable(
  p_storage_path text
)
returns boolean
language plpgsql
stable
security definer
set search_path = public, storage
as $$
declare
  v_path text := trim(coalesce(p_storage_path, ''));
  v_parts text[];
  v_cs_id uuid;
begin
  if v_path = '' or v_path ~ '^https?://' or position(chr(10) in v_path) > 0 then
    return false;
  end if;

  v_parts := storage.foldername(v_path);
  if coalesce(array_length(v_parts, 1), 0) < 1 then
    return false;
  end if;

  begin
    v_cs_id := v_parts[1]::uuid;
  exception
    when invalid_text_representation then
      return false;
  end;

  return exists (
    select 1
    from public.contracted_services cs
    join public.contracted_service_completion_evidence ev
      on ev.contracted_service_id = cs.id
    where cs.id = v_cs_id
      and cs.client_id = (select auth.uid())
      and ev.phase = 'frozen'::public.completion_evidence_phase
  );
end;
$$;

comment on function public.service_completion_evidence_storage_path_client_readable(text) is
  'True when auth.uid() is the CS client and evidence is frozen — allows signed display URLs (design §11.1).';

create or replace function public.service_completion_evidence_storage_upload_allowed(
  p_storage_path text
)
returns boolean
language plpgsql
stable
security definer
set search_path = public, storage
as $$
declare
  v_path text := trim(coalesce(p_storage_path, ''));
  v_parts text[];
  v_cs_id uuid;
  v_session_id uuid;
begin
  if v_path = '' then
    return false;
  end if;

  -- foldername excludes the filename: {cs_id}/{session_id}/{uuid_filename} → 2 parts.
  v_parts := storage.foldername(v_path);
  if coalesce(array_length(v_parts, 1), 0) < 2 then
    return false;
  end if;

  begin
    v_cs_id := v_parts[1]::uuid;
    v_session_id := v_parts[2]::uuid;
  exception
    when invalid_text_representation then
      return false;
  end;

  return exists (
    select 1
    from public.completion_evidence_upload_sessions s
    join public.contracted_services cs on cs.id = s.contracted_service_id
    where s.id = v_session_id
      and s.contracted_service_id = v_cs_id
      and s.provider_id = (select auth.uid())
      and s.status = 'open'::public.completion_upload_session_status
      and s.expires_at > now()
      and cs.provider_id = (select auth.uid())
      and cs.status = 'CONFIRMED'::public.contracted_service_status
      and (
        select count(*)::int
        from storage.objects so
        where so.bucket_id = 'completion-evidence'
          and so.name like (s.storage_prefix || '%')
      ) < s.max_files
  );
end;
$$;

comment on function public.service_completion_evidence_storage_upload_allowed(text) is
  'True when auth.uid() may INSERT into completion-evidence under an open, non-expired owned session on a CONFIRMED CS with object count under session max_files.';

revoke all on function public.service_completion_evidence_storage_path_owned(text) from public;
revoke all on function public.service_completion_evidence_storage_path_client_readable(text) from public;
revoke all on function public.service_completion_evidence_storage_upload_allowed(text) from public;
grant execute on function public.service_completion_evidence_storage_path_owned(text) to authenticated, service_role;
grant execute on function public.service_completion_evidence_storage_path_client_readable(text) to authenticated, service_role;
grant execute on function public.service_completion_evidence_storage_upload_allowed(text) to authenticated, service_role;

drop policy if exists storage_objects_completion_evidence_select on storage.objects;
drop policy if exists storage_objects_completion_evidence_insert on storage.objects;
drop policy if exists storage_objects_completion_evidence_service_role on storage.objects;

-- Provider SELECT own-prefix; client SELECT under own CS once evidence is frozen (signed URLs)
create policy storage_objects_completion_evidence_select
  on storage.objects
  for select
  to authenticated
  using (
    bucket_id = 'completion-evidence'
    and (
      public.service_completion_evidence_storage_path_owned(name)
      or public.service_completion_evidence_storage_path_client_readable(name)
      or (select public.is_platform_admin())
    )
  );

-- Provider INSERT only under open session prefix; no UPDATE policy ⇒ no silent overwrite
create policy storage_objects_completion_evidence_insert
  on storage.objects
  for insert
  to authenticated
  with check (
    bucket_id = 'completion-evidence'
    and (select public.is_provider())
    and public.service_completion_evidence_storage_upload_allowed(name)
  );

-- service_role: janitor deletes + admin ops (Task 57–59 / 79)
create policy storage_objects_completion_evidence_service_role
  on storage.objects
  for all
  to service_role
  using (bucket_id = 'completion-evidence')
  with check (bucket_id = 'completion-evidence');

-- Note: do not COMMENT ON POLICY for storage.objects — local Supabase roles are not
-- owner of storage.objects (SQLSTATE 42501). Policy names document intent above.

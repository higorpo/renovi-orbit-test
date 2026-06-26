-- Payment Task 20a: private Storage bucket for provider KYC documents (design.md §3.11).
-- Object layout: providers/{provider_id}/kyc/{document_key}/{filename}
-- document_key: identity | address-proof | corporate-charter | legal-rep-id

insert into storage.buckets (id, name, public)
values ('provider-kyc-documents', 'provider-kyc-documents', false)
on conflict (id) do update set
  name = excluded.name,
  public = excluded.public;

create or replace function public.payment_provider_kyc_document_key_valid(p_document_key text)
returns boolean
language sql
immutable
parallel safe
set search_path = public
as $$
  select p_document_key in (
    'identity',
    'address-proof',
    'corporate-charter',
    'legal-rep-id'
  );
$$;

comment on function public.payment_provider_kyc_document_key_valid(text) is
  'Allowed KYC document_key segment under providers/{id}/kyc/{document_key}/.';

create or replace function public.payment_provider_kyc_storage_mutations_allowed()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    not exists (
      select 1
      from public.provider_gateway_accounts pga
      where pga.provider_id = (select auth.uid())
    )
    or exists (
      select 1
      from public.provider_gateway_accounts pga
      where pga.provider_id = (select auth.uid())
        and pga.onboarding_status in (
          'PENDING_DOCUMENTS'::public.payment_provider_onboarding_status,
          'REJECTED'::public.payment_provider_onboarding_status
        )
    );
$$;

comment on function public.payment_provider_kyc_storage_mutations_allowed() is
  'True when provider may INSERT/UPDATE/DELETE KYC storage objects (PENDING_DOCUMENTS or REJECTED only).';

revoke all on function public.payment_provider_kyc_storage_mutations_allowed() from public;
grant execute on function public.payment_provider_kyc_storage_mutations_allowed() to authenticated;
grant execute on function public.payment_provider_kyc_storage_mutations_allowed() to service_role;

create or replace function public.payment_provider_kyc_storage_path_valid(
  p_provider_id uuid,
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
begin
  if p_provider_id is null or v_path = '' then
    return false;
  end if;

  if v_path ~ '^https?://' or position(chr(10) in v_path) > 0 then
    return false;
  end if;

  v_parts := storage.foldername(v_path);

  if coalesce(array_length(v_parts, 1), 0) < 4 then
    return false;
  end if;

  if v_parts[1] <> 'providers'
    or v_parts[2] <> p_provider_id::text
    or v_parts[3] <> 'kyc' then
    return false;
  end if;

  if not public.payment_provider_kyc_document_key_valid(v_parts[4]) then
    return false;
  end if;

  return exists (
    select 1
    from storage.objects o
    where o.bucket_id = 'provider-kyc-documents'
      and o.name = v_path
  );
end;
$$;

comment on function public.payment_provider_kyc_storage_path_valid(uuid, text) is
  'True when path matches providers/{id}/kyc/{document_key}/… and object exists in provider-kyc-documents.';

create or replace function public.payment_assert_provider_kyc_storage_path(
  p_provider_id uuid,
  p_storage_path text,
  p_document_key text
)
returns void
language plpgsql
stable
security definer
set search_path = public, storage
as $$
declare
  v_path text := trim(coalesce(p_storage_path, ''));
  v_parts text[];
begin
  if v_path = '' then
    raise exception 'KYC_STORAGE_PATH_REQUIRED'
      using errcode = '22023';
  end if;

  v_parts := storage.foldername(v_path);

  if coalesce(v_parts[4], '') <> p_document_key then
    raise exception 'KYC_STORAGE_PATH_INVALID'
      using
        errcode = '22023',
        detail = jsonb_build_object(
          'code', 'KYC_STORAGE_PATH_INVALID',
          'expected_document_key', p_document_key
        )::text;
  end if;

  if not public.payment_provider_kyc_storage_path_valid(p_provider_id, v_path) then
    raise exception 'KYC_STORAGE_OBJECT_NOT_FOUND'
      using
        errcode = 'P0002',
        detail = jsonb_build_object(
          'code', 'KYC_STORAGE_OBJECT_NOT_FOUND',
          'document_key', p_document_key
        )::text;
  end if;
end;
$$;

comment on function public.payment_assert_provider_kyc_storage_path(uuid, text, text) is
  'Raises when a KYC storage path is missing, malformed, or not owned by provider in provider-kyc-documents.';

revoke all on function public.payment_provider_kyc_document_key_valid(text) from public;
revoke all on function public.payment_provider_kyc_storage_path_valid(uuid, text) from public;
revoke all on function public.payment_assert_provider_kyc_storage_path(uuid, text, text) from public;

grant execute on function public.payment_provider_kyc_document_key_valid(text) to service_role;
grant execute on function public.payment_provider_kyc_storage_path_valid(uuid, text) to service_role;
grant execute on function public.payment_assert_provider_kyc_storage_path(uuid, text, text) to service_role;

drop policy if exists storage_objects_provider_kyc_documents_select on storage.objects;
drop policy if exists storage_objects_provider_kyc_documents_insert on storage.objects;
drop policy if exists storage_objects_provider_kyc_documents_update on storage.objects;
drop policy if exists storage_objects_provider_kyc_documents_delete on storage.objects;
drop policy if exists storage_objects_provider_kyc_documents_service_role on storage.objects;

create policy storage_objects_provider_kyc_documents_select
  on storage.objects
  for select
  to authenticated
  using (
    bucket_id = 'provider-kyc-documents'
    and (
      (
        (storage.foldername(name))[1] = 'providers'
        and (storage.foldername(name))[2] = (select auth.uid())::text
      )
      or (select public.is_platform_admin())
    )
  );

create policy storage_objects_provider_kyc_documents_insert
  on storage.objects
  for insert
  to authenticated
  with check (
    bucket_id = 'provider-kyc-documents'
    and (select public.is_provider())
    and (storage.foldername(name))[1] = 'providers'
    and (storage.foldername(name))[2] = (select auth.uid())::text
    and (storage.foldername(name))[3] = 'kyc'
    and public.payment_provider_kyc_document_key_valid((storage.foldername(name))[4])
    and public.payment_provider_kyc_storage_mutations_allowed()
  );

create policy storage_objects_provider_kyc_documents_update
  on storage.objects
  for update
  to authenticated
  using (
    bucket_id = 'provider-kyc-documents'
    and (select public.is_provider())
    and (storage.foldername(name))[1] = 'providers'
    and (storage.foldername(name))[2] = (select auth.uid())::text
    and (storage.foldername(name))[3] = 'kyc'
    and public.payment_provider_kyc_document_key_valid((storage.foldername(name))[4])
    and public.payment_provider_kyc_storage_mutations_allowed()
  )
  with check (
    bucket_id = 'provider-kyc-documents'
    and (select public.is_provider())
    and (storage.foldername(name))[1] = 'providers'
    and (storage.foldername(name))[2] = (select auth.uid())::text
    and (storage.foldername(name))[3] = 'kyc'
    and public.payment_provider_kyc_document_key_valid((storage.foldername(name))[4])
    and public.payment_provider_kyc_storage_mutations_allowed()
  );

create policy storage_objects_provider_kyc_documents_delete
  on storage.objects
  for delete
  to authenticated
  using (
    bucket_id = 'provider-kyc-documents'
    and (select public.is_provider())
    and (storage.foldername(name))[1] = 'providers'
    and (storage.foldername(name))[2] = (select auth.uid())::text
    and public.payment_provider_kyc_storage_mutations_allowed()
  );

create policy storage_objects_provider_kyc_documents_service_role
  on storage.objects
  for all
  to service_role
  using (bucket_id = 'provider-kyc-documents')
  with check (bucket_id = 'provider-kyc-documents');

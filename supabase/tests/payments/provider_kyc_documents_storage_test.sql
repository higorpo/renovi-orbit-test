-- pgTAP: provider KYC documents storage bucket and path validators (design.md §3.11).

begin;

select plan(6);

select ok(
  exists (
    select 1
    from storage.buckets b
    where b.id = 'provider-kyc-documents'
      and b.public = false
  ),
  'provider-kyc-documents bucket exists and is private'
);

select ok(
  public.payment_provider_kyc_document_key_valid('identity')
    and public.payment_provider_kyc_document_key_valid('address-proof')
    and not public.payment_provider_kyc_document_key_valid('public-url'),
  'payment_provider_kyc_document_key_valid accepts known keys'
);

select ok(
  not public.payment_provider_kyc_storage_path_valid(
    '5d09e025-20a2-4842-aeef-324d42a431e1'::uuid,
    'https://example.com/leak.pdf'
  ),
  'rejects http URLs as storage paths'
);

insert into storage.objects (id, bucket_id, name, owner, metadata)
values (
  gen_random_uuid(),
  'provider-kyc-documents',
  'providers/5d09e025-20a2-4842-aeef-324d42a431e1/kyc/identity/test.pdf',
  '5d09e025-20a2-4842-aeef-324d42a431e1'::uuid,
  '{}'::jsonb
);

select ok(
  public.payment_provider_kyc_storage_path_valid(
    '5d09e025-20a2-4842-aeef-324d42a431e1'::uuid,
    'providers/5d09e025-20a2-4842-aeef-324d42a431e1/kyc/identity/test.pdf'
  ),
  'accepts owned object path in provider-kyc-documents'
);

select ok(
  exists (
    select 1
    from pg_policies
    where schemaname = 'storage'
      and tablename = 'objects'
      and policyname = 'storage_objects_provider_kyc_documents_select'
  ),
  'provider KYC storage select policy exists'
);

select ok(
  exists (
    select 1
    from pg_policies
    where schemaname = 'storage'
      and tablename = 'objects'
      and policyname = 'storage_objects_provider_kyc_documents_service_role'
  ),
  'service_role storage policy exists for KYC email attachments'
);

select finish();

rollback;

-- Payment Task 15: extend provider_profiles_private with KYC/banking/document columns (design.md §3.11).
-- RLS unchanged (provider_profiles_private_* policies). Phone for KYC uses profiles.phone.

alter table public.provider_profiles_private
  add column if not exists legal_representative_phone text,
  add column if not exists bank_institution_code text,
  add column if not exists bank_branch text,
  add column if not exists bank_account text,
  add column if not exists pix_key text,
  add column if not exists identity_doc_storage_path text,
  add column if not exists address_proof_storage_path text,
  add column if not exists corporate_charter_storage_path text,
  add column if not exists legal_rep_doc_storage_path text;

comment on column public.provider_profiles_private.legal_representative_phone is
  'PJ legal representative phone; provider mobile remains on profiles.phone.';

comment on column public.provider_profiles_private.bank_institution_code is
  'Bank institution code (COMPE) for NetCred payout setup. Plaintext PII — service_role/onboarding RPCs only; no field-level encryption at MVP.';

comment on column public.provider_profiles_private.bank_branch is
  'Bank branch (agency) for NetCred payout setup. Plaintext PII — service_role/onboarding RPCs only.';

comment on column public.provider_profiles_private.bank_account is
  'Bank account number for NetCred payout setup. Plaintext PII — service_role/onboarding RPCs only.';

comment on column public.provider_profiles_private.pix_key is
  'Optional PIX key submitted with KYC. Plaintext PII — service_role/onboarding RPCs only.';

comment on column public.provider_profiles_private.identity_doc_storage_path is
  'Private storage path in provider-kyc-documents (providers/{id}/kyc/identity/…). For PJ, typically the same legal-rep-id object.';

comment on column public.provider_profiles_private.address_proof_storage_path is
  'Private storage path (providers/{id}/kyc/address-proof/…). PF: personal address; PJ: company address.';

comment on column public.provider_profiles_private.corporate_charter_storage_path is
  'Private storage path for corporate charter (PJ only).';

comment on column public.provider_profiles_private.legal_rep_doc_storage_path is
  'Private storage path for legal representative ID (PJ only). For PJ, identity_doc_storage_path typically points to the same legal-rep-id object.';

-- Bucket + RLS: migration 20260801185000_create_provider_kyc_documents_storage.sql

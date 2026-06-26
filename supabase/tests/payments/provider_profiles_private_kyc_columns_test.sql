-- pgTAP: payment Task 15 — provider_profiles_private KYC column extensions (design.md §3.11).

begin;

select plan(9);

select ok(
  exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'provider_profiles_private'
      and column_name = 'legal_representative_phone'
  ),
  'legal_representative_phone column exists'
);

select ok(
  exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'provider_profiles_private'
      and column_name = 'bank_institution_code'
  ),
  'bank_institution_code column exists'
);

select ok(
  exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'provider_profiles_private'
      and column_name = 'pix_key'
  ),
  'pix_key column exists'
);

select ok(
  exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'provider_profiles_private'
      and column_name = 'identity_doc_storage_path'
  ),
  'identity_doc_storage_path column exists'
);

select ok(
  exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'provider_profiles_private'
      and column_name = 'corporate_charter_storage_path'
  ),
  'corporate_charter_storage_path column exists'
);

select ok(
  exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'provider_profiles_private'
      and column_name = 'legal_rep_doc_storage_path'
  ),
  'legal_rep_doc_storage_path column exists'
);

select ok(
  (
    select c.relrowsecurity
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public'
      and c.relname = 'provider_profiles_private'
  ),
  'provider_profiles_private RLS remains enabled'
);

select ok(
  (
    select count(*)::int
    from pg_policies
    where schemaname = 'public'
      and tablename = 'provider_profiles_private'
  ) >= 1,
  'provider_profiles_private retains RLS policies'
);

select ok(
  exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'provider_profiles_private'
      and column_name = 'cpf'
  ),
  'existing cpf column preserved'
);

select finish();

rollback;

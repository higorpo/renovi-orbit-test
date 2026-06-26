-- pgTAP: payment Task 8 — provider_gateway_accounts schema, RLS, and grants (design.md §3.4, §11.2).

begin;

select plan(8);

select ok(
  to_regclass('public.provider_gateway_accounts') is not null,
  'provider_gateway_accounts table exists'
);

select ok(
  (
    select c.relrowsecurity
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public'
      and c.relname = 'provider_gateway_accounts'
  ),
  'provider_gateway_accounts has RLS enabled'
);

select ok(
  (
    select count(*)::int
    from pg_policies
    where schemaname = 'public'
      and tablename = 'provider_gateway_accounts'
  ) >= 1,
  'provider_gateway_accounts has at least one RLS policy'
);

select ok(
  has_table_privilege('authenticated', 'public.provider_gateway_accounts', 'SELECT')
    and not has_table_privilege('authenticated', 'public.provider_gateway_accounts', 'INSERT')
    and not has_table_privilege('authenticated', 'public.provider_gateway_accounts', 'UPDATE')
    and not has_table_privilege('authenticated', 'public.provider_gateway_accounts', 'DELETE'),
  'authenticated may SELECT only; no direct mutations'
);

select ok(
  not has_table_privilege('anon', 'public.provider_gateway_accounts', 'SELECT'),
  'anon cannot select provider_gateway_accounts'
);

select ok(
  has_table_privilege('service_role', 'public.provider_gateway_accounts', 'UPDATE'),
  'service_role can mutate provider_gateway_accounts'
);

select ok(
  exists (
    select 1
    from pg_indexes
    where schemaname = 'public'
      and tablename = 'provider_gateway_accounts'
      and indexname = 'provider_gateway_accounts_onboarding_status_idx'
  ),
  'partial onboarding_status index exists'
);

select ok(
  exists (
    select 1
    from pg_constraint c
    join pg_class rel on rel.oid = c.conrelid
    join pg_namespace n on n.oid = rel.relnamespace
    where n.nspname = 'public'
      and rel.relname = 'provider_gateway_accounts'
      and c.conname = 'provider_gateway_accounts_provider_gateway_unique'
  ),
  'unique (provider_id, gateway_slug) constraint exists'
);

select finish();

rollback;

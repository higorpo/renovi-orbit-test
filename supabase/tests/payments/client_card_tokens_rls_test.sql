-- pgTAP: payment Task 7 — client_card_tokens schema, RLS, and grants (design.md §3.3, §11.2).

begin;

select plan(9);

select ok(
  to_regclass('public.client_card_tokens') is not null,
  'client_card_tokens table exists'
);

select ok(
  (
    select c.relrowsecurity
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public'
      and c.relname = 'client_card_tokens'
  ),
  'client_card_tokens has RLS enabled'
);

select ok(
  (
    select count(*)::int
    from pg_policies
    where schemaname = 'public'
      and tablename = 'client_card_tokens'
  ) >= 1,
  'client_card_tokens has at least one RLS policy'
);

select ok(
  not has_table_privilege('authenticated', 'public.client_card_tokens', 'SELECT')
    and has_column_privilege('authenticated', 'public.client_card_tokens', 'id', 'SELECT')
    and has_column_privilege('authenticated', 'public.client_card_tokens', 'card_brand', 'SELECT')
    and not has_column_privilege('authenticated', 'public.client_card_tokens', 'gateway_card_token', 'SELECT')
    and not has_column_privilege('authenticated', 'public.client_card_tokens', 'billing_address', 'SELECT')
    and not has_table_privilege('authenticated', 'public.client_card_tokens', 'INSERT')
    and not has_table_privilege('authenticated', 'public.client_card_tokens', 'UPDATE')
    and not has_table_privilege('authenticated', 'public.client_card_tokens', 'DELETE'),
  'authenticated has column-level SELECT on safe columns only'
);

select ok(
  not has_table_privilege('anon', 'public.client_card_tokens', 'SELECT'),
  'anon cannot select client_card_tokens'
);

select ok(
  has_table_privilege('service_role', 'public.client_card_tokens', 'INSERT')
    and has_table_privilege('service_role', 'public.client_card_tokens', 'UPDATE'),
  'service_role can mutate client_card_tokens'
);

select ok(
  exists (
    select 1
    from pg_indexes
    where schemaname = 'public'
      and tablename = 'client_card_tokens'
      and indexname = 'client_card_tokens_client_state_idx'
  ),
  'client_id + state index exists'
);

select ok(
  exists (
    select 1
    from pg_constraint c
    join pg_class rel on rel.oid = c.conrelid
    join pg_namespace n on n.oid = rel.relnamespace
    where n.nspname = 'public'
      and rel.relname = 'client_card_tokens'
      and c.conname = 'client_card_tokens_client_profile_unique'
  ),
  'unique (client_id, gateway_payment_profile_id) constraint exists'
);

select ok(
  exists (
    select 1
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname = 'payment_client_card_token_is_expired'
  ),
  'payment_client_card_token_is_expired helper exists'
);

select finish();

rollback;

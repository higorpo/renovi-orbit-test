-- pgTAP: payment Task 6 — payment_gateway_tokens RLS and grants (design.md §3.2, §11.2).

begin;

select plan(7);

select ok(
  to_regclass('public.payment_gateway_tokens') is not null,
  'payment_gateway_tokens table exists'
);

select ok(
  (
    select c.relrowsecurity
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public'
      and c.relname = 'payment_gateway_tokens'
  ),
  'payment_gateway_tokens has RLS enabled'
);

select is(
  (
    select count(*)::int
    from pg_policies
    where schemaname = 'public'
      and tablename = 'payment_gateway_tokens'
  ),
  0,
  'payment_gateway_tokens has no permissive policies (service_role only)'
);

select ok(
  not has_table_privilege('authenticated', 'public.payment_gateway_tokens', 'SELECT')
    and not has_table_privilege('authenticated', 'public.payment_gateway_tokens', 'INSERT')
    and not has_table_privilege('authenticated', 'public.payment_gateway_tokens', 'UPDATE')
    and not has_table_privilege('authenticated', 'public.payment_gateway_tokens', 'DELETE'),
  'authenticated has no DML on payment_gateway_tokens'
);

select ok(
  not has_table_privilege('anon', 'public.payment_gateway_tokens', 'SELECT'),
  'anon cannot select payment_gateway_tokens'
);

select ok(
  has_table_privilege('service_role', 'public.payment_gateway_tokens', 'SELECT')
    and has_table_privilege('service_role', 'public.payment_gateway_tokens', 'INSERT')
    and has_table_privilege('service_role', 'public.payment_gateway_tokens', 'UPDATE')
    and has_table_privilege('service_role', 'public.payment_gateway_tokens', 'DELETE'),
  'service_role has full DML on payment_gateway_tokens'
);

select ok(
  (
    select a.atttypid = to_regtype('public.payment_gateway_slug')
    from pg_attribute a
    join pg_class rel on rel.oid = a.attrelid
    join pg_namespace n on n.oid = rel.relnamespace
    where n.nspname = 'public'
      and rel.relname = 'payment_gateway_tokens'
      and a.attname = 'gateway_slug'
      and a.attnum > 0
      and not a.attisdropped
  ),
  'gateway_slug column uses payment_gateway_slug enum'
);

select finish();

rollback;

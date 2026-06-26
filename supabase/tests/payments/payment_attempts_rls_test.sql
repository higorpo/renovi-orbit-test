-- pgTAP: payment Task 10 — payment_attempts append-only RLS (design.md §3.6, §11.2).

begin;

select plan(7);

select ok(
  to_regclass('public.payment_attempts') is not null,
  'payment_attempts table exists'
);

select ok(
  (
    select c.relrowsecurity
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public'
      and c.relname = 'payment_attempts'
  ),
  'payment_attempts has RLS enabled'
);

select is(
  (
    select count(*)::int
    from pg_policies
    where schemaname = 'public'
      and tablename = 'payment_attempts'
  ),
  0,
  'payment_attempts has no permissive policies (service_role only)'
);

select ok(
  not has_table_privilege('authenticated', 'public.payment_attempts', 'SELECT')
    and not has_table_privilege('authenticated', 'public.payment_attempts', 'INSERT')
    and not has_table_privilege('authenticated', 'public.payment_attempts', 'UPDATE')
    and not has_table_privilege('authenticated', 'public.payment_attempts', 'DELETE'),
  'authenticated has no access to payment_attempts'
);

select ok(
  not has_table_privilege('anon', 'public.payment_attempts', 'SELECT'),
  'anon cannot select payment_attempts'
);

select ok(
  has_table_privilege('service_role', 'public.payment_attempts', 'SELECT')
    and has_table_privilege('service_role', 'public.payment_attempts', 'INSERT')
    and not has_table_privilege('service_role', 'public.payment_attempts', 'UPDATE')
    and not has_table_privilege('service_role', 'public.payment_attempts', 'DELETE'),
  'service_role may insert and select only (append-only)'
);

select ok(
  exists (
    select 1
    from pg_indexes
    where schemaname = 'public'
      and tablename = 'payment_attempts'
      and indexname = 'payment_attempts_schedule_attempt_number_idx'
  ),
  'schedule_id + attempt_number index exists'
);

select finish();

rollback;

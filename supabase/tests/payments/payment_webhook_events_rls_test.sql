-- pgTAP: payment Task 11 — payment_webhook_events RLS and indexes (design.md §3.7, §11.2).

begin;

select plan(8);

select ok(
  to_regclass('public.payment_webhook_events') is not null,
  'payment_webhook_events table exists'
);

select ok(
  (
    select c.relrowsecurity
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public'
      and c.relname = 'payment_webhook_events'
  ),
  'payment_webhook_events has RLS enabled'
);

select is(
  (
    select count(*)::int
    from pg_policies
    where schemaname = 'public'
      and tablename = 'payment_webhook_events'
  ),
  0,
  'payment_webhook_events has no permissive policies (service_role only)'
);

select ok(
  not has_table_privilege('authenticated', 'public.payment_webhook_events', 'SELECT')
    and not has_table_privilege('authenticated', 'public.payment_webhook_events', 'INSERT'),
  'authenticated has no access to payment_webhook_events'
);

select ok(
  not has_table_privilege('anon', 'public.payment_webhook_events', 'SELECT'),
  'anon cannot select payment_webhook_events'
);

select ok(
  has_table_privilege('service_role', 'public.payment_webhook_events', 'INSERT')
    and has_table_privilege('service_role', 'public.payment_webhook_events', 'UPDATE'),
  'service_role can mutate payment_webhook_events'
);

select ok(
  exists (
    select 1
    from pg_indexes
    where schemaname = 'public'
      and tablename = 'payment_webhook_events'
      and indexname = 'payment_webhook_events_retry_idx'
  ),
  'FAILED retry partial index exists'
);

select ok(
  exists (
    select 1
    from pg_constraint c
    join pg_class rel on rel.oid = c.conrelid
    join pg_namespace n on n.oid = rel.relnamespace
    where n.nspname = 'public'
      and rel.relname = 'payment_webhook_events'
      and c.conname = 'payment_webhook_events_dedup_unique'
  ),
  'deduplication unique constraint exists'
);

select finish();

rollback;

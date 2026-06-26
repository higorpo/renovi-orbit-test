-- pgTAP: payment Task 12 — payment_webhook_processing_queue RLS (design.md §3.8, §11.2).

begin;

select plan(7);

select ok(
  to_regclass('public.payment_webhook_processing_queue') is not null,
  'payment_webhook_processing_queue table exists'
);

select ok(
  (
    select c.relrowsecurity
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public'
      and c.relname = 'payment_webhook_processing_queue'
  ),
  'payment_webhook_processing_queue has RLS enabled'
);

select is(
  (
    select count(*)::int
    from pg_policies
    where schemaname = 'public'
      and tablename = 'payment_webhook_processing_queue'
  ),
  0,
  'no permissive policies (service_role only)'
);

select ok(
  not has_table_privilege('authenticated', 'public.payment_webhook_processing_queue', 'SELECT'),
  'authenticated has no access'
);

select ok(
  not has_table_privilege('anon', 'public.payment_webhook_processing_queue', 'SELECT'),
  'anon has no access'
);

select ok(
  has_table_privilege('service_role', 'public.payment_webhook_processing_queue', 'UPDATE'),
  'service_role can mutate queue rows'
);

select ok(
  exists (
    select 1
    from pg_indexes
    where schemaname = 'public'
      and tablename = 'payment_webhook_processing_queue'
      and indexname = 'payment_webhook_processing_queue_pending_idx'
  ),
  'PENDING partial index exists'
);

select finish();

rollback;

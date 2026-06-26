-- pgTAP: payment Task 14 — payment_events append-only RLS (design.md §3.10, §11.2).

begin;

select plan(8);

select ok(
  to_regclass('public.payment_events') is not null,
  'payment_events table exists'
);

select ok(
  (
    select c.relrowsecurity
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public'
      and c.relname = 'payment_events'
  ),
  'payment_events has RLS enabled'
);

select ok(
  exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'payment_events'
      and policyname = 'payment_events_select_admin'
  ),
  'payment_events has admin-only SELECT policy'
);

select ok(
  not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'payment_events'
      and policyname = 'payment_events_select_participant_or_admin'
  ),
  'participant SELECT policy is not present'
);

select ok(
  has_table_privilege('authenticated', 'public.payment_events', 'SELECT')
    and not has_table_privilege('authenticated', 'public.payment_events', 'INSERT')
    and not has_table_privilege('authenticated', 'public.payment_events', 'UPDATE'),
  'authenticated has SELECT grant only; writes denied (RLS limits rows to admins)'
);

select ok(
  not has_table_privilege('anon', 'public.payment_events', 'SELECT'),
  'anon cannot select payment_events'
);

select ok(
  has_table_privilege('service_role', 'public.payment_events', 'INSERT'),
  'service_role can insert payment_events'
);

select ok(
  (
    select count(*)::int
    from pg_indexes
    where schemaname = 'public'
      and tablename = 'payment_events'
      and indexname in (
        'payment_events_event_type_created_at_idx',
        'payment_events_service_id_created_at_idx',
        'payment_events_aggregate_created_at_idx'
      )
  ) = 3,
  'three named indexes exist on payment_events'
);

select finish();

rollback;

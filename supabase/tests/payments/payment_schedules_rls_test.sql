-- pgTAP: payment Task 9 — payment_schedules schema, indexes, RLS, column CLS (design.md §3.5, §11.2).

begin;

select plan(11);

select ok(
  to_regclass('public.payment_schedules') is not null,
  'payment_schedules table exists'
);

select ok(
  (
    select c.relrowsecurity
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public'
      and c.relname = 'payment_schedules'
  ),
  'payment_schedules has RLS enabled'
);

select ok(
  (
    select count(*)::int
    from pg_policies
    where schemaname = 'public'
      and tablename = 'payment_schedules'
  ) >= 1,
  'payment_schedules has at least one RLS policy'
);

select ok(
  not has_table_privilege('authenticated', 'public.payment_schedules', 'SELECT')
    and has_column_privilege('authenticated', 'public.payment_schedules', 'state', 'SELECT')
    and not has_table_privilege('authenticated', 'public.payment_schedules', 'INSERT')
    and not has_table_privilege('authenticated', 'public.payment_schedules', 'UPDATE')
    and not has_table_privilege('authenticated', 'public.payment_schedules', 'DELETE'),
  'authenticated has column-level SELECT only; no direct mutations'
);

select ok(
  not has_column_privilege('authenticated', 'public.payment_schedules', 'clearsale_session_id', 'SELECT')
    and not has_column_privilege('authenticated', 'public.payment_schedules', 'client_ip_address', 'SELECT')
    and not has_column_privilege('authenticated', 'public.payment_schedules', 'paid_amount', 'SELECT')
    and not has_column_privilege('authenticated', 'public.payment_schedules', 'provider_payout', 'SELECT'),
  'authenticated cannot SELECT fraud, ops, or cross-participant amount columns'
);

select ok(
  has_column_privilege('authenticated', 'public.payment_schedules', 'state', 'SELECT')
    and has_column_privilege('authenticated', 'public.payment_schedules', 'charge_scheduled_at', 'SELECT'),
  'authenticated can SELECT participant-safe schedule columns'
);

select ok(
  has_column_privilege('service_role', 'public.payment_schedules', 'clearsale_session_id', 'SELECT')
    and has_column_privilege('service_role', 'public.payment_schedules', 'paid_amount', 'SELECT'),
  'service_role retains full column SELECT'
);

select ok(
  not has_table_privilege('anon', 'public.payment_schedules', 'SELECT'),
  'anon cannot select payment_schedules'
);

select ok(
  has_table_privilege('service_role', 'public.payment_schedules', 'UPDATE'),
  'service_role can mutate payment_schedules'
);

select ok(
  exists (
    select 1
    from pg_indexes
    where schemaname = 'public'
      and tablename = 'payment_schedules'
      and indexname = 'payment_schedules_queue_claim_idx'
  ),
  'cron queue partial index exists'
);

select ok(
  exists (
    select 1
    from pg_constraint c
    join pg_class rel on rel.oid = c.conrelid
    join pg_namespace n on n.oid = rel.relnamespace
    where n.nspname = 'public'
      and rel.relname = 'payment_schedules'
      and c.conname = 'payment_schedules_idempotency_key_unique'
  ),
  'idempotency_key unique constraint exists'
);

select finish();

rollback;

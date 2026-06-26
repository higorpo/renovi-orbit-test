-- pgTAP: payment Task 16 — payment history views (design.md §3.13).

begin;

select plan(9);

select ok(
  to_regclass('public.client_payment_transactions_v') is not null,
  'client_payment_transactions_v exists'
);

select ok(
  to_regclass('public.provider_payment_receivables_v') is not null,
  'provider_payment_receivables_v exists'
);

select ok(
  (
    select not coalesce(c.reloptions @> array['security_invoker=true'], false)
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public'
      and c.relname = 'client_payment_transactions_v'
  ),
  'client history view uses definer rights for revoked base columns'
);

select ok(
  not exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'client_payment_transactions_v'
      and column_name in ('provider_payout', 'amount_received_at_capture')
  ),
  'client view does not expose provider payout columns'
);

select ok(
  not exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'provider_payment_receivables_v'
      and column_name in ('amount_paid', 'paid_amount', 'service_amount', 'base_amount')
  ),
  'provider view does not expose client paid_amount columns'
);

select ok(
  exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'payment_schedules'
      and policyname = 'payment_schedules_select_participant_or_admin'
  ),
  'payment_schedules SELECT policy scopes direct participant reads on base table'
);

select ok(
  has_table_privilege('authenticated', 'public.client_payment_transactions_v', 'SELECT')
    and not has_table_privilege('anon', 'public.client_payment_transactions_v', 'SELECT'),
  'authenticated SELECT on client view; anon denied'
);

select ok(
  exists (
    select 1
    from pg_indexes
    where schemaname = 'public'
      and tablename = 'payment_schedules'
      and indexname = 'payment_schedules_client_paid_history_idx'
  ),
  'client paid history index exists'
);

select ok(
  exists (
    select 1
    from pg_indexes
    where schemaname = 'public'
      and tablename = 'payment_schedules'
      and indexname = 'payment_schedules_provider_paid_history_idx'
  ),
  'provider paid history index exists'
);

select finish();

rollback;

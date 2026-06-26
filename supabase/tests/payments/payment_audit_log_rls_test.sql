-- pgTAP: payment Task 13 — payment_audit_log append-only RLS (design.md §3.9, §11.2).

begin;

select plan(9);

select ok(
  to_regclass('public.payment_audit_log') is not null,
  'payment_audit_log table exists'
);

select ok(
  (
    select c.relrowsecurity
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public'
      and c.relname = 'payment_audit_log'
  ),
  'payment_audit_log has RLS enabled'
);

select ok(
  exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'payment_audit_log'
      and policyname = 'payment_audit_log_select_admin'
  ),
  'payment_audit_log has admin-only SELECT policy'
);

select ok(
  not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'payment_audit_log'
      and policyname = 'payment_audit_log_select_participant_or_admin'
  ),
  'participant SELECT policy is not present'
);

select ok(
  has_table_privilege('authenticated', 'public.payment_audit_log', 'SELECT')
    and not has_table_privilege('authenticated', 'public.payment_audit_log', 'INSERT')
    and not has_table_privilege('authenticated', 'public.payment_audit_log', 'UPDATE')
    and not has_table_privilege('authenticated', 'public.payment_audit_log', 'DELETE'),
  'authenticated has SELECT grant only; writes denied (RLS limits rows to admins)'
);

select ok(
  not has_table_privilege('anon', 'public.payment_audit_log', 'SELECT'),
  'anon cannot select payment_audit_log'
);

select ok(
  has_table_privilege('service_role', 'public.payment_audit_log', 'INSERT')
    and has_table_privilege('service_role', 'public.payment_audit_log', 'SELECT')
    and not has_table_privilege('service_role', 'public.payment_audit_log', 'UPDATE'),
  'service_role insert-only besides select'
);

select ok(
  not exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'payment_audit_log'
      and column_name = 'updated_at'
  ),
  'no updated_at column (insert-only table)'
);

select ok(
  exists (
    select 1
    from pg_indexes
    where schemaname = 'public'
      and tablename = 'payment_audit_log'
      and indexname = 'payment_audit_log_service_id_created_at_idx'
  ),
  'service_id created_at index exists'
);

select finish();

rollback;

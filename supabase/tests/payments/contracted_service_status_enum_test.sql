-- pgTAP: payment Task 2 — contracted_service_status enum values and lifecycle columns exist.

begin;

select plan(7);

select ok(
  exists (
    select 1
    from pg_enum e
    join pg_type t on t.oid = e.enumtypid
    where t.typname = 'contracted_service_status'
      and e.enumlabel = 'CONFIRMED'
  ),
  'contracted_service_status includes CONFIRMED'
);

select ok(
  exists (
    select 1
    from pg_enum e
    join pg_type t on t.oid = e.enumtypid
    where t.typname = 'contracted_service_status'
      and e.enumlabel = 'EXECUTED'
  ),
  'contracted_service_status includes EXECUTED'
);

select ok(
  exists (
    select 1
    from pg_enum e
    join pg_type t on t.oid = e.enumtypid
    where t.typname = 'contracted_service_status'
      and e.enumlabel = 'PENDING_PAYMENT'
  ),
  'contracted_service_status retains PENDING_PAYMENT'
);

select ok(
  exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'contracted_services'
      and column_name = 'cancellation_reason'
  ),
  'contracted_services has cancellation_reason column'
);

select ok(
  exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'contracted_services'
      and column_name = 'executed_at'
  ),
  'contracted_services has executed_at column'
);

select ok(
  exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'contracted_services'
      and column_name = 'completed_at'
  ),
  'contracted_services has completed_at column'
);

select ok(
  exists (
    select 1
    from pg_constraint c
    join pg_class rel on rel.oid = c.conrelid
    join pg_namespace n on n.oid = rel.relnamespace
    where n.nspname = 'public'
      and rel.relname = 'contracted_services'
      and c.conname = 'contracted_services_completed_by_check'
  ),
  'contracted_services has completed_by check constraint'
);

select finish();

rollback;

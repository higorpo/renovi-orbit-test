-- pgTAP: payment Task 3 — payment_service_execution_at shift mapping and timezone anchor.

begin;

select plan(6);

create or replace function pg_temp.payment_cs_row(
  p_start date,
  p_shift text,
  p_end date default null
)
returns public.contracted_services
language sql
as $$
  select row(
    null::uuid,
    null::uuid,
    null::uuid,
    null::uuid,
    null::uuid,
    null::text,
    null::integer,
    p_start,
    p_end,
    p_shift,
    null::jsonb,
    null::public.contracted_service_status,
    null::timestamptz,
    null::timestamptz,
    null::text,
    null::timestamptz,
    null::timestamptz,
    null::text,
    null::timestamptz
  )::public.contracted_services;
$$;

select is(
  public.payment_service_execution_at(pg_temp.payment_cs_row('2026-06-15'::date, 'morning')),
  timestamptz '2026-06-15 08:00:00-03',
  'morning shift maps to 08:00 America/Sao_Paulo'
);

select is(
  public.payment_service_execution_at(pg_temp.payment_cs_row('2026-06-15'::date, 'afternoon')),
  timestamptz '2026-06-15 13:00:00-03',
  'afternoon shift maps to 13:00 America/Sao_Paulo'
);

select is(
  public.payment_service_execution_at(pg_temp.payment_cs_row('2026-06-15'::date, 'full_day')),
  timestamptz '2026-06-15 08:00:00-03',
  'full_day shift maps to 08:00 America/Sao_Paulo'
);

select is(
  public.payment_service_execution_at(pg_temp.payment_cs_row('2026-06-15'::date, 'morning', '2026-06-20'::date)),
  public.payment_service_execution_at(pg_temp.payment_cs_row('2026-06-15'::date, 'morning')),
  'anchor uses scheduled_start_date only, not scheduled_end_date'
);

select is(
  public.payment_service_execution_at(pg_temp.payment_cs_row('2026-01-15'::date, 'morning')),
  timestamptz '2026-01-15 08:00:00-03',
  'winter date keeps America/Sao_Paulo UTC-03 offset (no DST)'
);

select is(
  public.payment_service_execution_at(pg_temp.payment_cs_row('2026-06-15'::date, 'morning')),
  public.payment_service_execution_at(pg_temp.payment_cs_row('2026-06-15'::date, 'morning')),
  'deterministic for the same row snapshot'
);

select finish();

rollback;

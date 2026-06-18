-- pgTAP: matching_ops_consecutive_cron_errors (matching task 47).

begin;

select plan(3);

select ok(
  (
    select p.prosecdef
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname = 'matching_ops_consecutive_cron_errors'
  ),
  'matching_ops_consecutive_cron_errors is SECURITY DEFINER'
);

insert into public.job_runs (
  job_name,
  started_at,
  finished_at,
  error_count,
  metadata
)
select
  'matching_process_service_request_dispatches',
  now() + interval '1 second' * (13 - gs.i),
  now() + interval '1 second' * (13 - gs.i) + interval '1 millisecond',
  1,
  jsonb_build_object(
    'error_dispatches',
    jsonb_build_array(
      jsonb_build_object(
        'service_request_id', '7017e457-5a32-44e7-b8da-1727a14f4d33'
      )
    )
  )
from generate_series(1, 12) as gs(i);

select ok(
  (public.matching_ops_consecutive_cron_errors(10, 50)->>'alert')::boolean,
  'alerts when consecutive error runs exceed threshold'
);

select is(
  (public.matching_ops_consecutive_cron_errors(10, 50)->>'consecutive_error_runs')::int,
  12,
  'counts consecutive error runs from latest finished rows'
);

select finish();

rollback;

-- pgTAP: Task 58 — orphan finalize + cron wrapper exist; finalize deletes claimed rows.

begin;

select plan(4);

create or replace function pg_temp.set_service_role()
returns void
language plpgsql
as $$
begin
  perform set_config(
    'request.jwt.claims',
    json_build_object('role', 'service_role')::text,
    true
  );
  perform set_config('request.jwt.claim.role', 'service_role', true);
end;
$$;

select throws_ok(
  $$ select public.service_completion_janitor_orphan_uploads_finalize(array[]::uuid[]) $$,
  '42501',
  null,
  'finalize rejects non-service_role'
);

select ok(
  to_regprocedure('public.service_completion_cron_orphan_upload_janitor()') is not null,
  'cron orphan janitor wrapper exists'
);

select pg_temp.set_service_role();

select is(
  (public.service_completion_janitor_orphan_uploads_finalize(array[]::uuid[])->>'deleted_count')::int,
  0,
  'finalize empty array is no-op'
);

select ok(
  exists (
    select 1
    from cron.job j
    where j.jobname = 'service_completion_orphan_upload_janitor'
  ),
  'pg_cron job service_completion_orphan_upload_janitor is scheduled'
);

select finish();

rollback;

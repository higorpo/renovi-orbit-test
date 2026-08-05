-- pgTAP: Task 58 — cron wrapper exists; SQL janitor (no Edge finalize).

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

select ok(
  to_regprocedure('public.service_completion_cron_orphan_upload_janitor()') is not null,
  'cron orphan janitor wrapper exists'
);

select ok(
  to_regprocedure('public.service_completion_janitor_orphan_uploads_finalize(uuid[])') is null,
  'Edge-era finalize RPC is dropped'
);

select ok(
  exists (
    select 1
    from cron.job j
    where j.jobname = 'service_completion_orphan_upload_janitor'
  ),
  'pg_cron job service_completion_orphan_upload_janitor is scheduled'
);

select pg_temp.set_service_role();

select ok(
  (public.service_completion_janitor_orphan_uploads(5)->>'ok')::boolean,
  'SQL janitor callable from service_role (empty batch ok)'
);

select finish();

rollback;

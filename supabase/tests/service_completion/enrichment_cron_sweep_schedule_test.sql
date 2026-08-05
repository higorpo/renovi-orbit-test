-- pgTAP: Task 28 — enrichment_cron_sweep schedule, due count, ops_attention skip, job_runs.

begin;

select plan(7);

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
  exists (
    select 1
    from cron.job j
    where j.jobname = 'enrichment_cron_sweep'
      and j.schedule = '* * * * *'
  ),
  'enrichment_cron_sweep scheduled every minute'
);

select ok(
  not has_function_privilege('authenticated', 'public.enrichment_cron_sweep()', 'execute'),
  'authenticated cannot execute enrichment_cron_sweep'
);

create temp table _fx as
select
  gen_random_uuid() as sr_due,
  gen_random_uuid() as enr_due,
  gen_random_uuid() as sr_ops,
  gen_random_uuid() as enr_ops,
  gen_random_uuid() as sr_future,
  gen_random_uuid() as enr_future;

insert into public.service_requests (
  id, client_id, service_id, address_id, title, description,
  form_data, form_version, status, urgency
)
select
  x.sr_id, sr.client_id, sr.service_id, sr.address_id,
  format('enrichment cron sweep %s', x.label),
  sr.description, sr.form_data, sr.form_version,
  'OPEN', sr.urgency
from (
  select sr_due as sr_id, 'due' as label from _fx
  union all select sr_ops, 'ops' from _fx
  union all select sr_future, 'future' from _fx
) x
join public.service_requests sr on sr.id = '7017e457-5a32-44e7-b8da-1727a14f4d33'::uuid;

insert into public.service_request_enrichments (
  id, service_request_id, status, attempt_count, next_attempt_at, ops_attention_at
)
select enr_due, sr_due, 'PENDING'::public.enrichment_status, 0, null, null
from _fx;

insert into public.service_request_enrichments (
  id, service_request_id, status, attempt_count, next_attempt_at, ops_attention_at
)
select enr_ops, sr_ops, 'PENDING'::public.enrichment_status, 3, null, now()
from _fx;

insert into public.service_request_enrichments (
  id, service_request_id, status, attempt_count, next_attempt_at, ops_attention_at
)
select enr_future, sr_future, 'PENDING'::public.enrichment_status, 1,
  now() + interval '1 hour', null
from _fx;

-- Reset role to postgres for cron EXECUTE grant
reset role;

create temp table _sweep as
select public.enrichment_cron_sweep() as payload;

select ok(
  (select (payload->>'due_pending_count')::int >= 1 from _sweep),
  'sweep counts at least our due PENDING row'
);

select ok(
  (select payload ? 'reclaim_count'
    and payload ? 'repair_count'
    and payload ? 'wake_requested'
    and payload ? 'job_run_id'
   from _sweep),
  'sweep payload includes reclaim/repair/wake/job_run_id telemetry keys'
);

select ok(
  exists (
    select 1
    from public.job_runs jr
    where jr.job_name = 'enrichment_cron_sweep'
      and jr.id = (select (payload->>'job_run_id')::bigint from _sweep)
  ),
  'sweep writes job_runs row'
);

-- ops_attention PENDING must not be treated as due (count excludes it)
select ok(
  (
    select count(*)::int
    from public.service_request_enrichments e
    join _fx f on e.id = f.enr_ops
    where e.status = 'PENDING'::public.enrichment_status
      and e.ops_attention_at is not null
  ) = 1,
  'ops_attention PENDING fixture remains PENDING (not claimed by sweep wake alone)'
);

select ok(
  exists (
    select 1
    from public.service_request_enrichments e
    join _fx f on e.id = f.enr_future
    where e.status = 'PENDING'::public.enrichment_status
      and e.next_attempt_at > now()
  ),
  'future next_attempt_at PENDING remains due-gated'
);

select * from finish();

rollback;

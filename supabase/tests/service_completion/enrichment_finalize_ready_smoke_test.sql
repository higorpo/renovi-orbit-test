-- pgTAP: Task 20 smoke — invalid schema raises; stale lease rejected; happy path READY+dispatch.
-- Full race matrix: Tasks 66–68.

begin;

select plan(5);

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

create temp table _fin_fixture as
select
  gen_random_uuid() as sr_id,
  gen_random_uuid() as enr_id;

insert into public.service_requests (
  id, client_id, service_id, address_id, title, description,
  form_data, form_version, status, urgency
)
select
  f.sr_id, sr.client_id, sr.service_id, sr.address_id,
  'finalize ready smoke', sr.description, sr.form_data, sr.form_version,
  'OPEN', sr.urgency
from _fin_fixture f
join public.service_requests sr on sr.id = '7017e457-5a32-44e7-b8da-1727a14f4d33'::uuid;

insert into public.service_request_enrichments (
  id, service_request_id, status, attempt_count,
  lease_owner, lease_generation, locked_until
)
select
  enr_id, sr_id, 'RUNNING'::public.enrichment_status, 0,
  'worker-fin', 3, now() + interval '2 minutes'
from _fin_fixture;

select pg_temp.set_service_role();

select throws_ok(
  format(
    $sql$
      select public.enrichment_finalize_ready(
        '%s'::uuid,
        'worker-fin',
        3,
        '{"version":1,"blocks":[]}'::jsonb,
        'ai'::public.checklist_source,
        null
      )
    $sql$,
    (select enr_id from _fin_fixture)
  ),
  'P0001',
  'INVALID_CHECKLIST_SCHEMA',
  'invalid schema raises INVALID_CHECKLIST_SCHEMA'
);

select is(
  public.enrichment_finalize_ready(
    (select enr_id from _fin_fixture),
    'worker-fin',
    99,
    (
      select checklist_schema
      from public.completion_checklist_templates
      where is_global and is_active
      limit 1
    ),
    'ai'::public.checklist_source,
    null
  )->>'reason',
  'STALE_LEASE_OR_STATE',
  'stale lease_generation rejected'
);

select ok(
  (
    select (public.enrichment_finalize_ready(
      (select enr_id from _fin_fixture),
      'worker-fin',
      3,
      (
        select checklist_schema
        from public.completion_checklist_templates
        where is_global and is_active
        limit 1
      ),
      'ai'::public.checklist_source,
      null
    )->>'ok')::boolean
  ),
  'happy path finalize returns ok'
);

select ok(
  exists (
    select 1
    from public.service_request_enrichments e
    where e.id = (select enr_id from _fin_fixture)
      and e.status = 'READY'::public.enrichment_status
      and e.checklist_schema is not null
      and e.source = 'ai'::public.checklist_source
      and e.lease_owner is null
  ),
  'enrichment is READY with schema; lease cleared'
);

select ok(
  exists (
    select 1
    from public.service_request_dispatches d
    where d.service_request_id = (select sr_id from _fin_fixture)
      and d.status = 'DISPATCH_PENDING'::public.service_request_dispatch_status
  ),
  'matching dispatch bootstrapped in same finalize TX'
);

select finish();

rollback;

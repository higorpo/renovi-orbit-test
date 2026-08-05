-- pgTAP: Task 23 — reclaim expired lease; stale finalize rejected.

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

create temp table _rcl_fixture as
select
  gen_random_uuid() as sr_id,
  gen_random_uuid() as enr_id;

insert into public.service_requests (
  id, client_id, service_id, address_id, title, description,
  form_data, form_version, status, urgency
)
select
  f.sr_id, sr.client_id, sr.service_id, sr.address_id,
  'reclaim leases pgTAP', sr.description, sr.form_data, sr.form_version,
  'OPEN', sr.urgency
from _rcl_fixture f
join public.service_requests sr on sr.id = '7017e457-5a32-44e7-b8da-1727a14f4d33'::uuid;

insert into public.service_request_enrichments (
  id, service_request_id, status, attempt_count,
  lease_owner, lease_generation, locked_until
)
select
  enr_id, sr_id, 'RUNNING'::public.enrichment_status, 0,
  'worker-stale', 5, now() - interval '1 minute'
from _rcl_fixture;

select pg_temp.set_service_role();

select is(
  (public.enrichment_reclaim_expired_leases(10)->>'reclaimed_count')::int,
  1,
  'reclaims one expired RUNNING lease'
);

select ok(
  exists (
    select 1
    from public.service_request_enrichments e
    where e.id = (select enr_id from _rcl_fixture)
      and e.status = 'PENDING'::public.enrichment_status
      and e.lease_owner is null
      and e.locked_until is null
      and e.lease_generation = 6
  ),
  'row PENDING with lease_generation incremented; owner cleared'
);

select is(
  public.enrichment_finalize_ready(
    (select enr_id from _rcl_fixture),
    'worker-stale',
    5,
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
  'finalize with pre-reclaim generation is rejected'
);

select ok(
  exists (
    select 1
    from public.service_request_enrichment_events ev
    where ev.enrichment_id = (select enr_id from _rcl_fixture)
      and ev.event_type = 'RECLAIM'
  ),
  'RECLAIM event appended'
);

select finish();

rollback;

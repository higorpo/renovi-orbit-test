-- pgTAP: Task 24 smoke — READY without dispatch gets bootstrap once.

begin;

select plan(3);

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

create temp table _rep_fixture as
select
  gen_random_uuid() as sr_id,
  gen_random_uuid() as enr_id;

insert into public.service_requests (
  id, client_id, service_id, address_id, title, description,
  form_data, form_version, status, urgency
)
select
  f.sr_id, sr.client_id, sr.service_id, sr.address_id,
  'repair ready dispatch pgTAP', sr.description, sr.form_data, sr.form_version,
  'OPEN', sr.urgency
from _rep_fixture f
join public.service_requests sr on sr.id = '7017e457-5a32-44e7-b8da-1727a14f4d33'::uuid;

insert into public.service_request_enrichments (
  id, service_request_id, status, checklist_schema, source, materialized_at
)
select
  enr_id,
  sr_id,
  'READY'::public.enrichment_status,
  (select checklist_schema from public.completion_checklist_templates where is_global and is_active limit 1),
  'fallback_template'::public.checklist_source,
  now()
from _rep_fixture;

select pg_temp.set_service_role();

select is(
  (public.enrichment_repair_ready_without_dispatch(10)->>'repaired_count')::int,
  1,
  'repairs READY enrichment missing dispatch'
);

select ok(
  exists (
    select 1
    from public.service_request_dispatches d
    where d.service_request_id = (select sr_id from _rep_fixture)
      and d.status = 'DISPATCH_PENDING'::public.service_request_dispatch_status
  ),
  'dispatch row created via bootstrap'
);

select is(
  (public.enrichment_repair_ready_without_dispatch(10)->>'repaired_count')::int,
  0,
  'second repair is idempotent (dispatch already exists)'
);

select finish();

rollback;

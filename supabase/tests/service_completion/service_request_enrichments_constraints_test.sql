-- pgTAP: service-completion Task 3 — UNIQUE(sr) + READY-requires-schema CHECK (design §3.2).

begin;

select plan(3);

create temp table _enr_fixture as
select
  gen_random_uuid() as sr_id,
  gen_random_uuid() as enrichment_id;

insert into public.service_requests (
  id,
  client_id,
  service_id,
  address_id,
  title,
  description,
  form_data,
  form_version,
  status,
  urgency
)
select
  (select sr_id from _enr_fixture),
  sr.client_id,
  sr.service_id,
  sr.address_id,
  'enrichment constraints pgTAP',
  sr.description,
  sr.form_data,
  sr.form_version,
  'OPEN',
  sr.urgency
from public.service_requests sr
where sr.id = '7017e457-5a32-44e7-b8da-1727a14f4d33'::uuid;

insert into public.service_request_enrichments (
  id,
  service_request_id,
  status
)
select
  enrichment_id,
  sr_id,
  'PENDING'::public.enrichment_status
from _enr_fixture;

select throws_ok(
  $sql$
    insert into public.service_request_enrichments (service_request_id, status)
    select sr_id, 'PENDING'::public.enrichment_status from _enr_fixture
  $sql$,
  '23505',
  null,
  'UNIQUE(service_request_id) rejects duplicate enrichment FSM'
);

select throws_ok(
  $sql$
    update public.service_request_enrichments
    set status = 'READY'::public.enrichment_status
    where id = (select enrichment_id from _enr_fixture)
  $sql$,
  '23514',
  null,
  'READY without schema/source/materialized_at is rejected by CHECK'
);

select lives_ok(
  $sql$
    update public.service_request_enrichments
    set
      status = 'READY'::public.enrichment_status,
      checklist_schema = '{"blocks":[]}'::jsonb,
      source = 'ai'::public.checklist_source,
      materialized_at = now()
    where id = (select enrichment_id from _enr_fixture)
  $sql$,
  'READY with schema + source + materialized_at is accepted'
);

select finish();

rollback;

-- pgTAP: service-completion Task 13 — enqueue enrichment ON CONFLICT DO NOTHING.

begin;

select plan(4);

create temp table _enq_fixture as
select gen_random_uuid() as sr_id;

insert into public.service_requests (
  id, client_id, service_id, address_id, title, description,
  form_data, form_version, status, urgency
)
select
  f.sr_id, sr.client_id, sr.service_id, sr.address_id,
  'enqueue enrichment pgTAP', sr.description, sr.form_data, sr.form_version,
  'OPEN', sr.urgency
from _enq_fixture f
join public.service_requests sr on sr.id = '7017e457-5a32-44e7-b8da-1727a14f4d33'::uuid;

select lives_ok(
  $sql$
    select public.service_request_enqueue_enrichment((select sr_id from _enq_fixture))
  $sql$,
  'first enqueue inserts PENDING enrichment'
);

select is(
  (
    select count(*)::int
    from public.service_request_enrichments e
    where e.service_request_id = (select sr_id from _enq_fixture)
      and e.status = 'PENDING'::public.enrichment_status
  ),
  1,
  'exactly one PENDING enrichment after enqueue'
);

select lives_ok(
  $sql$
    select public.service_request_enqueue_enrichment((select sr_id from _enq_fixture))
  $sql$,
  'second enqueue is conflict DO NOTHING (no error)'
);

-- Still exactly one row
select is(
  (
    select count(*)::int
    from public.service_request_enrichments e
    where e.service_request_id = (select sr_id from _enq_fixture)
  ),
  1,
  'conflict leaves a single enrichment row'
);

select finish();

rollback;

-- pgTAP: Task 17 — enrichment_claim_batch SKIP LOCKED; sequential claimers get disjoint sets.

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

create temp table _claim_fixture as
select
  gen_random_uuid() as sr_a,
  gen_random_uuid() as sr_b,
  gen_random_uuid() as sr_ops,
  gen_random_uuid() as enr_a,
  gen_random_uuid() as enr_b,
  gen_random_uuid() as enr_ops;

insert into public.service_requests (
  id, client_id, service_id, address_id, title, description,
  form_data, form_version, status, urgency
)
select
  x.sr_id, sr.client_id, sr.service_id, sr.address_id,
  format('claim batch %s', x.label), sr.description, sr.form_data, sr.form_version,
  'OPEN', sr.urgency
from (
  select sr_a as sr_id, 'a' as label from _claim_fixture
  union all
  select sr_b, 'b' from _claim_fixture
  union all
  select sr_ops, 'ops' from _claim_fixture
) x
join public.service_requests sr on sr.id = '7017e457-5a32-44e7-b8da-1727a14f4d33'::uuid;

insert into public.service_request_enrichments (
  id, service_request_id, status, attempt_count, next_attempt_at, ops_attention_at
)
select enr_a, sr_a, 'PENDING'::public.enrichment_status, 0,
  null::timestamptz, null::timestamptz
from _claim_fixture
union all
select enr_b, sr_b, 'PENDING'::public.enrichment_status, 0,
  null::timestamptz, null::timestamptz
from _claim_fixture
union all
select enr_ops, sr_ops, 'PENDING'::public.enrichment_status, 0,
  null::timestamptz, now()
from _claim_fixture;

select throws_ok(
  $sql$ select public.enrichment_claim_batch('worker-a', 1) $sql$,
  '42501',
  'service_role required for enrichment_claim_batch',
  'authenticated/anonymous cannot claim'
);

select pg_temp.set_service_role();

create temp table _claim1 as
select public.enrichment_claim_batch('worker-a', 1) as payload;

select is(
  jsonb_array_length((select payload from _claim1)),
  1,
  'first claimer gets exactly one row with batch_size=1'
);

create temp table _claim2 as
select public.enrichment_claim_batch('worker-b', 10) as payload;

select is(
  jsonb_array_length((select payload from _claim2)),
  1,
  'second claimer gets the remaining due row (ops_attention skipped)'
);

select ok(
  (
    select payload->0->>'id' from _claim1
  ) is distinct from (
    select payload->0->>'id' from _claim2
  ),
  'sequential claimers receive disjoint enrichment ids'
);

select ok(
  (
    select count(*)::int
    from public.service_request_enrichments e
    join _claim_fixture f on e.id = f.enr_ops
    where e.status = 'PENDING'::public.enrichment_status
      and e.ops_attention_at is not null
  ) = 1,
  'ops_attention PENDING row is never claimed'
);

select is(
  (
    select count(*)::int
    from public.service_request_enrichments e
    where e.id in (select enr_a from _claim_fixture union select enr_b from _claim_fixture)
      and e.status = 'RUNNING'::public.enrichment_status
      and e.lease_owner is not null
      and e.lease_generation = 1
  ),
  2,
  'both due rows are RUNNING with lease_generation=1'
);

select is(
  (
    select count(*)::int
    from public.service_request_enrichment_events ev
    where ev.enrichment_id in (
      select enr_a from _claim_fixture union select enr_b from _claim_fixture
    )
      and ev.event_type = 'CLAIMED'
  ),
  2,
  'CLAIMED events appended for both claims'
);

select finish();

rollback;

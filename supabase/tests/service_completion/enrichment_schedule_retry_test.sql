-- pgTAP: Task 18 — enrichment_schedule_retry next_attempt_at in expected backoff window.

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

create temp table _retry_fixture as
select
  gen_random_uuid() as sr_id,
  gen_random_uuid() as enr_id;

insert into public.service_requests (
  id, client_id, service_id, address_id, title, description,
  form_data, form_version, status, urgency
)
select
  f.sr_id, sr.client_id, sr.service_id, sr.address_id,
  'schedule retry pgTAP', sr.description, sr.form_data, sr.form_version,
  'OPEN', sr.urgency
from _retry_fixture f
join public.service_requests sr on sr.id = '7017e457-5a32-44e7-b8da-1727a14f4d33'::uuid;

insert into public.service_request_enrichments (
  id, service_request_id, status, attempt_count,
  lease_owner, lease_generation, locked_until
)
select
  enr_id, sr_id, 'RUNNING'::public.enrichment_status, 0,
  'worker-retry', 1, now() + interval '2 minutes'
from _retry_fixture;

select pg_temp.set_service_role();

create temp table _retry_result as
select public.enrichment_schedule_retry(
  (select enr_id from _retry_fixture),
  'worker-retry',
  1,
  'LLM_TRANSIENT',
  'timeout'
) as payload;

select ok(
  (select (payload->>'ok')::boolean from _retry_result),
  'schedule_retry succeeds for RUNNING+matching lease'
);

select is(
  (
    select e.status::text
    from public.service_request_enrichments e
    where e.id = (select enr_id from _retry_fixture)
  ),
  'PENDING',
  'status returns to PENDING'
);

select is(
  (
    select e.attempt_count
    from public.service_request_enrichments e
    where e.id = (select enr_id from _retry_fixture)
  ),
  1,
  'attempt_count increments to 1'
);

-- Window: now + base*2^1 + jitter[0..base] = [60, 90] seconds for base=30
select ok(
  (
    select
      e.next_attempt_at >= now() + interval '60 seconds' - interval '2 seconds'
      and e.next_attempt_at <= now() + interval '90 seconds' + interval '2 seconds'
      and e.lease_owner is null
      and e.locked_until is null
    from public.service_request_enrichments e
    where e.id = (select enr_id from _retry_fixture)
  ),
  'next_attempt_at within base*2^attempt + jitter(0..base) window; lease cleared'
);

select is(
  public.enrichment_schedule_retry(
    (select enr_id from _retry_fixture),
    'worker-retry',
    1,
    'X',
    'Y'
  )->>'reason',
  'STALE_LEASE_OR_STATE',
  'retry on non-RUNNING / stale lease is rejected'
);

select finish();

rollback;

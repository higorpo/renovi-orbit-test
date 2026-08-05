-- pgTAP: Task 27 — enqueue wake wiring: insert-only wake semantics, conflict no-op lives.

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

create temp table _fx as
select
  gen_random_uuid() as sr_id,
  gen_random_uuid() as correlation_id;

insert into public.service_requests (
  id, client_id, service_id, address_id, title, description,
  form_data, form_version, status, urgency
)
select
  f.sr_id, sr.client_id, sr.service_id, sr.address_id,
  'enqueue wake wiring',
  sr.description, sr.form_data, sr.form_version,
  'OPEN', sr.urgency
from _fx f
join public.service_requests sr on sr.id = '7017e457-5a32-44e7-b8da-1727a14f4d33'::uuid;

select pg_temp.set_service_role();

-- First enqueue inserts PENDING (wake best-effort; must not raise even if invoke unconfigured)
select lives_ok(
  $sql$
    select public.service_request_enqueue_enrichment(
      (select sr_id from _fx),
      (select correlation_id from _fx)
    )
  $sql$,
  'first enqueue lives_ok (wake best-effort)'
);

select ok(
  exists (
    select 1
    from public.service_request_enrichments e
    join _fx f on e.service_request_id = f.sr_id
    where e.status = 'PENDING'::public.enrichment_status
      and e.correlation_id = f.correlation_id
      and e.attempt_count = 0
  ),
  'first enqueue creates PENDING with correlation_id'
);

-- Second enqueue ON CONFLICT DO NOTHING — must not fail and must not reset row
select lives_ok(
  $sql$
    select public.service_request_enqueue_enrichment(
      (select sr_id from _fx),
      gen_random_uuid()
    )
  $sql$,
  'second enqueue (conflict) lives_ok — wake skipped when not inserted'
);

select is(
  (
    select count(*)::int
    from public.service_request_enrichments e
    join _fx f on e.service_request_id = f.sr_id
  ),
  1,
  'conflict does not create a second enrichment row'
);

select is(
  (
    select e.correlation_id
    from public.service_request_enrichments e
    join _fx f on e.service_request_id = f.sr_id
  ),
  (select correlation_id from _fx),
  'conflict leaves original correlation_id unchanged (no wake-driven reset)'
);

select * from finish();

rollback;

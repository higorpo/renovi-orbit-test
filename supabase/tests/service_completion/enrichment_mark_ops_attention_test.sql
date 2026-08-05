-- pgTAP: Task 21 — mark_ops_attention holds PENDING; claim skips the row.

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

create temp table _ops_fixture as
select
  gen_random_uuid() as sr_id,
  gen_random_uuid() as enr_id;

insert into public.service_requests (
  id, client_id, service_id, address_id, title, description,
  form_data, form_version, status, urgency
)
select
  f.sr_id, sr.client_id, sr.service_id, sr.address_id,
  'ops attention pgTAP', sr.description, sr.form_data, sr.form_version,
  'OPEN', sr.urgency
from _ops_fixture f
join public.service_requests sr on sr.id = '7017e457-5a32-44e7-b8da-1727a14f4d33'::uuid;

insert into public.service_request_enrichments (
  id, service_request_id, status, attempt_count,
  lease_owner, lease_generation, locked_until
)
select
  enr_id, sr_id, 'RUNNING'::public.enrichment_status, 3,
  'worker-ops', 1, now() + interval '2 minutes'
from _ops_fixture;

select pg_temp.set_service_role();

select ok(
  (
    select (public.enrichment_mark_ops_attention(
      (select enr_id from _ops_fixture),
      'TEMPLATE_CASCADE_MISSING',
      'worker-ops',
      1,
      null,
      '{}'::jsonb
    )->>'ok')::boolean
  ),
  'mark_ops_attention succeeds from RUNNING'
);

select ok(
  exists (
    select 1
    from public.service_request_enrichments e
    where e.id = (select enr_id from _ops_fixture)
      and e.status = 'PENDING'::public.enrichment_status
      and e.ops_attention_at is not null
      and e.ops_attention_reason = 'TEMPLATE_CASCADE_MISSING'
      and e.next_attempt_at is null
      and e.lease_owner is null
  ),
  'row held PENDING with ops_attention; lease cleared; next_attempt null'
);

select is(
  jsonb_array_length(
    public.enrichment_claim_batch('worker-other', 10)
  ),
  0,
  'claim_batch skips ops_attention row'
);

select ok(
  exists (
    select 1
    from public.service_request_enrichment_events ev
    where ev.enrichment_id = (select enr_id from _ops_fixture)
      and ev.event_type = 'OPS_ATTENTION'
  ),
  'OPS_ATTENTION event appended'
);

select finish();

rollback;

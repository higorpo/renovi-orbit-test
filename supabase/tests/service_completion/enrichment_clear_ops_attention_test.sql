-- pgTAP: Task 22 — clear ops_attention re-enables claim eligibility.

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

create temp table _clear_fixture as
select
  gen_random_uuid() as sr_id,
  gen_random_uuid() as enr_id;

insert into public.service_requests (
  id, client_id, service_id, address_id, title, description,
  form_data, form_version, status, urgency
)
select
  f.sr_id, sr.client_id, sr.service_id, sr.address_id,
  'clear ops attention pgTAP', sr.description, sr.form_data, sr.form_version,
  'OPEN', sr.urgency
from _clear_fixture f
join public.service_requests sr on sr.id = '7017e457-5a32-44e7-b8da-1727a14f4d33'::uuid;

insert into public.service_request_enrichments (
  id, service_request_id, status, attempt_count,
  ops_attention_at, ops_attention_reason, next_attempt_at
)
select
  enr_id, sr_id, 'PENDING'::public.enrichment_status, 3,
  now(), 'TEMPLATE_CASCADE_MISSING', null
from _clear_fixture;

select pg_temp.set_service_role();

select is(
  public.enrichment_clear_ops_attention(
    (select enr_id from _clear_fixture),
    true,
    'ops_test',
    null,
    '{}'::jsonb
  )->>'ok',
  'true',
  'clear_ops_attention succeeds'
);

select ok(
  exists (
    select 1
    from public.service_request_enrichments e
    where e.id = (select enr_id from _clear_fixture)
      and e.ops_attention_at is null
      and e.ops_attention_reason is null
      and e.next_attempt_at is not null
      and e.status = 'PENDING'::public.enrichment_status
  ),
  'ops flags cleared and next_attempt_at re-armed'
);

select is(
  jsonb_array_length(public.enrichment_claim_batch('worker-after-clear', 5)),
  1,
  'row is claimable after clear'
);

select is(
  public.enrichment_clear_ops_attention(
    (select enr_id from _clear_fixture),
    true,
    'ops_test',
    null,
    '{}'::jsonb
  )->>'noop',
  'true',
  'second clear is no-op when no ops_attention'
);

select finish();

rollback;

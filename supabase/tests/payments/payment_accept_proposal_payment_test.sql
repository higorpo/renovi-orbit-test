-- pgTAP: payment Task 25 — accept_proposal payment guards.

begin;

\ir fixtures/seed_chat.inc

select plan(1);

create or replace function pg_temp.cns_set_auth(p_user_id uuid)
returns void
language plpgsql
as $$
begin
  perform set_config('request.jwt.claim.sub', p_user_id::text, true);
  perform set_config(
    'request.jwt.claims',
    json_build_object('role', 'authenticated', 'sub', p_user_id::text)::text,
    true
  );
  perform set_config('request.jwt.claim.role', 'authenticated', true);
end;
$$;

create temp table _payment_accept_sr as
select gen_random_uuid() as service_request_id;

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
  sr_fixture.service_request_id,
  sr.client_id,
  sr.service_id,
  sr.address_id,
  'accept_proposal payment guard pgTAP',
  sr.description,
  sr.form_data,
  sr.form_version,
  'OPEN',
  sr.urgency
from _payment_accept_sr sr_fixture
cross join public.service_requests sr
where sr.id = '7017e457-5a32-44e7-b8da-1727a14f4d33'::uuid;

select pg_temp.cns_seed_chat(
  p_service_request_id := (select service_request_id from _payment_accept_sr),
  p_client_id := '28e30f1d-3c47-441f-94c6-76b6ea0db470'::uuid,
  p_provider_id := '5d09e025-20a2-4842-aeef-324d42a431e1'::uuid
);

create temp table _payment_accept_slot as
select jsonb_build_object(
  'start_date', (current_date + 7)::text,
  'end_date', (current_date + 8)::text,
  'shift', 'morning'
) as selected_slot;

select pg_temp.cns_set_auth('5d09e025-20a2-4842-aeef-324d42a431e1'::uuid);

create temp table _payment_accept_proposal as
with pricing as (
  select * from public.calculate_provider_service_pricing(500.00::numeric)
)
select public.create_provider_proposal(
  (select service_request_id from _payment_accept_sr),
  gen_random_uuid(),
  pricing.original_amount,
  'Payment accept guard proposal',
  2,
  'days',
  jsonb_build_array((select selected_slot from _payment_accept_slot)),
  '{}'::text[],
  pricing.tax_rate,
  pricing.tax_amount,
  pricing.final_amount,
  pricing.pricing_signature
) as submit_response
from pricing;

select pg_temp.cns_set_auth('28e30f1d-3c47-441f-94c6-76b6ea0db470'::uuid);

select throws_ok(
  format(
    $$ select public.accept_proposal(
      %L::uuid,
      %L::jsonb,
      %L::uuid,
      gen_random_uuid(),
      null::smallint,
      null::text,
      null::jsonb,
      null::text,
      null::text,
      null::text
    ) $$,
    (select (submit_response->'proposal'->>'id')::uuid from _payment_accept_proposal),
    (select selected_slot from _payment_accept_slot),
    gen_random_uuid()
  ),
  '22023',
  'PAYMENT_FIELDS_REQUIRED',
  'requires full payment payload when client_card_token_id is supplied'
);

select finish();

rollback;

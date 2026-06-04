-- pgTAP: resubmit after REJECTED keeps prior row terminal; new row is PENDING with bumped version.

begin;

\ir fixtures/seed_chat.inc

select plan(5);

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
end;
$$;

create or replace function pg_temp.cns_seed_resubmit_sr()
returns uuid
language plpgsql
as $$
declare
  v_sr_id uuid;
begin
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
    gen_random_uuid(),
    sr.client_id,
    sr.service_id,
    sr.address_id,
    'resubmit after reject pgTAP fixture',
    sr.description,
    sr.form_data,
    sr.form_version,
    'OPEN',
    sr.urgency
  from public.service_requests sr
  where sr.id = '7017e457-5a32-44e7-b8da-1727a14f4d33'::uuid
  returning id into v_sr_id;

  return v_sr_id;
end;
$$;

create temp table _resubmit_sr as
select pg_temp.cns_seed_resubmit_sr() as service_request_id;

create temp table _resubmit_chat as
select pg_temp.cns_seed_chat(
  p_service_request_id := (select service_request_id from _resubmit_sr),
  p_client_id := '28e30f1d-3c47-441f-94c6-76b6ea0db470'::uuid,
  p_provider_id := '5d09e025-20a2-4842-aeef-324d42a431e1'::uuid
) as chat_id;

select pg_temp.cns_set_auth('5d09e025-20a2-4842-aeef-324d42a431e1'::uuid);

create temp table _resubmit_first as
with pricing as (
  select *
  from public.calculate_provider_service_pricing(250.00::numeric)
)
select public.create_provider_proposal(
  (select service_request_id from _resubmit_sr),
  pricing.original_amount,
  'First proposal before rejection',
  2,
  'hours',
  jsonb_build_array(
    jsonb_build_object(
      'start_date', (current_date + 2)::text,
      'shift', 'morning'
    )
  ),
  '{}'::text[],
  pricing.tax_rate,
  pricing.tax_amount,
  pricing.final_amount,
  pricing.pricing_signature
) as response
from pricing;

create temp table _resubmit_first_id as
select (response->'proposal'->>'id')::uuid as proposal_id
from _resubmit_first;

select pg_temp.cns_set_auth('28e30f1d-3c47-441f-94c6-76b6ea0db470'::uuid);

select public.reject_proposal(
  (select proposal_id from _resubmit_first_id),
  'f1030001-0001-4001-8001-000000000001'::uuid,
  'Client declined first offer'
);

select pg_temp.cns_set_auth('5d09e025-20a2-4842-aeef-324d42a431e1'::uuid);

create temp table _resubmit_second as
with pricing as (
  select *
  from public.calculate_provider_service_pricing(275.00::numeric)
)
select public.create_provider_proposal(
  (select service_request_id from _resubmit_sr),
  pricing.original_amount,
  'Second proposal after rejection',
  2,
  'hours',
  jsonb_build_array(
    jsonb_build_object(
      'start_date', (current_date + 3)::text,
      'shift', 'afternoon'
    )
  ),
  '{}'::text[],
  pricing.tax_rate,
  pricing.tax_amount,
  pricing.final_amount,
  pricing.pricing_signature
) as response
from pricing;

select is(
  (
    select pp.status::text
    from public.provider_proposals pp
    where pp.id = (select proposal_id from _resubmit_first_id)
  ),
  'REJECTED',
  'rejected proposal row stays REJECTED after resubmit'
);

select is(
  (select response->'proposal'->>'status' from _resubmit_second),
  'PENDING',
  'resubmit after rejection creates new PENDING proposal'
);

select is(
  (select response->'proposal'->>'version' from _resubmit_second),
  '2',
  'resubmit after rejection increments proposal version'
);

select ok(
  (
    select count(*)::int = 2
    from public.provider_proposals pp
    where pp.provider_id = '5d09e025-20a2-4842-aeef-324d42a431e1'::uuid
      and pp.service_request_id = (select service_request_id from _resubmit_sr)
  ),
  'provider has two proposal rows after resubmit (rejected + pending)'
);

select is(
  (
    select count(*)::int
    from public.provider_proposals pp
    where pp.provider_id = '5d09e025-20a2-4842-aeef-324d42a431e1'::uuid
      and pp.service_request_id = (select service_request_id from _resubmit_sr)
      and pp.status = 'REVISED'::public.proposal_status
  ),
  0,
  'resubmit after rejection does not mark prior row as REVISED'
);

select * from finish();
rollback;

-- pgTAP: scoped visibility in get_service / list_services (via project_service_row).

begin;

\ir ../chats/fixtures/seed_chat.inc

select plan(10);

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

create or replace function pg_temp.cns_seed_scoped_sr()
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
    'scoped visibility pgTAP fixture',
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

create temp table _scoped_sr as
select pg_temp.cns_seed_scoped_sr() as service_request_id;

create temp table _scoped_providers as
select
  '28e30f1d-3c47-441f-94c6-76b6ea0db470'::uuid as client_id,
  '5d09e025-20a2-4842-aeef-324d42a431e1'::uuid as accepted_provider_id,
  '4cf92e3a-64cd-4491-998e-9163138f8e96'::uuid as other_provider_id;

create temp table _scoped_chat as
select pg_temp.cns_seed_chat(
  p_service_request_id := (select service_request_id from _scoped_sr),
  p_client_id := (select client_id from _scoped_providers),
  p_provider_id := (select accepted_provider_id from _scoped_providers)
) as chat_id;

select pg_temp.cns_set_auth((select accepted_provider_id from _scoped_providers));

create temp table _scoped_slot as
select jsonb_build_object(
  'start_date', (current_date + 2)::text,
  'shift', 'morning'
) as selected_slot;

create temp table _scoped_submit as
with pricing as (
  select *
  from public.calculate_provider_service_pricing(520.00::numeric)
)
select public.create_provider_proposal(
  (select service_request_id from _scoped_sr),
  gen_random_uuid(),
  pricing.original_amount,
  'Scoped visibility test proposal',
  4,
  'hours',
  jsonb_build_array((select selected_slot from _scoped_slot)),
  '{}'::text[],
  pricing.tax_rate,
  pricing.tax_amount,
  pricing.final_amount,
  pricing.pricing_signature
) as submit_response
from pricing;

select pg_temp.cns_set_auth((select client_id from _scoped_providers));

select public.accept_proposal(
  (select (submit_response->'proposal'->>'id')::uuid from _scoped_submit),
  (select selected_slot from _scoped_slot),
  'f3333333-3333-4333-8333-333333333333'::uuid
);

-- Client sees proposal totals and contracted summary.
select pg_temp.cns_set_auth((select client_id from _scoped_providers));

select cmp_ok(
  (select (public.get_service((select service_request_id from _scoped_sr))->'negotiation'->>'proposal_count')::int),
  '>',
  0,
  'client get_service includes proposal_count'
);

select ok(
  (select public.get_service((select service_request_id from _scoped_sr))->'contracted' ? 'id'),
  'client get_service includes contracted summary'
);

select ok(
  (
    select public.get_service((select service_request_id from _scoped_sr))->'contracted'->>'chat_id'
  ) = (select chat_id::text from _scoped_chat),
  'client get_service includes contracted chat_id'
);

select ok(
  not (select public.get_service((select service_request_id from _scoped_sr))->'request' ? 'tags'),
  'client get_service omits tags from request payload'
);

-- Winning provider sees contracted summary but not global proposal_count.
select pg_temp.cns_set_auth((select accepted_provider_id from _scoped_providers));

select ok(
  not (select public.get_service((select service_request_id from _scoped_sr))->'negotiation' ? 'proposal_count'),
  'accepted provider get_service omits proposal_count'
);

select ok(
  (select public.get_service((select service_request_id from _scoped_sr))->'contracted' ? 'id'),
  'accepted provider get_service includes contracted summary'
);

-- Other provider must not see contracted summary or proposal_count.
select pg_temp.cns_set_auth((select other_provider_id from _scoped_providers));

select ok(
  not (select public.get_service((select service_request_id from _scoped_sr))->'negotiation' ? 'proposal_count'),
  'other provider get_service omits proposal_count'
);

select ok(
  not (select public.get_service((select service_request_id from _scoped_sr))->'contracted' ? 'id'),
  'other provider get_service hides contracted summary'
);

select ok(
  not (select public.get_service((select service_request_id from _scoped_sr))->'request'->'address' ? 'street'),
  'other provider get_service keeps masked address'
);

select * from finish();
rollback;

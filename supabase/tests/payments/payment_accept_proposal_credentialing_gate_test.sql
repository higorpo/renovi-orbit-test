-- pgTAP: accept_proposal credentialing gate — non-ACTIVE providers cannot be accepted.

begin;

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

create or replace function pg_temp.cns_seed_chat(
  p_service_request_id uuid,
  p_client_id uuid,
  p_provider_id uuid
)
returns uuid
language plpgsql
as $$
declare
  v_chat_id uuid;
begin
  insert into public.chats (
    service_request_id,
    client_id,
    provider_id,
    status,
    last_interaction_at
  )
  values (
    p_service_request_id,
    p_client_id,
    p_provider_id,
    'ACTIVE',
    now()
  )
  on conflict (service_request_id, provider_id) do update
    set status = excluded.status, updated_at = now()
  returning id into v_chat_id;

  return v_chat_id;
end;
$$;

create temp table _credentialing_sr as
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
  '28e30f1d-3c47-441f-94c6-76b6ea0db470'::uuid,
  sr.service_id,
  sr.address_id,
  'accept_proposal credentialing gate pgTAP',
  sr.description,
  sr.form_data,
  sr.form_version,
  'OPEN',
  sr.urgency
from _credentialing_sr sr_fixture
cross join public.service_requests sr
where sr.id = '7017e457-5a32-44e7-b8da-1727a14f4d33'::uuid;

-- Seed provider exists in profiles; strip NetCred row so onboarding is not ACTIVE.
delete from public.provider_gateway_accounts
where provider_id = '5d09e025-20a2-4842-aeef-324d42a431e1'::uuid;

select pg_temp.cns_seed_chat(
  (select service_request_id from _credentialing_sr),
  '28e30f1d-3c47-441f-94c6-76b6ea0db470'::uuid,
  '5d09e025-20a2-4842-aeef-324d42a431e1'::uuid
);

create temp table _credentialing_slot as
select jsonb_build_object(
  'start_date', (current_date + 7)::text,
  'end_date', (current_date + 7)::text,
  'shift', 'morning'
) as selected_slot;

select pg_temp.cns_set_auth('5d09e025-20a2-4842-aeef-324d42a431e1'::uuid);

create temp table _credentialing_proposal as
with pricing as (
  select * from public.calculate_provider_service_pricing(500.00::numeric)
)
select public.create_provider_proposal(
  (select service_request_id from _credentialing_sr),
  gen_random_uuid(),
  pricing.original_amount,
  'Credentialing gate proposal',
  1,
  'days',
  jsonb_build_array((select selected_slot from _credentialing_slot)),
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
      %L::uuid
    ) $$,
    (select (submit_response->'proposal'->>'id')::uuid from _credentialing_proposal),
    (select selected_slot from _credentialing_slot),
    gen_random_uuid()
  ),
  'P0001',
  'PROVIDER_NOT_CREDENTIALED',
  'denies accept_proposal for non-ACTIVE provider even without payment payload'
);

select finish();

rollback;

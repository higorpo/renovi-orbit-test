-- pgTAP: payment Task 24 — payment_reschedule_charge_date RPC.

begin;

select plan(3);

create or replace function pg_temp.payment_set_service_role()
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

create or replace function pg_temp.payment_set_provider_auth(p_user_id uuid)
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

select throws_ok(
  $$ select public.payment_reschedule_charge_date(gen_random_uuid()) $$,
  '42501',
  'service_role required for payment_reschedule_charge_date',
  'rejects non-service_role callers'
);

select pg_temp.payment_set_service_role();

select throws_ok(
  $$ select public.payment_reschedule_charge_date(gen_random_uuid()) $$,
  'P0002',
  'CONTRACTED_SERVICE_NOT_FOUND',
  'raises when contracted service is missing'
);

create temp table _reschedule_fixture as
select
  gen_random_uuid() as service_request_id,
  gen_random_uuid() as contracted_service_id;

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
  f.service_request_id,
  sr.client_id,
  sr.service_id,
  sr.address_id,
  'reschedule charge date pgTAP fixture',
  sr.description,
  sr.form_data,
  sr.form_version,
  'OPEN',
  sr.urgency
from _reschedule_fixture f
cross join public.service_requests sr
where sr.id = '7017e457-5a32-44e7-b8da-1727a14f4d33'::uuid;

create temp table _reschedule_slot as
select jsonb_build_object(
  'start_date', (current_date + 7)::text,
  'end_date', (current_date + 8)::text,
  'shift', 'morning'
) as selected_slot;

select pg_temp.payment_set_provider_auth('5d09e025-20a2-4842-aeef-324d42a431e1'::uuid);

create temp table _reschedule_proposal as
with pricing as (
  select * from public.calculate_provider_service_pricing(500.00::numeric)
)
select
  (public.create_provider_proposal(
    (select service_request_id from _reschedule_fixture),
    gen_random_uuid(),
    pricing.original_amount,
    'reschedule pgTAP proposal',
    2,
    'days',
    jsonb_build_array((select selected_slot from _reschedule_slot)),
    '{}'::text[],
    pricing.tax_rate,
    pricing.tax_amount,
    pricing.final_amount,
    pricing.pricing_signature
  )->'proposal'->>'id')::uuid as id
from pricing;

select pg_temp.payment_set_service_role();

insert into public.contracted_services (
  id,
  service_request_id,
  accepted_proposal_id,
  client_id,
  provider_id,
  duration_unit,
  duration_value,
  scheduled_start_date,
  scheduled_end_date,
  scheduled_shift,
  agreed_slot,
  status
)
select
  f.contracted_service_id,
  f.service_request_id,
  p.id,
  '28e30f1d-3c47-441f-94c6-76b6ea0db470'::uuid,
  '5d09e025-20a2-4842-aeef-324d42a431e1'::uuid,
  'days',
  1,
  current_date + 7,
  current_date + 7,
  'morning',
  (select selected_slot from _reschedule_slot),
  'PENDING_PAYMENT'::public.contracted_service_status
from _reschedule_fixture f
cross join _reschedule_proposal p;

select is(
  public.payment_reschedule_charge_date(
    (select contracted_service_id from _reschedule_fixture)
  )->>'outcome',
  'no_schedule',
  'returns no_schedule when payment_schedules row is missing'
);

select finish();

rollback;

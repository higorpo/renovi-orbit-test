-- pgTAP: accept_proposal succeeds when day slot matches duration via working days only.

begin;

\ir fixtures/seed_chat.inc
\ir ../fixtures/accept_proposal_payment_helpers.inc

select plan(3);

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

create temp table _working_days_sr as
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
  wd.service_request_id,
  sr.client_id,
  sr.service_id,
  sr.address_id,
  'accept_proposal working days pgTAP fixture',
  sr.description,
  sr.form_data,
  sr.form_version,
  'OPEN',
  sr.urgency
from _working_days_sr wd
cross join public.service_requests sr
where sr.id = '7017e457-5a32-44e7-b8da-1727a14f4d33'::uuid;

select pg_temp.cns_seed_chat(
  p_service_request_id := (select service_request_id from _working_days_sr),
  p_client_id := '28e30f1d-3c47-441f-94c6-76b6ea0db470'::uuid,
  p_provider_id := '5d09e025-20a2-4842-aeef-324d42a431e1'::uuid
);

-- Thu through Tue (+5 days): 6 calendar days, 4 working days (one weekend inside).
create temp table _working_days_slot as
select jsonb_build_object(
  'start_date',
  (
    current_date
    + (
      (4 - extract(isodow from current_date)::int + 7) % 7
    )::int
  )::text,
  'end_date',
  (
    current_date
    + (
      (4 - extract(isodow from current_date)::int + 7) % 7
    )::int
    + 5
  )::text,
  'shift', 'afternoon'
) as selected_slot;

select pg_temp.cns_set_auth('5d09e025-20a2-4842-aeef-324d42a431e1'::uuid);

create temp table _working_days_submit as
with pricing as (
  select *
  from public.calculate_provider_service_pricing(500.00::numeric)
)
select public.create_provider_proposal(
  (select service_request_id from _working_days_sr),
  gen_random_uuid(),
  pricing.original_amount,
  'Working days accept test proposal',
  4,
  'days',
  jsonb_build_array((select selected_slot from _working_days_slot)),
  '{}'::text[],
  pricing.tax_rate,
  pricing.tax_amount,
  pricing.final_amount,
  pricing.pricing_signature
) as submit_response
from pricing;

select pg_temp.cns_set_auth('28e30f1d-3c47-441f-94c6-76b6ea0db470'::uuid);

create temp table _working_days_accept as
select pg_temp.cns_accept_proposal_with_payment(
  (select (submit_response->'proposal'->>'id')::uuid from _working_days_submit),
  (select selected_slot from _working_days_slot),
  'a3333333-3333-4333-8333-333333333333'::uuid
) as response;

select is(
  (select response->'proposal'->>'status' from _working_days_accept),
  'ACCEPTED',
  'accept succeeds for working-days-only day slot'
);

select ok(
  (
    select exists (
      select 1
      from public.contracted_services cs
      cross join _working_days_slot slot
      where cs.id = (select (response->'service'->>'id')::uuid from _working_days_accept)
        and cs.duration_unit = 'days'
        and cs.duration_value = 4
        and cs.scheduled_start_date = (slot.selected_slot->>'start_date')::date
        and cs.scheduled_end_date = (slot.selected_slot->>'end_date')::date
    )
  ),
  'accept inserts contracted service with working-days duration span'
);

select ok(
  (
    select (
      (
        (slot.selected_slot->>'end_date')::date
        - (slot.selected_slot->>'start_date')::date
        + 1
      ) = 4
      or public.count_inclusive_working_days(
        (slot.selected_slot->>'start_date')::date,
        (slot.selected_slot->>'end_date')::date
      ) = 4
    )
    from _working_days_slot slot
  ),
  'fixture slot satisfies contracted_services_days_slot_shape'
);

select finish();

rollback;

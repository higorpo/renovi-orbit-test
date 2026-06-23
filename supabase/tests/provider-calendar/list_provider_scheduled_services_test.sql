-- pgTAP: list_provider_scheduled_services (provider calendar RPC).

begin;

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

create or replace function pg_temp.cns_seed_calendar_sr()
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
    'provider calendar pgTAP fixture',
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
    set updated_at = now()
  returning id into v_chat_id;

  return v_chat_id;
end;
$$;

select ok(
  (
    select p.prosecdef
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname = 'list_provider_scheduled_services'
  ),
  'list_provider_scheduled_services is SECURITY DEFINER'
);

select pg_temp.cns_set_auth('28e30f1d-3c47-441f-94c6-76b6ea0db470'::uuid);

select throws_ok(
  $$select public.list_provider_scheduled_services('2026-06-01'::date, '2026-06-07'::date)$$,
  '42501',
  'Provider access only',
  'client cannot call provider calendar RPC'
);

create temp table _calendar_sr as
select pg_temp.cns_seed_calendar_sr() as service_request_id;

select pg_temp.cns_seed_chat(
  (select service_request_id from _calendar_sr),
  '28e30f1d-3c47-441f-94c6-76b6ea0db470'::uuid,
  '5d09e025-20a2-4842-aeef-324d42a431e1'::uuid
);

create temp table _calendar_slot as
select jsonb_build_object(
  'start_date', (current_date + 10)::text,
  'end_date', (current_date + 12)::text,
  'shift', 'morning'
) as selected_slot;

select pg_temp.cns_set_auth('5d09e025-20a2-4842-aeef-324d42a431e1'::uuid);

create temp table _calendar_submit as
with pricing as (
  select *
  from public.calculate_provider_service_pricing(400.00::numeric)
)
select public.create_provider_proposal(
  (select service_request_id from _calendar_sr),
  gen_random_uuid(),
  pricing.original_amount,
  'Provider calendar test proposal',
  3,
  'days',
  jsonb_build_array((select selected_slot from _calendar_slot)),
  '{}'::text[],
  pricing.tax_rate,
  pricing.tax_amount,
  pricing.final_amount,
  pricing.pricing_signature
) as submit_response
from pricing;

select pg_temp.cns_set_auth('28e30f1d-3c47-441f-94c6-76b6ea0db470'::uuid);

select public.accept_proposal(
  (select (submit_response->'proposal'->>'id')::uuid from _calendar_submit),
  (select selected_slot from _calendar_slot),
  gen_random_uuid()
);

select pg_temp.cns_set_auth('5d09e025-20a2-4842-aeef-324d42a431e1'::uuid);

select is(
  public.list_provider_scheduled_services(
    (current_date + 11)::date,
    (current_date + 11)::date
  )->'items'->0->>'scheduled_end_date',
  (current_date + 12)::text,
  'middle day of multi-day service is included in range'
);

select is(
  (
    select public.list_provider_scheduled_services(
      (current_date + 10)::date,
      (current_date + 12)::date
    )->'items'->0->>'title'
  ),
  'provider calendar pgTAP fixture',
  'returns service request title for scheduled item'
);

select throws_ok(
  format(
    'select public.list_provider_scheduled_services(%L::date, %L::date)',
    current_date,
    current_date + 50
  ),
  '22023',
  'Date range exceeds maximum span of 42 days',
  'rejects ranges wider than 42 days'
);

select * from finish();
rollback;

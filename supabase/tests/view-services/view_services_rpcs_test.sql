-- pgTAP: get_service + list_services (view-services unified RPCs).

begin;

\ir ../chats/fixtures/seed_chat.inc

select plan(17);

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

create or replace function pg_temp.cns_seed_view_services_sr()
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
    'view_services pgTAP fixture',
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

select ok(
  (
    select p.prosecdef
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname = 'get_service'
  ),
  'get_service is SECURITY DEFINER'
);

select ok(
  (
    select p.prosecdef
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname = 'list_services'
  ),
  'list_services is SECURITY DEFINER'
);

select ok(
  to_regclass('public.contracted_services') is not null,
  'contracted_services table exists after rename'
);

create temp table _vs_sr as
select pg_temp.cns_seed_view_services_sr() as service_request_id;

-- Client can fetch own open service
select pg_temp.cns_set_auth('28e30f1d-3c47-441f-94c6-76b6ea0db470'::uuid);

select is(
  (select public.get_service((select service_request_id from _vs_sr))->>'list_phase'),
  'negotiation',
  'client get_service returns negotiation for OPEN SR'
);

select is(
  (select public.get_service((select service_request_id from _vs_sr))->'request'->>'title'),
  'view_services pgTAP fixture',
  'client get_service returns request title'
);

select ok(
  (select public.get_service((select service_request_id from _vs_sr))->'request'->'address' ? 'street'),
  'client get_service returns full address with street'
);

-- Any logged-in provider can get_service before involvement
select pg_temp.cns_set_auth('5d09e025-20a2-4842-aeef-324d42a431e1'::uuid);

select is(
  (select public.get_service((select service_request_id from _vs_sr))->'request'->>'title'),
  'view_services pgTAP fixture',
  'provider without involvement can get_service'
);

select ok(
  not (select public.get_service((select service_request_id from _vs_sr))->'request'->'address' ? 'street'),
  'provider without acceptance does not receive street in address'
);

select is(
  (select public.get_service((select service_request_id from _vs_sr))->'request'->'address'->>'city_name'),
  'Florianópolis',
  'provider without acceptance receives city_name'
);

-- Unrelated non-provider still denied
select pg_temp.cns_set_auth('00000000-0000-0000-0000-000000000099'::uuid);

select throws_ok(
  format(
    'select public.get_service(%L)',
    (select service_request_id from _vs_sr)
  ),
  '42501',
  'Service not found or access denied',
  'unrelated viewer cannot get_service'
);

-- Provider with chat/proposal access
select pg_temp.cns_set_auth('5d09e025-20a2-4842-aeef-324d42a431e1'::uuid);

create temp table _vs_chat as
select pg_temp.cns_seed_chat(
  p_service_request_id := (select service_request_id from _vs_sr),
  p_client_id := '28e30f1d-3c47-441f-94c6-76b6ea0db470'::uuid,
  p_provider_id := '5d09e025-20a2-4842-aeef-324d42a431e1'::uuid
) as chat_id;

create temp table _vs_proposal as
with pricing as (
  select *
  from public.calculate_provider_service_pricing(250.00::numeric)
)
select public.create_provider_proposal(
  (select service_request_id from _vs_sr),
  pricing.original_amount,
  'view_services pgTAP scope',
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

select is(
  (select public.get_service((select service_request_id from _vs_sr))->>'list_phase'),
  'negotiation',
  'provider with proposal get_service returns negotiation'
);

select cmp_ok(
  (select (public.get_service((select service_request_id from _vs_sr))->'negotiation'->>'proposal_count')::int),
  '>=',
  1,
  'provider sees own proposal count'
);

select ok(
  not (select public.get_service((select service_request_id from _vs_sr))->'request'->'address' ? 'street'),
  'provider with pending proposal still has masked address'
);

-- list_services: client scope and phase filter
select pg_temp.cns_set_auth('28e30f1d-3c47-441f-94c6-76b6ea0db470'::uuid);

select ok(
  exists (
    select 1
    from jsonb_array_elements(
      public.list_services(
        p_page := 1,
        p_page_size := 20,
        p_list_phase := 'negotiation'
      )->'items'
    ) elem
    where elem->>'id' = (select service_request_id::text from _vs_sr)
  ),
  'client list_services negotiation includes seeded SR'
);

select cmp_ok(
  (select (public.list_services(
    p_page := 1,
    p_page_size := 20,
    p_list_phase := 'negotiation',
    p_search := 'view_services pgtap'
  )->>'total_count')::bigint),
  '>=',
  1::bigint,
  'client list_services search matches fixture title'
);

select ok(
  not exists (
    select 1
    from jsonb_array_elements(
      public.list_services(
        p_page := 1,
        p_page_size := 50,
        p_list_phase := 'completed'
      )->'items'
    ) elem
    where elem->>'id' = (select service_request_id::text from _vs_sr)
  ),
  'client list_services completed excludes open fixture'
);

-- Provider list includes SR with proposal
select pg_temp.cns_set_auth('5d09e025-20a2-4842-aeef-324d42a431e1'::uuid);

select ok(
  exists (
    select 1
    from jsonb_array_elements(
      public.list_services(p_page := 1, p_page_size := 50)->'items'
    ) elem
    where elem->>'id' = (select service_request_id::text from _vs_sr)
  ),
  'provider list_services includes SR with proposal'
);

select * from finish();

rollback;

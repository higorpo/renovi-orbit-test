-- pgTAP: batch feed excludes opportunities when provider removed offered service.

begin;

select plan(3);

select set_config('request.jwt.claim.role', 'service_role', true);
select set_config('test.provider_id', '4cf92e3a-64cd-4491-998e-9163138f8e96', true);
select set_config('test.service_id', 'f5eebc99-9c0b-4ef8-bb6d-6bb9bd380a62', true);

create or replace function pg_temp.matching_seed_open_service_request()
returns uuid
language plpgsql
as $$
declare
  v_sr_id uuid;
begin
  insert into public.service_requests (
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
    sr.client_id,
    sr.service_id,
    sr.address_id,
    'offered service batch feed fixture',
    sr.description,
    sr.form_data,
    sr.form_version,
    'OPEN'::public.service_request_status,
    sr.urgency
  from public.service_requests sr
  where sr.id = '7017e457-5a32-44e7-b8da-1727a14f4d33'::uuid
  returning id into v_sr_id;

  return v_sr_id;
end;
$$;

create temp table _offered_sr as
select pg_temp.matching_seed_open_service_request() as service_request_id;

insert into public.service_request_provider_visibility (
  service_request_id,
  provider_id,
  source,
  granted_at
)
values (
  (select service_request_id from _offered_sr),
  current_setting('test.provider_id')::uuid,
  'batch',
  now()
);

select ok(
  exists (
    select 1
    from public.provider_offered_services pos
    where pos.provider_id = current_setting('test.provider_id')::uuid
      and pos.service_id = current_setting('test.service_id')::uuid
  ),
  'fixture: provider still offers the service request service'
);

select ok(
  exists (
    select 1
    from jsonb_array_elements(
      public.list_provider_opportunities(current_setting('test.provider_id')::uuid)->'items'
    ) item
    where (item->>'service_request_id')::uuid = (select service_request_id from _offered_sr)
  ),
  'batch visibility returns fixture opportunity while service is offered'
);

delete from public.provider_offered_services
where provider_id = current_setting('test.provider_id')::uuid
  and service_id = current_setting('test.service_id')::uuid;

select ok(
  not exists (
    select 1
    from jsonb_array_elements(
      public.list_provider_opportunities(current_setting('test.provider_id')::uuid)->'items'
    ) item
    where (item->>'service_request_id')::uuid = (select service_request_id from _offered_sr)
  ),
  'fixture opportunity hidden after provider removes offered service'
);

select finish();

rollback;

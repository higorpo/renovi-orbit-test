-- pgTAP: record_provider_opportunity_view audit RPC (matching M12d).

begin;

select plan(3);

\ir ../rls/fixtures/seed_rls_actors.inc

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
    'matching view audit pgTAP fixture',
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

create temp table _view_sr as
select pg_temp.matching_seed_open_service_request() as service_request_id;

select set_config(
  'test.record.view_sr_id',
  (select service_request_id::text from _view_sr),
  true
);

select pg_temp.rls_set_auth('4cf92e3a-64cd-4491-998e-9163138f8e96'::uuid);

select is(
  public.record_provider_opportunity_view(current_setting('test.record.view_sr_id')::uuid),
  jsonb_build_object('success', true),
  'returns success payload'
);

select public.record_provider_opportunity_view(current_setting('test.record.view_sr_id')::uuid);

reset role;

select is(
  (
    select count(*)::int
    from public.service_request_dispatch_events e
    where e.service_request_id = current_setting('test.record.view_sr_id')::uuid
      and e.provider_id = '4cf92e3a-64cd-4491-998e-9163138f8e96'::uuid
      and e.event_type = 'provider_viewed'
  ),
  1,
  'double call records a single provider_viewed event'
);

select pg_temp.rls_set_auth('28e30f1d-3c47-441f-94c6-76b6ea0db470'::uuid);

select throws_ok(
  $$
    select public.record_provider_opportunity_view(
      current_setting('test.record.view_sr_id')::uuid
    )
  $$,
  '42501',
  null,
  'non-provider caller is rejected'
);

select finish();

rollback;

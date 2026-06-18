-- pgTAP: dismiss_provider_opportunity feed RPC (matching M12e).

begin;

reset role;

select plan(4);

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
    'matching dismiss pgTAP fixture',
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

create temp table _batch_sr as
select pg_temp.matching_seed_open_service_request() as service_request_id;

create temp table _fallback_sr as
select pg_temp.matching_seed_open_service_request() as service_request_id;

select set_config(
  'test.dismiss.batch_sr_id',
  (select service_request_id::text from _batch_sr),
  true
);
select set_config(
  'test.dismiss.fallback_sr_id',
  (select service_request_id::text from _fallback_sr),
  true
);

insert into public.service_request_provider_visibility (
  service_request_id,
  provider_id,
  source,
  granted_at
)
values (
  current_setting('test.dismiss.batch_sr_id')::uuid,
  '4cf92e3a-64cd-4491-998e-9163138f8e96'::uuid,
  'batch',
  now()
);

update public.service_request_dispatches
set
  status = 'DISPATCH_FALLBACK_OPEN_MARKET'::public.service_request_dispatch_status,
  fallback_opened_at = now(),
  next_batch_at = null
where service_request_id = current_setting('test.dismiss.fallback_sr_id')::uuid;

select pg_temp.rls_set_auth('4cf92e3a-64cd-4491-998e-9163138f8e96'::uuid);

select public.dismiss_provider_opportunity(current_setting('test.dismiss.batch_sr_id')::uuid);

reset role;

select ok(
  (
    select v.dismissed_at is not null
    from public.service_request_provider_visibility v
    where v.service_request_id = current_setting('test.dismiss.batch_sr_id')::uuid
      and v.provider_id = '4cf92e3a-64cd-4491-998e-9163138f8e96'::uuid
      and v.source = 'batch'
  ),
  'batch visibility dismiss sets dismissed_at'
);

select public.dismiss_provider_opportunity(current_setting('test.dismiss.batch_sr_id')::uuid);

select is(
  (
    select count(*)::int
    from public.service_request_dispatch_events e
    where e.service_request_id = current_setting('test.dismiss.batch_sr_id')::uuid
      and e.provider_id = '4cf92e3a-64cd-4491-998e-9163138f8e96'::uuid
      and e.event_type = 'provider_declined'
  ),
  1,
  'repeat dismiss is idempotent for provider_declined event'
);

select public.dismiss_provider_opportunity(current_setting('test.dismiss.fallback_sr_id')::uuid);

select ok(
  exists (
    select 1
    from public.service_request_provider_visibility v
    where v.service_request_id = current_setting('test.dismiss.fallback_sr_id')::uuid
      and v.provider_id = '4cf92e3a-64cd-4491-998e-9163138f8e96'::uuid
      and v.source = 'fallback_dismiss'
      and v.dismissed_at is not null
  ),
  'fallback-only opportunity inserts fallback_dismiss visibility row'
);

select is(
  public.dismiss_provider_opportunity(current_setting('test.dismiss.fallback_sr_id')::uuid),
  jsonb_build_object('success', true),
  'repeat fallback dismiss returns success'
);

select finish();

rollback;

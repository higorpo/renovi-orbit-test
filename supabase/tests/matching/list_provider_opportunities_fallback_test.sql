-- pgTAP: list_provider_opportunities fallback arm (matching M12b).

begin;

select plan(3);

select set_config('request.jwt.claim.role', 'service_role', true);

-- Clear leftover batch visibility so opportunity counts stay exact.
delete from public.service_request_provider_visibility
where provider_id = '4cf92e3a-64cd-4491-998e-9163138f8e96'::uuid;

-- Close leftover fallback-open market from crons/prior committed state.
update public.service_request_dispatches
set
  status = 'DISPATCH_EXPIRED'::public.service_request_dispatch_status,
  fallback_opened_at = null,
  next_batch_at = null
where fallback_opened_at is not null
   or status = 'DISPATCH_FALLBACK_OPEN_MARKET'::public.service_request_dispatch_status;

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
    'matching fallback feed pgTAP fixture',
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

create temp table _fallback_sr as
select pg_temp.matching_seed_open_service_request() as service_request_id;

update public.service_request_dispatches
set
  status = 'DISPATCH_FALLBACK_OPEN_MARKET'::public.service_request_dispatch_status,
  fallback_opened_at = now() - interval '1 hour',
  next_batch_at = null
where service_request_id = (select service_request_id from _fallback_sr);

select is(
  (
    select jsonb_path_query_first(
      public.list_provider_opportunities('4cf92e3a-64cd-4491-998e-9163138f8e96'::uuid),
      '$.items[*] ? (@.service_request_id == $sr_id).source',
      jsonb_build_object('sr_id', (select service_request_id from _fallback_sr)::text)
    ) #>> '{}'
  ),
  'fallback',
  'lazy fallback is visible when fallback_opened_at is set'
);

select is(
  (
    select jsonb_path_query_first(
      public.list_provider_opportunities('4cf92e3a-64cd-4491-998e-9163138f8e96'::uuid),
      '$.items[*] ? (@.service_request_id == $sr_id).service_icon_key',
      jsonb_build_object('sr_id', (select service_request_id from _fallback_sr)::text)
    ) #>> '{}'
  ),
  'Zap',
  'fallback feed item includes service_icon_key from platform_services'
);

update public.service_request_dispatches
set status = 'DISPATCH_EXPIRED'::public.service_request_dispatch_status
where service_request_id = (select service_request_id from _fallback_sr);

select is(
  jsonb_array_length(
    public.list_provider_opportunities('4cf92e3a-64cd-4491-998e-9163138f8e96'::uuid)->'items'
  ),
  0,
  'lazy fallback hidden after dispatch expires when provider has no batch visibility'
);

select finish();

rollback;

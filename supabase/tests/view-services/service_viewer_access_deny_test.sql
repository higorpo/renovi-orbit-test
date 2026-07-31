-- pgTAP: any authenticated provider with the link can get_service; non-providers denied.
-- Uses set_config for IDs so authenticated role can read them (temp tables are not).

begin;

select plan(4);

create or replace function pg_temp.cns_set_auth(p_user_id uuid)
returns void
language plpgsql
as $$
begin
  reset role;
  execute 'set local role authenticated';
  perform set_config('request.jwt.claim.sub', p_user_id::text, true);
  perform set_config(
    'request.jwt.claims',
    json_build_object('role', 'authenticated', 'sub', p_user_id::text)::text,
    true
  );
end;
$$;

do $seed$
declare
  v_client uuid := '28e30f1d-3c47-441f-94c6-76b6ea0db470'::uuid;
  v_provider uuid := '5d09e025-20a2-4842-aeef-324d42a431e1'::uuid;
  v_other_provider uuid := '4cf92e3a-64cd-4491-998e-9163138f8e96'::uuid;
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
    'service_viewer shared link fixture',
    sr.description,
    sr.form_data,
    sr.form_version,
    'OPEN'::public.service_request_status,
    sr.urgency
  from public.service_requests sr
  where sr.id = '7017e457-5a32-44e7-b8da-1727a14f4d33'::uuid
  returning id into v_sr_id;

  perform set_config('test.sva.sr_id', v_sr_id::text, true);
  perform set_config('test.sva.client_id', v_client::text, true);
  perform set_config('test.sva.provider_id', v_provider::text, true);
  perform set_config('test.sva.other_provider_id', v_other_provider::text, true);
end;
$seed$;

-- Client owner
select pg_temp.cns_set_auth(current_setting('test.sva.client_id')::uuid);
select is(
  (select public.get_service(current_setting('test.sva.sr_id')::uuid)->'request'->>'title'),
  'service_viewer shared link fixture',
  'client owner can get_service'
);

-- Provider without matching opportunity / proposal still allowed (shared link).
select pg_temp.cns_set_auth(current_setting('test.sva.other_provider_id')::uuid);
select is(
  (select public.get_service(current_setting('test.sva.sr_id')::uuid)->'request'->>'title'),
  'service_viewer shared link fixture',
  'provider without opportunity can get_service via link'
);

select ok(
  not (
    select public.get_service(current_setting('test.sva.sr_id')::uuid)->'request'->'address' ? 'street'
  ),
  'provider without acceptance gets masked address (no street)'
);

-- Non-provider unrelated user denied
select pg_temp.cns_set_auth('00000000-0000-0000-0000-000000000099'::uuid);
select throws_ok(
  format(
    'select public.get_service(%L)',
    current_setting('test.sva.sr_id')
  ),
  '42501',
  'Service not found or access denied',
  'non-provider unrelated viewer cannot get_service'
);

select * from finish();

rollback;

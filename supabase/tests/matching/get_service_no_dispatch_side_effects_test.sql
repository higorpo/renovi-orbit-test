-- pgTAP: get_service must not write dispatch audit events (Req 11.3, #92, task 74).
-- record_provider_opportunity_view is the dedicated audit path (task 20).

begin;

select plan(3);

create or replace function pg_temp.gs_no_audit_set_auth(p_user_id uuid)
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

create or replace function pg_temp.gs_no_audit_seed_sr()
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
    'get_service no dispatch side effects fixture',
    sr.description,
    sr.form_data,
    sr.form_version,
    'OPEN'::public.service_request_status,
    sr.urgency
  from public.service_requests sr
  where sr.id = '7017e457-5a32-44e7-b8da-1727a14f4d33'::uuid
  returning id into v_sr_id;

  insert into public.service_request_provider_visibility (
    service_request_id,
    provider_id,
    source,
    granted_at
  )
  values (
    v_sr_id,
    '4cf92e3a-64cd-4491-998e-9163138f8e96'::uuid,
    'batch',
    now()
  );

  return v_sr_id;
end;
$$;

select set_config(
  'test.gs_no_audit.sr_id',
  pg_temp.gs_no_audit_seed_sr()::text,
  true
);
select set_config(
  'test.gs_no_audit.provider_id',
  '4cf92e3a-64cd-4491-998e-9163138f8e96'::text,
  true
);

select set_config(
  'test.gs_no_audit.viewed_before',
  (
    select count(*)::text
    from public.service_request_dispatch_events e
    where e.service_request_id = current_setting('test.gs_no_audit.sr_id')::uuid
      and e.provider_id = current_setting('test.gs_no_audit.provider_id')::uuid
      and e.event_type = 'provider_viewed'
  ),
  true
);

select set_config(
  'test.gs_no_audit.events_before',
  (
    select count(*)::text
    from public.service_request_dispatch_events e
    where e.service_request_id = current_setting('test.gs_no_audit.sr_id')::uuid
      and e.provider_id = current_setting('test.gs_no_audit.provider_id')::uuid
  ),
  true
);

select pg_temp.gs_no_audit_set_auth(current_setting('test.gs_no_audit.provider_id')::uuid);

select ok(
  (select public.get_service(current_setting('test.gs_no_audit.sr_id')::uuid)->'request' ? 'title'),
  'provider can invoke get_service for visible opportunity'
);

select is(
  (
    select count(*)::int
    from public.service_request_dispatch_events e
    where e.service_request_id = current_setting('test.gs_no_audit.sr_id')::uuid
      and e.provider_id = current_setting('test.gs_no_audit.provider_id')::uuid
      and e.event_type = 'provider_viewed'
  ),
  current_setting('test.gs_no_audit.viewed_before')::int,
  'get_service does not insert provider_viewed dispatch events'
);

select is(
  (
    select count(*)::int
    from public.service_request_dispatch_events e
    where e.service_request_id = current_setting('test.gs_no_audit.sr_id')::uuid
      and e.provider_id = current_setting('test.gs_no_audit.provider_id')::uuid
  ),
  current_setting('test.gs_no_audit.events_before')::int,
  'get_service does not insert any dispatch audit events for provider'
);

select finish();

rollback;

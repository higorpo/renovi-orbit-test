-- pgTAP: feed audit RPCs — view + dismiss idempotency (matching task 42).

begin;

select plan(6);

create or replace function pg_temp.feed_set_auth(p_user_id uuid)
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

create or replace function pg_temp.feed_seed_open_service_request()
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
    'feed audit pgTAP fixture',
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
select pg_temp.feed_seed_open_service_request() as service_request_id;

select set_config(
  'pgtap.feed_view_sr_id',
  (select service_request_id::text from _view_sr),
  true
);

select pg_temp.feed_set_auth('4cf92e3a-64cd-4491-998e-9163138f8e96'::uuid);

select is(
  public.record_provider_opportunity_view((select service_request_id from _view_sr)),
  jsonb_build_object('success', true),
  'record_provider_opportunity_view returns success'
);

select public.record_provider_opportunity_view((select service_request_id from _view_sr));

select is(
  (
    select count(*)::int
    from public.service_request_dispatch_events e
    where e.service_request_id = (select service_request_id from _view_sr)
      and e.provider_id = '4cf92e3a-64cd-4491-998e-9163138f8e96'::uuid
      and e.event_type = 'provider_viewed'
  ),
  1,
  'repeat view records a single provider_viewed event'
);

select pg_temp.feed_set_auth('28e30f1d-3c47-441f-94c6-76b6ea0db470'::uuid);

select throws_ok(
  $$
    select public.record_provider_opportunity_view(
      current_setting('pgtap.feed_view_sr_id')::uuid
    )
  $$,
  '42501',
  null,
  'non-provider caller cannot record opportunity views'
);

create temp table _batch_sr as
select pg_temp.feed_seed_open_service_request() as service_request_id;

insert into public.service_request_provider_visibility (
  service_request_id,
  provider_id,
  source,
  granted_at
)
values (
  (select service_request_id from _batch_sr),
  '4cf92e3a-64cd-4491-998e-9163138f8e96'::uuid,
  'batch',
  now()
);

select pg_temp.feed_set_auth('4cf92e3a-64cd-4491-998e-9163138f8e96'::uuid);

select public.dismiss_provider_opportunity((select service_request_id from _batch_sr));

select ok(
  (
    select v.dismissed_at is not null
    from public.service_request_provider_visibility v
    where v.service_request_id = (select service_request_id from _batch_sr)
      and v.provider_id = '4cf92e3a-64cd-4491-998e-9163138f8e96'::uuid
      and v.source = 'batch'
  ),
  'dismiss sets dismissed_at on batch visibility'
);

select public.dismiss_provider_opportunity((select service_request_id from _batch_sr));

select is(
  (
    select count(*)::int
    from public.service_request_dispatch_events e
    where e.service_request_id = (select service_request_id from _batch_sr)
      and e.provider_id = '4cf92e3a-64cd-4491-998e-9163138f8e96'::uuid
      and e.event_type = 'provider_declined'
  ),
  1,
  'repeat dismiss records a single provider_declined event'
);

create temp table _fallback_sr as
select pg_temp.feed_seed_open_service_request() as service_request_id;

update public.service_request_dispatches
set
  status = 'DISPATCH_FALLBACK_OPEN_MARKET'::public.service_request_dispatch_status,
  fallback_opened_at = now(),
  next_batch_at = null
where service_request_id = (select service_request_id from _fallback_sr);

select pg_temp.feed_set_auth('4cf92e3a-64cd-4491-998e-9163138f8e96'::uuid);

select public.dismiss_provider_opportunity((select service_request_id from _fallback_sr));

select ok(
  exists (
    select 1
    from public.service_request_provider_visibility v
    where v.service_request_id = (select service_request_id from _fallback_sr)
      and v.provider_id = '4cf92e3a-64cd-4491-998e-9163138f8e96'::uuid
      and v.source = 'fallback_dismiss'
      and v.dismissed_at is not null
  ),
  'fallback dismiss inserts fallback_dismiss visibility marker'
);

select finish();

rollback;

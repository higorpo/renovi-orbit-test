-- pgTAP: partial push fan-out → parent DELIVERED + partial_failures metadata (design §8.4, task 67).

begin;

select plan(6);

create temp table _partial_push_fixture as
select p.id as profile_id, gen_random_uuid() as dispatch_id
from public.profiles p
limit 1;

create temp table _partial_deliveries (
  delivery_id uuid primary key default gen_random_uuid(),
  device_id text not null
);

insert into _partial_deliveries (device_id)
values
  ('device-ok-1'),
  ('device-ok-2'),
  ('device-bad-token');

insert into public.user_device_beacons (
  profile_id,
  device_id,
  fcm_token,
  push_enabled,
  platform
)
select
  f.profile_id,
  d.device_id,
  'fcm-' || d.device_id,
  true,
  'android'
from _partial_push_fixture f
cross join _partial_deliveries d
on conflict (profile_id, device_id) do update
  set
    fcm_token = excluded.fcm_token,
    push_enabled = excluded.push_enabled;

insert into message_dispatcher.message_dispatches (
  id,
  idempotency_key,
  profile_id,
  channel,
  template_key,
  status,
  scheduled_for,
  locked_by,
  locked_until
)
select
  f.dispatch_id,
  gen_random_uuid(),
  f.profile_id,
  'push'::message_dispatcher.message_channel,
  'engagement_push',
  'PROCESSING'::message_dispatcher.message_dispatch_status,
  now(),
  'worker-partial',
  now() + interval '30 seconds'
from _partial_push_fixture f;

insert into message_dispatcher.message_dispatch_deliveries (
  id,
  dispatch_id,
  device_id,
  fcm_token_snapshot
)
select
  d.delivery_id,
  f.dispatch_id,
  d.device_id,
  'fcm-' || d.device_id
from _partial_deliveries d
cross join _partial_push_fixture f;

select is(
  (
    select message_dispatcher.message_dispatcher_report_delivery_outcome(
      (select dispatch_id from _partial_push_fixture),
      'worker-partial',
      'push'::message_dispatcher.message_channel,
      true,
      'projects/test/messages/msg-1',
      200,
      null,
      null,
      (
        select jsonb_agg(
          jsonb_build_object(
            'delivery_id', d.delivery_id,
            'device_id', d.device_id,
            'outcome',
            case
              when d.device_id = 'device-bad-token' then 'failed_terminal'
              else 'sent'
            end,
            'vendor_error_code',
            case
              when d.device_id = 'device-bad-token' then 'invalid_token'
              else null
            end
          )
          order by d.device_id
        )
        from _partial_deliveries d
      ),
      false
    )->>'status'
  ),
  'DELIVERED',
  'parent DELIVERED when any delivery succeeded'
);

select is(
  (
    select jsonb_array_length(d.metadata->'partial_failures')
    from message_dispatcher.message_dispatches d
    join _partial_push_fixture f on d.id = f.dispatch_id
  ),
  1,
  'metadata.partial_failures has one failed delivery'
);

select is(
  (
    select d.metadata->'partial_failures'->0->>'device_id'
    from message_dispatcher.message_dispatches d
    join _partial_push_fixture f on d.id = f.dispatch_id
  ),
  'device-bad-token',
  'partial_failures records bad device'
);

select is(
  (
    select count(*)::text
    from message_dispatcher.message_dispatch_deliveries del
    join _partial_push_fixture f on del.dispatch_id = f.dispatch_id
    where del.outcome = 'sent'::message_dispatcher.message_delivery_outcome
  ),
  '2',
  'two deliveries marked sent'
);

select is(
  (
    select del.outcome::text
    from message_dispatcher.message_dispatch_deliveries del
    join _partial_deliveries pd on del.id = pd.delivery_id
    where pd.device_id = 'device-bad-token'
  ),
  'failed_terminal',
  'bad delivery marked failed_terminal'
);

select ok(
  (
    select b.push_enabled = false and b.fcm_token is null
    from public.user_device_beacons b
    join _partial_push_fixture f on b.profile_id = f.profile_id
    where b.device_id = 'device-bad-token'
  ),
  'invalid token beacon disabled on partial DELIVERED'
);

select finish();

rollback;

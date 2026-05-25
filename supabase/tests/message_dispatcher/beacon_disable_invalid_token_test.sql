-- pgTAP: invalid FCM token disables user_device_beacon (design §11.7, task 66, Req.7 AC2).

begin;

select plan(2);

create temp table _beacon_fixture as
select p.id as profile_id, gen_random_uuid() as dispatch_id
from public.profiles p
limit 1;

insert into public.user_device_beacons (
  profile_id,
  device_id,
  fcm_token,
  push_enabled,
  platform
)
select
  f.profile_id,
  'device-invalid-token',
  'stale-fcm-token',
  true,
  'android'
from _beacon_fixture f
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
  'worker-beacon',
  now() + interval '30 seconds'
from _beacon_fixture f;

select is(
  (
    select message_dispatcher.message_dispatcher_report_delivery_outcome(
      (select dispatch_id from _beacon_fixture),
      'worker-beacon',
      'push'::message_dispatcher.message_channel,
      false,
      null,
      404,
      'invalid_token',
      'FCM token not registered',
      jsonb_build_array(
        jsonb_build_object(
          'delivery_id', gen_random_uuid(),
          'device_id', 'device-invalid-token',
          'outcome', 'failed_terminal',
          'vendor_error_code', 'invalid_token'
        )
      ),
      false
    )->>'status'
  ),
  'FAILED_TERMINAL',
  'terminal report applied'
);

select ok(
  (
    select b.push_enabled = false and b.fcm_token is null
    from public.user_device_beacons b
    join _beacon_fixture f on b.profile_id = f.profile_id
    where b.device_id = 'device-invalid-token'
  ),
  'beacon push_enabled false and fcm_token cleared'
);

select finish();

rollback;

-- pgTAP: integration — checkout push → invalid_token terminal + beacon disabled (task 90, Req.7 AC2).

begin;

select plan(7);

create temp table _fcm_bad_fixture as
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
  'device-fcm-bad',
  'expired-fcm-token',
  true,
  'ios'
from _fcm_bad_fixture f
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
  scheduled_for
)
select
  f.dispatch_id,
  gen_random_uuid(),
  f.profile_id,
  'push'::message_dispatcher.message_channel,
  'engagement_push',
  'QUEUED'::message_dispatcher.message_dispatch_status,
  now()
from _fcm_bad_fixture f;

select is(
  jsonb_array_length(
    message_dispatcher.message_dispatcher_checkout_batch(1, 'worker-fcm-bad')
  ),
  1,
  'checkout claims push dispatch with delivery fan-out'
);

create temp table _delivery_row as
select del.id as delivery_id, del.device_id
from message_dispatcher.message_dispatch_deliveries del
join _fcm_bad_fixture f on del.dispatch_id = f.dispatch_id;

select is(
  (
    select message_dispatcher.message_dispatcher_report_delivery_outcome(
      (select dispatch_id from _fcm_bad_fixture),
      'worker-fcm-bad',
      'push'::message_dispatcher.message_channel,
      false,
      null,
      404,
      'invalid_token',
      'FCM registration token not registered',
      (
        select jsonb_build_array(
          jsonb_build_object(
            'delivery_id', d.delivery_id,
            'device_id', d.device_id,
            'outcome', 'failed_terminal',
            'vendor_error_code', 'invalid_token'
          )
        )
        from _delivery_row d
      ),
      false
    )->>'status'
  ),
  'FAILED_TERMINAL',
  'all-push failure with invalid_token is terminal'
);

select is(
  (
    select d.failure_code
    from message_dispatcher.message_dispatches d
    join _fcm_bad_fixture f on d.id = f.dispatch_id
  ),
  'invalid_token',
  'parent dispatch failure_code invalid_token'
);

select ok(
  (
    select b.push_enabled = false and b.fcm_token is null
    from public.user_device_beacons b
    join _fcm_bad_fixture f on b.profile_id = f.profile_id
    where b.device_id = 'device-fcm-bad'
  ),
  'beacon disabled after terminal invalid_token report'
);

select is(
  (
    select del.outcome::text
    from message_dispatcher.message_dispatch_deliveries del
    join _fcm_bad_fixture f on del.dispatch_id = f.dispatch_id
  ),
  'failed_terminal',
  'delivery outcome failed_terminal'
);

select ok(
  (
    select del.fcm_token_snapshot = 'expired-fcm-token'
    from message_dispatcher.message_dispatch_deliveries del
    join _fcm_bad_fixture f on del.dispatch_id = f.dispatch_id
  ),
  'fcm_token_snapshot unchanged after beacon disable (immutable snapshot)'
);

select ok(
  (
    select d.locked_by is null and d.locked_until is null
    from message_dispatcher.message_dispatches d
    join _fcm_bad_fixture f on d.id = f.dispatch_id
  ),
  'lease cleared on terminal push failure'
);

select finish();

rollback;

-- pgTAP: checkout push fan-out inserts deliveries (design §2.6, task 47, Req.2 AC2).

begin;

select plan(3);

create temp table _push_fanout_fixture as
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
  'device-test-1',
  'fcm-token-snapshot-abc',
  true,
  'android'
from _push_fanout_fixture f
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
from _push_fanout_fixture f;

create temp table _checkout_payload as
select message_dispatcher.message_dispatcher_checkout_batch(1, 'worker-push') as payload;

select is(
  jsonb_array_length((select payload -> 0 -> 'deliveries' from _checkout_payload)),
  1,
  'checkout payload includes one delivery'
);

select is(
  (select payload -> 0 -> 'deliveries' -> 0 ->> 'fcm_token_snapshot' from _checkout_payload),
  'fcm-token-snapshot-abc',
  'fcm_token_snapshot copied at checkout'
);

select ok(
  exists (
    select 1
    from message_dispatcher.message_dispatch_deliveries del
    join _push_fanout_fixture f on del.dispatch_id = f.dispatch_id
    where del.device_id = 'device-test-1'
      and del.fcm_token_snapshot = 'fcm-token-snapshot-abc'
  ),
  'delivery row inserted for eligible beacon'
);

select finish();

rollback;

-- pgTAP: checkout caps push fan-out at platform_constants limit (design §9.2, task 50).

begin;

\ir fixtures/clear_due_dispatches.inc

select plan(2);

create temp table _max_devices_fixture as
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
  'device-' || g.i::text,
  'fcm-' || g.i::text,
  true,
  'android'
from _max_devices_fixture f
cross join generate_series(1, 12) as g(i)
on conflict (profile_id, device_id) do update
  set
    fcm_token = excluded.fcm_token,
    push_enabled = excluded.push_enabled,
    updated_at = now();

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
from _max_devices_fixture f;

create temp table _max_devices_payload as
select message_dispatcher.message_dispatcher_checkout_batch(1, 'worker-max-devices') as payload;

select is(
  jsonb_array_length((select payload -> 0 -> 'deliveries' from _max_devices_payload)),
  10,
  'checkout deliveries capped at 10 devices'
);

select is(
  (
    select count(*)::int
    from message_dispatcher.message_dispatch_deliveries del
    join _max_devices_fixture f on del.dispatch_id = f.dispatch_id
  ),
  10,
  'at most 10 delivery rows inserted'
);

select finish();

rollback;

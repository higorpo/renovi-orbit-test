-- pgTAP: checkout push fan-out inserts deliveries (design §2.6, task 47, Req.2 AC2).

begin;

\ir ../rls/fixtures/seed_rls_actors.inc
\ir fixtures/seed_mmd_isolated_profile.inc

select plan(3);

create temp table _push_fanout_fixture as
select
  pg_temp.mmd_isolated_profile('c1111111-1111-4111-8111-111111111003'::uuid) as profile_id,
  gen_random_uuid() as dispatch_id;

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
  '-infinity'::timestamptz
from _push_fanout_fixture f;

create temp table _checkout_payload as
select message_dispatcher.message_dispatcher_checkout_batch(1, 'worker-push') as payload;

create temp table _our_checkout_item as
select elem as item
from _checkout_payload cp,
  lateral jsonb_array_elements(cp.payload) elem
join _push_fanout_fixture f on (elem->>'id')::uuid = f.dispatch_id;

select is(
  (select jsonb_array_length(item -> 'deliveries') from _our_checkout_item),
  1,
  'checkout payload includes one delivery'
);

select is(
  (select item -> 'deliveries' -> 0 ->> 'fcm_token_snapshot' from _our_checkout_item),
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

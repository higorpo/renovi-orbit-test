-- pgTAP: message_dispatch_deliveries unique constraint on (dispatch_id, device_id, attempt_no)
-- and multi-attempt scenarios (design §3.5).

begin;

select plan(4);

create temp table _attempt_fixture as
select
  p.id as profile_id,
  gen_random_uuid() as dispatch_id
from public.profiles p
limit 1;

insert into message_dispatcher.message_templates (template_key, channel, body_template, active)
values ('push_test_template', 'push', 'Test push body', true)
on conflict (template_key, channel) do nothing;

insert into message_dispatcher.message_dispatches (
  id, idempotency_key, profile_id, channel, template_key, status, scheduled_for
)
select
  f.dispatch_id, gen_random_uuid(), f.profile_id,
  'push'::message_dispatcher.message_channel, 'push_test_template',
  'PROCESSING'::message_dispatcher.message_dispatch_status, now()
from _attempt_fixture f;

-- Insert attempt_no 1 for a device
insert into message_dispatcher.message_dispatch_deliveries (
  dispatch_id, device_id, fcm_token_snapshot, attempt_no
)
select f.dispatch_id, 'device_A', 'token_A', 1
from _attempt_fixture f;

select ok(
  (
    select count(*) = 1
    from message_dispatcher.message_dispatch_deliveries del
    join _attempt_fixture f on del.dispatch_id = f.dispatch_id
    where del.device_id = 'device_A'
  ),
  'first attempt_no=1 delivery inserted'
);

-- Duplicate (dispatch_id, device_id, attempt_no=1) must fail
select throws_ok(
  $test$
    insert into message_dispatcher.message_dispatch_deliveries (
      dispatch_id, device_id, fcm_token_snapshot, attempt_no
    )
    select f.dispatch_id, 'device_A', 'token_A_retry', 1
    from _attempt_fixture f
  $test$,
  '23505',
  null,
  'duplicate (dispatch_id, device_id, attempt_no) violates unique constraint'
);

-- attempt_no=2 for same device succeeds
insert into message_dispatcher.message_dispatch_deliveries (
  dispatch_id, device_id, fcm_token_snapshot, attempt_no
)
select f.dispatch_id, 'device_A', 'token_A_retry', 2
from _attempt_fixture f;

select ok(
  (
    select count(*) = 2
    from message_dispatcher.message_dispatch_deliveries del
    join _attempt_fixture f on del.dispatch_id = f.dispatch_id
    where del.device_id = 'device_A'
  ),
  'second attempt (attempt_no=2) for same device succeeds'
);

-- Different device with same attempt_no succeeds
insert into message_dispatcher.message_dispatch_deliveries (
  dispatch_id, device_id, fcm_token_snapshot, attempt_no
)
select f.dispatch_id, 'device_B', 'token_B', 1
from _attempt_fixture f;

select ok(
  (
    select count(*) = 3
    from message_dispatcher.message_dispatch_deliveries del
    join _attempt_fixture f on del.dispatch_id = f.dispatch_id
  ),
  'different device_id with attempt_no=1 succeeds (3 total deliveries)'
);

select finish();

rollback;

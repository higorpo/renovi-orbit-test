-- pgTAP: cancel authorization — non-owner authenticated user blocked (design §5.2, task 30).

begin;

select plan(4);

create temp table _auth_fixture as
select
  p.id as owner_id,
  gen_random_uuid() as other_user_id,
  gen_random_uuid() as dispatch_id
from public.profiles p
limit 1;

insert into message_dispatcher.message_dispatches (
  id, idempotency_key, profile_id, channel, template_key, status
)
select
  f.dispatch_id, gen_random_uuid(), f.owner_id,
  'email'::message_dispatcher.message_channel, 'welcome_template',
  'QUEUED'::message_dispatcher.message_dispatch_status
from _auth_fixture f;

-- Simulate a different authenticated user (not the dispatch owner)
select set_config('request.jwt.claim.role', 'authenticated', true);
select set_config('request.jwt.claim.sub', (select other_user_id::text from _auth_fixture), true);

select throws_ok(
  $test$
    select message_dispatcher.message_dispatcher_cancel(
      (select dispatch_id from _auth_fixture),
      'unauthorized_cancel'
    )
  $test$,
  '42501',
  null,
  'non-owner authenticated user cannot cancel another users dispatch'
);

select is(
  (select d.status::text from message_dispatcher.message_dispatches d
   join _auth_fixture f on d.id = f.dispatch_id),
  'QUEUED',
  'dispatch unchanged after unauthorized cancel attempt'
);

-- Now simulate the actual owner
select set_config('request.jwt.claim.sub', (select owner_id::text from _auth_fixture), true);

select is(
  (
    select message_dispatcher.message_dispatcher_cancel(
      (select dispatch_id from _auth_fixture),
      'owner_cancel'
    )->>'status'
  ),
  'CANCELED',
  'owner can cancel own dispatch'
);

select is(
  (select d.status::text from message_dispatcher.message_dispatches d
   join _auth_fixture f on d.id = f.dispatch_id),
  'CANCELED',
  'dispatch CANCELED by owner'
);

select finish();

rollback;

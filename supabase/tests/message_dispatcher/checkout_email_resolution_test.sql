-- pgTAP: checkout attaches recipient_email from auth.users (design §2.6, task 45).

begin;

select plan(3);

create temp table _email_checkout_fixture as
select
  u.id as profile_id,
  u.email as expected_email,
  gen_random_uuid() as dispatch_id
from auth.users u
where u.email is not null and trim(u.email) <> ''
limit 1;

select isnt(
  (select profile_id from _email_checkout_fixture),
  null,
  'seed user with email exists (test precondition)'
);

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
  'email'::message_dispatcher.message_channel,
  'welcome_template',
  'QUEUED'::message_dispatcher.message_dispatch_status,
  now()
from _email_checkout_fixture f;

create temp table _checkout_result as
select message_dispatcher.message_dispatcher_checkout_batch(1, 'worker-email') as payload;

select is(
  (select payload -> 0 ->> 'recipient_email' from _checkout_result),
  (select expected_email::text from _email_checkout_fixture),
  'recipient_email resolved from auth.users'
);

select ok(
  (select payload -> 0 -> 'deliveries' from _checkout_result) = '[]'::jsonb,
  'email checkout includes empty deliveries array'
);

select finish();

rollback;

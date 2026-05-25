-- pgTAP: checkout attaches recipient_email from auth.users (design §2.6, task 45).

begin;

select plan(2);

create temp table _email_checkout_fixture as
select
  '28e30f1d-3c47-441f-94c6-76b6ea0db470'::uuid as profile_id,
  gen_random_uuid() as dispatch_id;

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
select message_dispatcher.message_dispatcher_checkout_batch(1, 'worker-email') as payload
where exists (
  select 1 from auth.users u where u.id = '28e30f1d-3c47-441f-94c6-76b6ea0db470'::uuid
);

select is(
  (select payload -> 0 ->> 'recipient_email' from _checkout_result),
  'cliente@renovi.com.br',
  'recipient_email resolved from auth.users'
)
where exists (select 1 from _checkout_result);

select ok(
  (select payload -> 0 -> 'deliveries' from _checkout_result) = '[]'::jsonb,
  'email checkout includes empty deliveries array'
)
where exists (select 1 from _checkout_result);

select finish();

rollback;

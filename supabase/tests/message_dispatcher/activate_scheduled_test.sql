-- pgTAP: activate_scheduled cron RPC (design §4.2, task 33, Req.4 AC1).

begin;

select plan(3);

create temp table _activate_fixture as
select
  p.id as profile_id,
  gen_random_uuid() as due_id,
  gen_random_uuid() as future_id
from public.profiles p
limit 1;

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
  f.due_id,
  gen_random_uuid(),
  f.profile_id,
  'email'::message_dispatcher.message_channel,
  'welcome_template',
  'SCHEDULED'::message_dispatcher.message_dispatch_status,
  now() - interval '1 hour'
from _activate_fixture f;

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
  f.future_id,
  gen_random_uuid(),
  f.profile_id,
  'email'::message_dispatcher.message_channel,
  'welcome_template',
  'SCHEDULED'::message_dispatcher.message_dispatch_status,
  now() + interval '100 years'
from _activate_fixture f;

select is(
  message_dispatcher.message_dispatcher_activate_scheduled(),
  1,
  'activates one due SCHEDULED row'
);

select is(
  (
    select d.status::text
    from message_dispatcher.message_dispatches d
    join _activate_fixture f on d.id = f.due_id
  ),
  'QUEUED',
  'due row activated and evaluated to QUEUED'
);

select is(
  (
    select d.status::text
    from message_dispatcher.message_dispatches d
    join _activate_fixture f on d.id = f.future_id
  ),
  'SCHEDULED',
  'future row stays SCHEDULED'
);

select finish();

rollback;

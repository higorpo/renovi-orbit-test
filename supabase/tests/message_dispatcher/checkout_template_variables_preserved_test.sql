-- pgTAP: checkout preserves template_variables value in DTO (design §5.3).

begin;

select plan(2);

create temp table _vars_fixture as
select
  p.id as profile_id,
  gen_random_uuid() as dispatch_id,
  '{"name":"Maria","amount":42,"nested":{"key":"value"}}'::jsonb as vars
from public.profiles p
limit 1;

insert into message_dispatcher.message_dispatches (
  id,
  idempotency_key,
  profile_id,
  channel,
  template_key,
  template_variables,
  status,
  scheduled_for
)
select
  f.dispatch_id,
  gen_random_uuid(),
  f.profile_id,
  'email'::message_dispatcher.message_channel,
  'welcome_template',
  f.vars,
  'QUEUED'::message_dispatcher.message_dispatch_status,
  now()
from _vars_fixture f;

create temp table _vars_checkout as
select message_dispatcher.message_dispatcher_checkout_batch(1, 'worker-vars') as payload;

select is(
  (select payload -> 0 -> 'template_variables' from _vars_checkout),
  (select vars from _vars_fixture),
  'template_variables value preserved exactly through checkout DTO'
);

select is(
  (
    select d.template_variables
    from message_dispatcher.message_dispatches d
    join _vars_fixture f on d.id = f.dispatch_id
  ),
  (select vars from _vars_fixture),
  'template_variables not mutated on dispatch row after checkout'
);

select finish();

rollback;

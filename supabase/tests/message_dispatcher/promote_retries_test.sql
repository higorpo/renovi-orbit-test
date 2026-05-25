-- pgTAP: promote_retries cron RPC (design §4.6, task 35, Req.7 AC1).

begin;

select plan(2);

create temp table _promote_fixture as
select p.id as profile_id, gen_random_uuid() as dispatch_id
from public.profiles p
limit 1;

insert into message_dispatcher.message_dispatches (
  id,
  idempotency_key,
  profile_id,
  channel,
  template_key,
  status,
  next_retry_at
)
select
  f.dispatch_id,
  gen_random_uuid(),
  f.profile_id,
  'email'::message_dispatcher.message_channel,
  'welcome_template',
  'FAILED_RETRYABLE'::message_dispatcher.message_dispatch_status,
  now() - interval '1 hour'
from _promote_fixture f;

select is(
  message_dispatcher.message_dispatcher_promote_retries(),
  1,
  'promotes one due retry row'
);

select is(
  (
    select d.status::text
    from message_dispatcher.message_dispatches d
    join _promote_fixture f on d.id = f.dispatch_id
  ),
  'QUEUED',
  'FAILED_RETRYABLE becomes QUEUED'
);

select finish();

rollback;

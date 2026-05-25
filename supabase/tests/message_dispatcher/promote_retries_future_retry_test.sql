-- pgTAP: promote_retries does NOT promote retries with future next_retry_at (negative test).

begin;

select plan(2);

create temp table _future_retry_fixture as
select p.id as profile_id, gen_random_uuid() as dispatch_id
from public.profiles p
limit 1;

insert into message_dispatcher.message_dispatches (
  id, idempotency_key, profile_id, channel, template_key, status,
  next_retry_at, retry_count, max_retries
)
select
  f.dispatch_id, gen_random_uuid(), f.profile_id,
  'email'::message_dispatcher.message_channel, 'welcome_template',
  'FAILED_RETRYABLE'::message_dispatcher.message_dispatch_status,
  now() + interval '1 hour',
  1, 3
from _future_retry_fixture f;

select is(
  message_dispatcher.message_dispatcher_promote_retries(),
  0,
  'future retry not promoted (0 returned)'
);

select is(
  (select d.status::text from message_dispatcher.message_dispatches d
   join _future_retry_fixture f on d.id = f.dispatch_id),
  'FAILED_RETRYABLE',
  'dispatch remains FAILED_RETRYABLE'
);

select finish();

rollback;

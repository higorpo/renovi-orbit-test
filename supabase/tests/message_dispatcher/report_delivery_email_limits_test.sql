-- pgTAP: email DELIVERED updates user_limits (email_count_24h).

begin;

select plan(3);

create temp table _email_limits_fixture as
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
  scheduled_for,
  locked_by,
  locked_until
)
select
  f.dispatch_id,
  gen_random_uuid(),
  f.profile_id,
  'email'::message_dispatcher.message_channel,
  'welcome_template',
  'PROCESSING'::message_dispatcher.message_dispatch_status,
  now(),
  'worker-email-limits',
  now() + interval '30 seconds'
from _email_limits_fixture f;

select is(
  (
    select message_dispatcher.message_dispatcher_report_delivery_outcome(
      (select dispatch_id from _email_limits_fixture),
      'worker-email-limits',
      'email'::message_dispatcher.message_channel,
      true,
      're_email_limits_test',
      200,
      null,
      null,
      '[]'::jsonb
    )->>'applied'
  ),
  'true',
  'email report success applies'
);

select ok(
  (
    select ul.email_count_24h >= 1
    from message_dispatcher.message_dispatcher_user_limits ul
    join _email_limits_fixture f on ul.profile_id = f.profile_id
  ),
  'email_count_24h incremented on DELIVERED'
);

select ok(
  (
    select ul.email_window_start is not null
    from message_dispatcher.message_dispatcher_user_limits ul
    join _email_limits_fixture f on ul.profile_id = f.profile_id
  ),
  'email_window_start set on DELIVERED'
);

select finish();

rollback;

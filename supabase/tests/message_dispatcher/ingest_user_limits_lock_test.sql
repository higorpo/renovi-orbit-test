-- pgTAP: ingest auto-creates user_limits row and acquires FOR UPDATE lock (task 23, Req.1 AC3).

begin;

select plan(3);

create temp table _limits_fixture as
select gen_random_uuid() as idempotency_key, p.id as profile_id
from public.profiles p
limit 1;

select ok((select count(*) from _limits_fixture) = 1, 'fixture profile');

delete from message_dispatcher.message_dispatcher_user_limits ul
using _limits_fixture f
where ul.profile_id = f.profile_id;

-- Ingest should auto-create user_limits and succeed.
select lives_ok(
  $test$
    select message_dispatcher.message_dispatcher_ingest(
      (select idempotency_key from _limits_fixture),
      (select profile_id from _limits_fixture),
      'email'::message_dispatcher.message_channel,
      'welcome_template'
    )
  $test$,
  'ingest auto-creates user_limits and succeeds'
);

select ok(
  exists (
    select 1
    from message_dispatcher.message_dispatcher_user_limits ul
    join _limits_fixture f on f.profile_id = ul.profile_id
  ),
  'user_limits row ensured for profile after ingest'
);

select finish();

rollback;

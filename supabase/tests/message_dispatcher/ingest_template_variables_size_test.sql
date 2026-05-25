-- pgTAP: template_variables 8KB limit at ingest + CHECK (design §11.4, task 97).

begin;

select plan(3);

create temp table _size_fixture as
select p.id as profile_id, gen_random_uuid() as ingest_key
from public.profiles p
limit 1;

insert into message_dispatcher.message_dispatcher_user_limits (profile_id)
select profile_id from _size_fixture
on conflict (profile_id) do nothing;

select throws_ok(
  $test$
    select message_dispatcher.message_dispatcher_ingest(
      (select ingest_key from _size_fixture),
      (select profile_id from _size_fixture),
      'email'::message_dispatcher.message_channel,
      'welcome_template',
      jsonb_build_object('name', repeat('x', 9000))
    )
  $test$,
  '22023',
  'template_variables exceeds 8192 bytes',
  'ingest rejects template_variables over 8KB'
);

select throws_ok(
  $test$
    insert into message_dispatcher.message_dispatches (
      idempotency_key,
      profile_id,
      channel,
      template_key,
      template_variables
    )
    select
      gen_random_uuid(),
      (select profile_id from _size_fixture),
      'email'::message_dispatcher.message_channel,
      'welcome_template',
      jsonb_build_object('payload', repeat('y', 9000))
  $test$,
  '23514',
  null,
  'table CHECK rejects template_variables over 8KB'
);

select lives_ok(
  $test$
    select message_dispatcher.message_dispatcher_ingest(
      gen_random_uuid(),
      (select profile_id from _size_fixture),
      'email'::message_dispatcher.message_channel,
      'welcome_template',
      jsonb_build_object('name', 'ok')
    )
  $test$,
  'ingest accepts template_variables within 8KB'
);

select finish();

rollback;

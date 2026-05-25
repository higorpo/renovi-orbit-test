-- pgTAP: ingest template/channel validation (design §5.1, task 27, Req.2 AC3).

begin;

select plan(3);

create temp table _template_fixture as
select p.id as profile_id, gen_random_uuid() as ingest_key
from public.profiles p
limit 1;

insert into message_dispatcher.message_dispatcher_user_limits (profile_id)
select profile_id from _template_fixture
on conflict (profile_id) do nothing;

select throws_ok(
  $test$
    select message_dispatcher.message_dispatcher_ingest(
      (select ingest_key from _template_fixture),
      (select profile_id from _template_fixture),
      'email'::message_dispatcher.message_channel,
      'nonexistent_template'
    )
  $test$,
  '22023',
  null,
  'unknown template_key rejected'
);

select throws_ok(
  $test$
    select message_dispatcher.message_dispatcher_ingest(
      gen_random_uuid(),
      (select profile_id from _template_fixture),
      'push'::message_dispatcher.message_channel,
      'welcome_template'
    )
  $test$,
  '22023',
  null,
  'email-only template on push channel rejected'
);

insert into message_dispatcher.message_templates (
  template_key,
  channel,
  body_template,
  active
)
values (
  'inactive_test_template',
  'email',
  'body',
  false
)
on conflict (template_key, channel) do update set active = excluded.active;

select throws_ok(
  $test$
    select message_dispatcher.message_dispatcher_ingest(
      gen_random_uuid(),
      (select profile_id from _template_fixture),
      'email'::message_dispatcher.message_channel,
      'inactive_test_template'
    )
  $test$,
  '22023',
  null,
  'inactive template rejected'
);

select finish();

rollback;

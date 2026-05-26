-- pgTAP: record_push_click channel guard — cannot record push click on email dispatch.

begin;

select plan(1);

create temp table _fixture as
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
  scheduled_for
)
select
  f.dispatch_id,
  gen_random_uuid(),
  f.profile_id,
  'email'::message_dispatcher.message_channel,
  'welcome_template',
  'DELIVERED'::message_dispatcher.message_dispatch_status,
  now()
from _fixture f;

-- Store fixture values before switching roles
select set_config('test.profile_id', (select profile_id::text from _fixture), true);
select set_config('test.dispatch_id', (select dispatch_id::text from _fixture), true);

-- Set auth context as dispatch owner to pass authorization check
set local role authenticated;
select set_config('request.jwt.claim.sub', current_setting('test.profile_id'), true);
select set_config('request.jwt.claims', json_build_object('role', 'authenticated', 'sub', current_setting('test.profile_id'))::text, true);

select is(
  (
    select message_dispatcher.message_dispatcher_record_push_click(
      current_setting('test.dispatch_id')::uuid,
      '{}'::jsonb
    )->>'reason'
  ),
  'channel_not_push',
  'email dispatch returns channel_not_push error'
);

reset role;

select finish();

rollback;

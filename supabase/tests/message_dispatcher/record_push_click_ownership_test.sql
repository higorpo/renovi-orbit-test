-- pgTAP: record_push_click ownership guard — non-owner cannot record click.

begin;

select plan(1);

create temp table _fixture as
select
  p.id as profile_id,
  gen_random_uuid() as dispatch_id,
  gen_random_uuid() as other_profile_id
from public.profiles p
limit 1;

-- Ensure a second profile exists for the non-owner test
insert into auth.users (id, email)
select f.other_profile_id, 'other-push-click@test.com'
from _fixture f
on conflict (id) do nothing;

insert into public.profiles (id, full_name)
select f.other_profile_id, 'Other User Push Click'
from _fixture f
on conflict (id) do nothing;

-- Ensure push template exists for FK constraint
insert into message_dispatcher.message_templates (template_key, channel, body_template, active)
values ('welcome_template', 'push', 'Welcome push body', true)
on conflict (template_key, channel) do nothing;

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
  'push'::message_dispatcher.message_channel,
  'welcome_template',
  'DELIVERED'::message_dispatcher.message_dispatch_status,
  now()
from _fixture f;

-- Store fixture values before switching roles
select set_config('test.other_profile_id', (select other_profile_id::text from _fixture), true);
select set_config('test.dispatch_id', (select dispatch_id::text from _fixture), true);

-- Simulate auth.uid() returning the other_profile_id (non-owner)
set local role authenticated;
select set_config('request.jwt.claim.sub', current_setting('test.other_profile_id'), true);
select set_config('request.jwt.claims', json_build_object('role', 'authenticated', 'sub', current_setting('test.other_profile_id'))::text, true);

select throws_ok(
  format(
    $$select message_dispatcher.message_dispatcher_record_push_click('%s'::uuid, '{}'::jsonb)$$,
    current_setting('test.dispatch_id')
  ),
  '42501',
  null,
  'non-owner is rejected with authorization error'
);

reset role;

select finish();

rollback;

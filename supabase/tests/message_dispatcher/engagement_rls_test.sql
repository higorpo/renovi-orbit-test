-- pgTAP: engagement RLS — SELECT policy works, INSERT/UPDATE/DELETE revoked from authenticated.

begin;

select plan(4);

create temp table _fixture as
select
  p.id as profile_id,
  gen_random_uuid() as dispatch_id,
  gen_random_uuid() as other_profile_id
from public.profiles p
limit 1;

-- Ensure a second profile exists
insert into auth.users (id, email)
select f.other_profile_id, 'other-rls-eng@test.com'
from _fixture f
on conflict (id) do nothing;

insert into public.profiles (id, full_name)
select f.other_profile_id, 'Other User RLS Eng'
from _fixture f
on conflict (id) do nothing;

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

-- Insert an engagement row as service_role
select message_dispatcher.message_dispatcher_record_engagement(
  (select dispatch_id from _fixture),
  'opened'::message_dispatcher.message_engagement_type,
  'resend_webhook',
  '{}'::jsonb
);

-- Store fixture values in session configs before switching roles
select set_config('test.profile_id', (select profile_id::text from _fixture), true);
select set_config('test.other_profile_id', (select other_profile_id::text from _fixture), true);
select set_config('test.dispatch_id', (select dispatch_id::text from _fixture), true);

-- Test: owner can SELECT
set local role authenticated;
select set_config('request.jwt.claim.sub', current_setting('test.profile_id'), true);
select set_config('request.jwt.claims', json_build_object('role', 'authenticated', 'sub', current_setting('test.profile_id'))::text, true);

select ok(
  (
    select count(*) = 1
    from message_dispatcher.message_dispatch_engagements
  ),
  'owner can SELECT own engagement rows'
);

reset role;

-- Test: non-owner cannot SELECT
set local role authenticated;
select set_config('request.jwt.claim.sub', current_setting('test.other_profile_id'), true);
select set_config('request.jwt.claims', json_build_object('role', 'authenticated', 'sub', current_setting('test.other_profile_id'))::text, true);

select ok(
  (
    select count(*) = 0
    from message_dispatcher.message_dispatch_engagements
  ),
  'non-owner cannot SELECT engagement rows'
);

reset role;

-- Test: INSERT revoked from authenticated
set local role authenticated;
select set_config('request.jwt.claim.sub', current_setting('test.profile_id'), true);
select set_config('request.jwt.claims', json_build_object('role', 'authenticated', 'sub', current_setting('test.profile_id'))::text, true);

select throws_ok(
  format(
    $$insert into message_dispatcher.message_dispatch_engagements (dispatch_id, profile_id, engagement_type, channel, source)
      values ('%s', '%s', 'clicked', 'email', 'manual')$$,
    current_setting('test.dispatch_id'),
    current_setting('test.profile_id')
  ),
  '42501',
  null,
  'INSERT revoked from authenticated role'
);

reset role;

-- Test: DELETE revoked from authenticated
set local role authenticated;
select set_config('request.jwt.claim.sub', current_setting('test.profile_id'), true);
select set_config('request.jwt.claims', json_build_object('role', 'authenticated', 'sub', current_setting('test.profile_id'))::text, true);

select throws_ok(
  $$delete from message_dispatcher.message_dispatch_engagements$$,
  '42501',
  null,
  'DELETE revoked from authenticated role'
);

reset role;

select finish();

rollback;

-- pgTAP: DELETE CASCADE from profile removes dispatches, user_limits, audit, and deliveries.

begin;

select plan(5);

-- Create a dedicated test user to safely delete
create temp table _cascade_fixture as
select gen_random_uuid() as profile_id, gen_random_uuid() as dispatch_id;

insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password,
  email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
  created_at, updated_at,
  confirmation_token, email_change, email_change_token_new, recovery_token
)
select
  '00000000-0000-0000-0000-000000000000',
  f.profile_id,
  'authenticated', 'authenticated',
  'cascade-test-' || f.profile_id::text || '@test.com',
  crypt('Abc123', gen_salt('bf')),
  now(),
  '{"provider":"email","providers":["email"]}'::jsonb,
  '{"full_name":"Cascade Test","role":"client"}'::jsonb,
  now(), now(), '', '', '', ''
from _cascade_fixture f;

-- Insert user_limits
insert into message_dispatcher.message_dispatcher_user_limits (profile_id)
select profile_id from _cascade_fixture;

-- Insert dispatch
insert into message_dispatcher.message_dispatches (
  id, idempotency_key, profile_id, channel, template_key, status
)
select
  f.dispatch_id, gen_random_uuid(), f.profile_id,
  'email'::message_dispatcher.message_channel, 'welcome_template',
  'QUEUED'::message_dispatcher.message_dispatch_status
from _cascade_fixture f;

-- Trigger an audit row via status change
update message_dispatcher.message_dispatches d
set status = 'CANCELED', cancel_reason = 'cascade_test'
from _cascade_fixture f
where d.id = f.dispatch_id;

-- Verify pre-delete state
select ok(
  exists (select 1 from message_dispatcher.message_dispatches d
          join _cascade_fixture f on d.id = f.dispatch_id),
  'dispatch exists before delete'
);

-- Delete the profile (cascades via auth.users → profiles → dispatches etc.)
delete from auth.users u
using _cascade_fixture f
where u.id = f.profile_id;

select ok(
  not exists (select 1 from message_dispatcher.message_dispatches d
              join _cascade_fixture f on d.id = f.dispatch_id),
  'dispatches cascade-deleted'
);

select ok(
  not exists (select 1 from message_dispatcher.message_dispatcher_user_limits ul
              join _cascade_fixture f on ul.profile_id = f.profile_id),
  'user_limits cascade-deleted'
);

select ok(
  not exists (select 1 from message_dispatcher.message_dispatcher_audit a
              join _cascade_fixture f on a.dispatch_id = f.dispatch_id),
  'audit rows cascade-deleted'
);

select ok(
  not exists (select 1 from message_dispatcher.message_dispatch_deliveries del
              join _cascade_fixture f on del.dispatch_id = f.dispatch_id),
  'deliveries cascade-deleted'
);

select finish();

rollback;

-- pgTAP: checkout no_email_on_file terminal, omitted from payload (design §2.6, task 46).

begin;

\ir fixtures/clear_due_dispatches.inc

select plan(4);

-- Create a user with no email for testing purposes.
create temp table _no_email_fixture as
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
  '',
  crypt('Abc123', gen_salt('bf')),
  now(),
  '{"provider":"email","providers":["email"]}'::jsonb,
  '{"full_name":"No Email User","role":"client"}'::jsonb,
  now(), now(), '', '', '', ''
from _no_email_fixture f;

select ok(
  (select count(*) from _no_email_fixture) = 1,
  'profile without auth email exists'
);

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
  'QUEUED'::message_dispatcher.message_dispatch_status,
  now()
from _no_email_fixture f;

select is(
  jsonb_array_length(message_dispatcher.message_dispatcher_checkout_batch(1, 'worker-no-email')),
  0,
  'dispatch omitted from checkout payload when no email'
);

select is(
  (
    select d.status::text
    from message_dispatcher.message_dispatches d
    join _no_email_fixture f on d.id = f.dispatch_id
  ),
  'FAILED_TERMINAL',
  'dispatch terminal when no email on file'
);

select is(
  (
    select d.failure_code
    from message_dispatcher.message_dispatches d
    join _no_email_fixture f on d.id = f.dispatch_id
  ),
  'no_email_on_file',
  'failure_code set'
);

select finish();

rollback;

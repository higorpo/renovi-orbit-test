-- pgTAP: message_dispatcher table RLS (dispatches, deliveries, audit, templates, limits).

begin;

\ir ../rls/fixtures/seed_rls_actors.inc

select plan(12);

select set_config('rls.owner_id', '28e30f1d-3c47-441f-94c6-76b6ea0db470', true);
select set_config('rls.other_id', 'b2222222-2222-4222-8222-222222222222', true);

select pg_temp.rls_seed_user(current_setting('rls.other_id')::uuid, 'client', 'MMD Other');

select set_config('rls.dispatch_id', gen_random_uuid()::text, true);

reset role;

insert into message_dispatcher.message_dispatches (
  id,
  idempotency_key,
  profile_id,
  channel,
  template_key,
  status,
  scheduled_for
)
values (
  current_setting('rls.dispatch_id')::uuid,
  gen_random_uuid(),
  current_setting('rls.owner_id')::uuid,
  'email'::message_dispatcher.message_channel,
  'welcome_template',
  'DELIVERED'::message_dispatcher.message_dispatch_status,
  now()
);

insert into message_dispatcher.message_dispatch_deliveries (
  dispatch_id,
  device_id,
  outcome
)
values (
  current_setting('rls.dispatch_id')::uuid,
  'device-rls-test',
  'pending'::message_dispatcher.message_delivery_outcome
);

insert into message_dispatcher.message_dispatcher_audit (
  dispatch_id,
  profile_id,
  new_status,
  changed_by
)
values (
  current_setting('rls.dispatch_id')::uuid,
  current_setting('rls.owner_id')::uuid,
  'DELIVERED'::message_dispatcher.message_dispatch_status,
  'test'
);

-- message_dispatches_select_owner ---------------------------------------------

select pg_temp.rls_set_auth(current_setting('rls.owner_id')::uuid);

select ok(
  (
    select count(*) = 1
    from message_dispatcher.message_dispatches
    where id = current_setting('rls.dispatch_id')::uuid
  ),
  'owner reads own message_dispatches (message_dispatches_select_owner)'
);

select pg_temp.rls_set_auth(current_setting('rls.other_id')::uuid);

select is(
  (select count(*)::int from message_dispatcher.message_dispatches),
  0,
  'non-owner cannot read message_dispatches'
);

-- message_dispatch_deliveries_select_owner ------------------------------------

select pg_temp.rls_set_auth(current_setting('rls.owner_id')::uuid);

select ok(
  (
    select count(*) = 1
    from message_dispatcher.message_dispatch_deliveries
    where dispatch_id = current_setting('rls.dispatch_id')::uuid
  ),
  'owner reads deliveries via parent dispatch (message_dispatch_deliveries_select_owner)'
);

select pg_temp.rls_set_auth(current_setting('rls.other_id')::uuid);

select is(
  (select count(*)::int from message_dispatcher.message_dispatch_deliveries),
  0,
  'non-owner cannot read message_dispatch_deliveries'
);

-- message_dispatcher_audit_select_owner ---------------------------------------

select pg_temp.rls_set_auth(current_setting('rls.owner_id')::uuid);

select ok(
  (
    select count(*) >= 1
    from message_dispatcher.message_dispatcher_audit
    where dispatch_id = current_setting('rls.dispatch_id')::uuid
  ),
  'owner reads message_dispatcher_audit (message_dispatcher_audit_select_owner)'
);

select pg_temp.rls_set_auth(current_setting('rls.other_id')::uuid);

select is(
  (select count(*)::int from message_dispatcher.message_dispatcher_audit),
  0,
  'non-owner cannot read message_dispatcher_audit'
);

-- message_templates_select_authenticated --------------------------------------

select pg_temp.rls_set_auth(current_setting('rls.owner_id')::uuid);

select ok(
  (select count(*) >= 1 from message_dispatcher.message_templates),
  'authenticated reads message_templates (message_templates_select_authenticated)'
);

select throws_ok(
  $$
    insert into message_dispatcher.message_templates (template_key, channel, body_template)
    values ('forged', 'email', 'forged body')
  $$,
  '42501',
  null,
  'authenticated cannot INSERT message_templates'
);

-- Privilege guards ------------------------------------------------------------

select ok(
  not has_table_privilege('authenticated', 'message_dispatcher.message_dispatches', 'INSERT'),
  'authenticated has no INSERT on message_dispatches'
);

select ok(
  not has_table_privilege('authenticated', 'message_dispatcher.message_dispatcher_vendor_events', 'SELECT'),
  'authenticated has no SELECT on message_dispatcher_vendor_events'
);

select ok(
  has_table_privilege('service_role', 'message_dispatcher.message_dispatcher_vendor_events', 'SELECT'),
  'service_role can SELECT message_dispatcher_vendor_events'
);

select ok(
  (
    select count(*) = 1
    from pg_policies
    where schemaname = 'message_dispatcher'
      and tablename = 'message_templates'
      and policyname = 'message_templates_select_authenticated'
  ),
  'message_templates_select_authenticated policy exists'
);

select finish();

rollback;

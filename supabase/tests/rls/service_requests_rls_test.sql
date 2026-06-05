-- pgTAP: service_requests RLS matrix after provider-isolation hardening.
-- Client reads/owns; admin reads all; providers denied direct read (RPC-masked instead).

begin;

\ir fixtures/seed_rls_actors.inc

select plan(10);

select set_config('rls.client_a_id', '28e30f1d-3c47-441f-94c6-76b6ea0db470', true);
select set_config('rls.provider_id', '5d09e025-20a2-4842-aeef-324d42a431e1', true);
select set_config('rls.client_b_id', 'b2222222-2222-4222-8222-222222222222', true);
select set_config('rls.admin_id', 'a1111111-1111-4111-8111-111111111111', true);
select set_config('rls.sr_a_id', '7017e457-5a32-44e7-b8da-1727a14f4d33', true);

select pg_temp.rls_seed_user(current_setting('rls.client_b_id')::uuid, 'client', 'Client B RLS');
select pg_temp.rls_seed_user(current_setting('rls.admin_id')::uuid, 'admin', 'Admin RLS');

-- Second service request owned by client B (superuser insert bypasses RLS).
insert into public.service_requests (
  id,
  client_id,
  service_id,
  address_id,
  title,
  description,
  form_data,
  form_version,
  status,
  urgency
)
select
  'c3333333-3333-4333-8333-333333333333'::uuid,
  current_setting('rls.client_b_id')::uuid,
  sr.service_id,
  sr.address_id,
  'Client B service request',
  sr.description,
  sr.form_data,
  sr.form_version,
  'OPEN',
  sr.urgency
from public.service_requests sr
where sr.id = current_setting('rls.sr_a_id')::uuid;

select set_config('rls.sr_b_id', 'c3333333-3333-4333-8333-333333333333', true);

-- Structural checks ----------------------------------------------------------

select is(
  (
    select count(*)::int
    from pg_policies
    where schemaname = 'public'
      and tablename = 'service_requests'
      and cmd = 'SELECT'
      and permissive = 'PERMISSIVE'
  ),
  1,
  'service_requests has a single permissive SELECT policy'
);

select ok(
  (
    select roles @> array['authenticated']::name[]
    from pg_policies
    where schemaname = 'public'
      and tablename = 'service_requests'
      and policyname = 'service_requests_select'
  ),
  'service_requests_select is scoped to authenticated'
);

-- Behavioral matrix -----------------------------------------------------------

select pg_temp.rls_set_auth(current_setting('rls.client_a_id')::uuid);

select is(
  (
    select count(*)::int
    from public.service_requests
    where id = current_setting('rls.sr_a_id')::uuid
  ),
  1,
  'client A reads own service request'
);

select is(
  (
    select count(*)::int
    from public.service_requests
    where id = current_setting('rls.sr_b_id')::uuid
  ),
  0,
  'client A cannot read client B service request'
);

select pg_temp.rls_set_auth(current_setting('rls.provider_id')::uuid);

select is(
  (
    select count(*)::int
    from public.service_requests
    where id in (
      current_setting('rls.sr_a_id')::uuid,
      current_setting('rls.sr_b_id')::uuid
    )
  ),
  0,
  'provider cannot read service requests directly'
);

select pg_temp.rls_set_auth(current_setting('rls.admin_id')::uuid);

select is(
  (
    select count(*)::int
    from public.service_requests
    where id in (
      current_setting('rls.sr_a_id')::uuid,
      current_setting('rls.sr_b_id')::uuid
    )
  ),
  2,
  'admin reads all service requests'
);

select pg_temp.rls_set_anon();

select is(
  (
    select count(*)::int
    from public.service_requests
    where id = current_setting('rls.sr_a_id')::uuid
  ),
  0,
  'anon cannot read service requests'
);

-- Writes ----------------------------------------------------------------------

select pg_temp.rls_set_auth(current_setting('rls.client_a_id')::uuid);

select lives_ok(
  $$
    insert into public.service_requests (
      client_id, service_id, address_id, title, description,
      form_data, form_version, status, urgency
    )
    select
      client_id, service_id, address_id, 'RLS own insert', description,
      form_data, form_version, 'OPEN', urgency
    from public.service_requests
    where id = current_setting('rls.sr_a_id')::uuid
  $$,
  'client inserts own service request'
);

select pg_temp.rls_set_auth(current_setting('rls.provider_id')::uuid);

select throws_ok(
  format(
    $q$
      insert into public.service_requests (
        client_id, service_id, address_id, title, description,
        form_data, form_version, status, urgency
      )
      values (
        '%s',
        'f5eebc99-9c0b-4ef8-bb6d-6bb9bd380a62',
        'acd13138-0d54-431f-a672-55903f31301e',
        'forged by provider',
        'forged',
        '{}'::jsonb,
        '2.0',
        'OPEN',
        'medium'
      )
    $q$,
    current_setting('rls.client_b_id')
  ),
  '42501',
  null,
  'provider cannot insert a service request for another client'
);

select pg_temp.rls_set_auth(current_setting('rls.client_b_id')::uuid);

select is(
  (
    select count(*)::int
    from public.service_requests
    where id = current_setting('rls.sr_b_id')::uuid
  ),
  1,
  'client B reads own service request'
);

select finish();

rollback;

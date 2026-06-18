-- pgTAP: create_provider_proposal DISPATCH_STOPPED gate (matching M14a).

begin;

select plan(2);

\ir ../chats/fixtures/seed_chat.inc

create or replace function pg_temp.cns_set_auth(p_user_id uuid)
returns void
language plpgsql
as $$
begin
  perform set_config('request.jwt.claim.sub', p_user_id::text, true);
  perform set_config(
    'request.jwt.claims',
    json_build_object('role', 'authenticated', 'sub', p_user_id::text)::text,
    true
  );
end;
$$;

create or replace function pg_temp.matching_seed_provider(p_user_id uuid, p_name text)
returns void
language plpgsql
as $$
begin
  insert into auth.users (
    instance_id,
    id,
    aud,
    role,
    email,
    encrypted_password,
    email_confirmed_at,
    raw_app_meta_data,
    raw_user_meta_data,
    created_at,
    updated_at,
    confirmation_token,
    email_change,
    email_change_token_new,
    recovery_token
  )
  values (
    '00000000-0000-0000-0000-000000000000',
    p_user_id,
    'authenticated',
    'authenticated',
    p_user_id::text || '@matching-proposal-gate.local',
    crypt('Abc123', gen_salt('bf')),
    now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    json_build_object('full_name', p_name, 'role', 'provider')::jsonb,
    now(),
    now(),
    '',
    '',
    '',
    ''
  )
  on conflict (id) do nothing;

  insert into public.profiles (id, role, full_name)
  values (p_user_id, 'provider', p_name)
  on conflict (id) do update set role = excluded.role, full_name = excluded.full_name;
end;
$$;

create or replace function pg_temp.matching_seed_gate_sr()
returns uuid
language plpgsql
as $$
declare
  v_sr_id uuid;
begin
  insert into public.service_requests (
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
    sr.client_id,
    sr.service_id,
    sr.address_id,
    'matching proposal gate pgTAP fixture',
    sr.description,
    sr.form_data,
    sr.form_version,
    'OPEN'::public.service_request_status,
    sr.urgency
  from public.service_requests sr
  where sr.id = '7017e457-5a32-44e7-b8da-1727a14f4d33'::uuid
  returning id into v_sr_id;

  return v_sr_id;
end;
$$;

create or replace function pg_temp.matching_submit_proposal(
  p_provider_id uuid,
  p_service_request_id uuid
)
returns jsonb
language plpgsql
as $$
declare
  v_pricing record;
begin
  perform pg_temp.cns_set_auth(p_provider_id);
  select * into v_pricing from public.calculate_provider_service_pricing(150.00::numeric);
  return public.create_provider_proposal(
    p_service_request_id,
    gen_random_uuid(),
    v_pricing.original_amount,
    'Matching gate proposal fixture',
    2,
    'hours',
    jsonb_build_array(
      jsonb_build_object(
        'start_date', to_char(current_date + 2, 'YYYY-MM-DD'),
        'shift', 'morning'
      )
    ),
    '{}'::text[],
    v_pricing.tax_rate,
    v_pricing.tax_amount,
    v_pricing.final_amount,
    v_pricing.pricing_signature
  );
end;
$$;

select pg_temp.matching_seed_provider('b1111111-1111-4111-8111-111111111111'::uuid, 'Gate provider B');
select pg_temp.matching_seed_provider('b2222222-2222-4222-8222-222222222222'::uuid, 'Gate provider C');
select pg_temp.matching_seed_provider('b3333333-3333-4333-8333-333333333333'::uuid, 'Gate provider D');
select pg_temp.matching_seed_provider('b4444444-4444-4444-8444-444444444444'::uuid, 'Gate provider E');
select pg_temp.matching_seed_provider('b5555555-5555-4555-8555-555555555555'::uuid, 'Gate provider F');

create temp table _gate_sr as
select pg_temp.matching_seed_gate_sr() as service_request_id;

create temp table _gate_dispatch as
select d.id as dispatch_id, d.status
from public.service_request_dispatches d
where d.service_request_id = (select service_request_id from _gate_sr);

select pg_temp.matching_submit_proposal(
  '5d09e025-20a2-4842-aeef-324d42a431e1'::uuid,
  (select service_request_id from _gate_sr)
);
select pg_temp.matching_submit_proposal(
  '4cf92e3a-64cd-4491-998e-9163138f8e96'::uuid,
  (select service_request_id from _gate_sr)
);
select pg_temp.matching_submit_proposal(
  'b1111111-1111-4111-8111-111111111111'::uuid,
  (select service_request_id from _gate_sr)
);
select pg_temp.matching_submit_proposal(
  'b2222222-2222-4222-8222-222222222222'::uuid,
  (select service_request_id from _gate_sr)
);

select is(
  (
    select d.status::text
    from public.service_request_dispatches d
    where d.id = (select dispatch_id from _gate_dispatch)
  ),
  'DISPATCH_STOPPED',
  'fourth proposal triggers gate eval and DISPATCH_STOPPED'
);

select throws_ok(
  $$
    select pg_temp.matching_submit_proposal(
      'b3333333-3333-4333-8333-333333333333'::uuid,
      (select service_request_id from _gate_sr)
    )
  $$,
  'P0001',
  null,
  'fifth proposal blocked when four in-flight proposals fill the cap'
);

select finish();

rollback;

-- pgTAP: expire_pending_proposals inline gate eval (matching M14e).

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
    p_user_id::text || '@matching-expire-gate.local',
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

create or replace function pg_temp.matching_submit_proposal(
  p_provider_id uuid,
  p_service_request_id uuid
)
returns uuid
language plpgsql
as $$
declare
  v_pricing record;
  v_response jsonb;
begin
  perform pg_temp.cns_set_auth(p_provider_id);
  select * into v_pricing from public.calculate_provider_service_pricing(150.00::numeric);
  v_response := public.create_provider_proposal(
    p_service_request_id,
    gen_random_uuid(),
    v_pricing.original_amount,
    'Expire gate fixture',
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
  return (v_response->'proposal'->>'id')::uuid;
end;
$$;

select pg_temp.matching_seed_provider('b1111111-1111-4111-8111-111111111111'::uuid, 'Expire gate B');
select pg_temp.matching_seed_provider('b2222222-2222-4222-8222-222222222222'::uuid, 'Expire gate C');
select pg_temp.matching_seed_provider('b3333333-3333-4333-8333-333333333333'::uuid, 'Expire gate D');

create temp table _expire_gate_sr as
select gen_random_uuid() as service_request_id;

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
  (select service_request_id from _expire_gate_sr),
  sr.client_id,
  sr.service_id,
  sr.address_id,
  'expire gate pgTAP fixture',
  sr.description,
  sr.form_data,
  sr.form_version,
  'OPEN'::public.service_request_status,
  sr.urgency
from public.service_requests sr
where sr.id = '7017e457-5a32-44e7-b8da-1727a14f4d33'::uuid;

create temp table _expire_gate_proposals as
select
  pg_temp.matching_submit_proposal('5d09e025-20a2-4842-aeef-324d42a431e1'::uuid, (select service_request_id from _expire_gate_sr)) as p1,
  pg_temp.matching_submit_proposal('4cf92e3a-64cd-4491-998e-9163138f8e96'::uuid, (select service_request_id from _expire_gate_sr)) as p2,
  pg_temp.matching_submit_proposal('b1111111-1111-4111-8111-111111111111'::uuid, (select service_request_id from _expire_gate_sr)) as p3,
  pg_temp.matching_submit_proposal('b2222222-2222-4222-8222-222222222222'::uuid, (select service_request_id from _expire_gate_sr)) as p4;

select is(
  (
    select d.status::text
    from public.service_request_dispatches d
    where d.service_request_id = (select service_request_id from _expire_gate_sr)
  ),
  'DISPATCH_STOPPED',
  'four in-flight proposals stop dispatch before expiry job'
);

update public.provider_proposals
set submitted_at = now() - interval '25 hours'
where id = (select p1 from _expire_gate_proposals);

select public.expire_pending_proposals(500);

select isnt(
  (
    select d.status::text
    from public.service_request_dispatches d
    where d.service_request_id = (select service_request_id from _expire_gate_sr)
  ),
  'DISPATCH_STOPPED',
  'expiring one proposal invokes gate eval and resumes dispatch below cap'
);

select finish();

rollback;

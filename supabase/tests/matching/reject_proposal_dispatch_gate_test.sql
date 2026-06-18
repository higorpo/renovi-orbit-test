-- pgTAP: reject_proposal inline dispatch gate re-eval (matching M14b).

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
    p_user_id::text || '@matching-reject-gate.local',
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
returns void
language plpgsql
as $$
declare
  v_pricing record;
begin
  perform pg_temp.cns_set_auth(p_provider_id);
  select * into v_pricing from public.calculate_provider_service_pricing(150.00::numeric);
  perform public.create_provider_proposal(
    p_service_request_id,
    gen_random_uuid(),
    v_pricing.original_amount,
    'Reject gate fixture',
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

select pg_temp.matching_seed_provider('b1111111-1111-4111-8111-111111111111'::uuid, 'Reject gate B');
select pg_temp.matching_seed_provider('b2222222-2222-4222-8222-222222222222'::uuid, 'Reject gate C');
select pg_temp.matching_seed_provider('b3333333-3333-4333-8333-333333333333'::uuid, 'Reject gate D');
select pg_temp.matching_seed_provider('b4444444-4444-4444-8444-444444444444'::uuid, 'Reject gate E');

create temp table _reject_gate_sr as
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
  (select service_request_id from _reject_gate_sr),
  sr.client_id,
  sr.service_id,
  sr.address_id,
  'reject gate pgTAP fixture',
  sr.description,
  sr.form_data,
  sr.form_version,
  'OPEN'::public.service_request_status,
  sr.urgency
from public.service_requests sr
where sr.id = '7017e457-5a32-44e7-b8da-1727a14f4d33'::uuid;

select pg_temp.matching_submit_proposal('5d09e025-20a2-4842-aeef-324d42a431e1'::uuid, (select service_request_id from _reject_gate_sr));
select pg_temp.matching_submit_proposal('4cf92e3a-64cd-4491-998e-9163138f8e96'::uuid, (select service_request_id from _reject_gate_sr));
select pg_temp.matching_submit_proposal('b1111111-1111-4111-8111-111111111111'::uuid, (select service_request_id from _reject_gate_sr));
select pg_temp.matching_submit_proposal('b2222222-2222-4222-8222-222222222222'::uuid, (select service_request_id from _reject_gate_sr));

select is(
  (
    select d.status::text
    from public.service_request_dispatches d
    where d.service_request_id = (select service_request_id from _reject_gate_sr)
  ),
  'DISPATCH_STOPPED',
  'four in-flight proposals stop dispatch before reject'
);

create temp table _reject_target as
select pp.id as proposal_id
from public.provider_proposals pp
where pp.service_request_id = (select service_request_id from _reject_gate_sr)
  and pp.provider_id = '5d09e025-20a2-4842-aeef-324d42a431e1'::uuid
  and pp.status = 'PENDING'::public.proposal_status;

select pg_temp.cns_set_auth('28e30f1d-3c47-441f-94c6-76b6ea0db470'::uuid);

select public.reject_proposal(
  (select proposal_id from _reject_target),
  gen_random_uuid(),
  'Client chose another provider'
);

select isnt(
  (
    select d.status::text
    from public.service_request_dispatches d
    where d.service_request_id = (select service_request_id from _reject_gate_sr)
  ),
  'DISPATCH_STOPPED',
  'reject_proposal invokes gate eval and resumes dispatch below proposal cap'
);

select finish();

rollback;

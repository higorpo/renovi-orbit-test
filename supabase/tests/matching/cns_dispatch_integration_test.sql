-- pgTAP: CNS M14 dispatch integration — end-to-end patched RPC side effects (task 72).
-- Scenarios: create_provider_proposal STOPPED gate, accept_proposal terminal match,
-- cancel_service_request terminal cancel, expire_pending_proposals inline gate,
-- initiate_conversation allowed under STOPPED when CNS slot available.

begin;

select plan(12);

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

create or replace function pg_temp.cns_seed_sr(p_title text)
returns uuid
language plpgsql
as $$
declare
  v_sr_id uuid := gen_random_uuid();
begin
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
    v_sr_id,
    sr.client_id,
    sr.service_id,
    sr.address_id,
    p_title,
    sr.description,
    sr.form_data,
    sr.form_version,
    'OPEN'::public.service_request_status,
    sr.urgency
  from public.service_requests sr
  where sr.id = '7017e457-5a32-44e7-b8da-1727a14f4d33'::uuid;

  return v_sr_id;
end;
$$;

create or replace function pg_temp.cns_seed_provider(p_user_id uuid, p_name text)
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
    p_user_id::text || '@cns-dispatch-integration.local',
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

  insert into public.provider_gateway_accounts (
    provider_id,
    gateway_slug,
    document,
    onboarding_status,
    onboarding_activated_at,
    netcred_company_id
  )
  values (
    p_user_id,
    'netcred'::public.payment_gateway_slug,
    right(replace(p_user_id::text, '-', ''), 11),
    'ACTIVE'::public.payment_provider_onboarding_status,
    now(),
    substr(replace(p_user_id::text, '-', ''), 1, 8)
  )
  on conflict (provider_id, gateway_slug) do update
  set
    onboarding_status = 'ACTIVE'::public.payment_provider_onboarding_status,
    onboarding_activated_at = excluded.onboarding_activated_at,
    netcred_company_id = excluded.netcred_company_id;
end;
$$;

create or replace function pg_temp.cns_submit_proposal(
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
    'CNS dispatch integration fixture',
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

create or replace function pg_temp.cns_seed_visibility(
  p_service_request_id uuid,
  p_provider_id uuid
)
returns void
language plpgsql
as $$
begin
  insert into public.service_request_provider_visibility (
    service_request_id,
    provider_id,
    source,
    granted_at
  )
  values (p_service_request_id, p_provider_id, 'batch', now())
  on conflict do nothing;
end;
$$;

create or replace function pg_temp.cns_seed_mmd(
  p_service_request_id uuid,
  p_provider_id uuid
)
returns void
language plpgsql
as $$
begin
  insert into message_dispatcher.message_dispatcher_user_limits (profile_id)
  values (p_provider_id)
  on conflict (profile_id) do nothing;

  insert into message_dispatcher.message_dispatches (
    idempotency_key,
    profile_id,
    channel,
    template_key,
    template_variables,
    status
  )
  values (
    gen_random_uuid(),
    p_provider_id,
    'email'::message_dispatcher.message_channel,
    'matching.new_opportunity',
    jsonb_build_object(
      'service_request_id', p_service_request_id,
      'title', 'CNS integration test',
      'service_name', 'Eletricista',
      'neighborhood', 'Centro',
      'urgency', 'medium',
      'deep_link_path', format('/dashboard/services/%s', p_service_request_id)
    ),
    'QUEUED'::message_dispatcher.message_dispatch_status
  );
end;
$$;

select pg_temp.cns_seed_provider('c1111111-1111-4111-8111-111111111111'::uuid, 'Integration B');
select pg_temp.cns_seed_provider('c2222222-2222-4222-8222-222222222222'::uuid, 'Integration C');
select pg_temp.cns_seed_provider('c3333333-3333-4333-8333-333333333333'::uuid, 'Integration D');
select pg_temp.cns_seed_provider('c4444444-4444-4444-8444-444444444444'::uuid, 'Integration E');
select pg_temp.cns_seed_provider('c5555555-5555-4555-8555-555555555555'::uuid, 'Integration F');

-- 1) create_provider_proposal: fourth proposal STOPPED, fifth blocked
create temp table _create_gate_sr as
select pg_temp.cns_seed_sr('cns integration create gate') as service_request_id;

select pg_temp.cns_submit_proposal('5d09e025-20a2-4842-aeef-324d42a431e1'::uuid, (select service_request_id from _create_gate_sr));
select pg_temp.cns_submit_proposal('4cf92e3a-64cd-4491-998e-9163138f8e96'::uuid, (select service_request_id from _create_gate_sr));
select pg_temp.cns_submit_proposal('c1111111-1111-4111-8111-111111111111'::uuid, (select service_request_id from _create_gate_sr));
select pg_temp.cns_submit_proposal('c2222222-2222-4222-8222-222222222222'::uuid, (select service_request_id from _create_gate_sr));

select is(
  (
    select d.status::text
    from public.service_request_dispatches d
    where d.service_request_id = (select service_request_id from _create_gate_sr)
  ),
  'DISPATCH_STOPPED',
  'create_provider_proposal: fourth proposal triggers DISPATCH_STOPPED'
);

select throws_ok(
  $$
    select pg_temp.cns_submit_proposal(
      'c3333333-3333-4333-8333-333333333333'::uuid,
      (select service_request_id from _create_gate_sr)
    )
  $$,
  'P0001',
  null,
  'create_provider_proposal: fifth proposal blocked at proposal cap'
);

-- 2) accept_proposal: DISPATCH_MATCHED, visibility revoke, MMD cancel
create temp table _accept_match_sr as
select pg_temp.cns_seed_sr('cns integration accept match') as service_request_id;

select pg_temp.cns_seed_visibility(
  (select service_request_id from _accept_match_sr),
  '5d09e025-20a2-4842-aeef-324d42a431e1'::uuid
);
select pg_temp.cns_seed_visibility(
  (select service_request_id from _accept_match_sr),
  '4cf92e3a-64cd-4491-998e-9163138f8e96'::uuid
);
select pg_temp.cns_seed_mmd(
  (select service_request_id from _accept_match_sr),
  '4cf92e3a-64cd-4491-998e-9163138f8e96'::uuid
);

select pg_temp.cns_seed_chat(
  p_service_request_id := (select service_request_id from _accept_match_sr),
  p_client_id := '28e30f1d-3c47-441f-94c6-76b6ea0db470'::uuid,
  p_provider_id := '5d09e025-20a2-4842-aeef-324d42a431e1'::uuid
);

create temp table _accept_match_slot as
select jsonb_build_object(
  'start_date', (current_date + 2)::text,
  'shift', 'morning'
) as selected_slot;

select pg_temp.cns_set_auth('5d09e025-20a2-4842-aeef-324d42a431e1'::uuid);

create temp table _accept_match_submit as
with pricing as (
  select * from public.calculate_provider_service_pricing(400.00::numeric)
)
select public.create_provider_proposal(
  (select service_request_id from _accept_match_sr),
  gen_random_uuid(),
  pricing.original_amount,
  'Accept integration fixture',
  2,
  'hours',
  jsonb_build_array((select selected_slot from _accept_match_slot)),
  '{}'::text[],
  pricing.tax_rate,
  pricing.tax_amount,
  pricing.final_amount,
  pricing.pricing_signature
) as submit_response
from pricing;

select pg_temp.cns_set_auth('28e30f1d-3c47-441f-94c6-76b6ea0db470'::uuid);

select public.accept_proposal(
  (select (submit_response->'proposal'->>'id')::uuid from _accept_match_submit),
  (select selected_slot from _accept_match_slot),
  gen_random_uuid()
);

select is(
  (
    select d.status::text
    from public.service_request_dispatches d
    where d.service_request_id = (select service_request_id from _accept_match_sr)
  ),
  'DISPATCH_MATCHED',
  'accept_proposal: sets dispatch status to DISPATCH_MATCHED'
);

select ok(
  (
    select v.revoked_at is not null
    from public.service_request_provider_visibility v
    where v.service_request_id = (select service_request_id from _accept_match_sr)
      and v.provider_id = '4cf92e3a-64cd-4491-998e-9163138f8e96'::uuid
  ),
  'accept_proposal: revokes non-winning provider visibility'
);

select is(
  (
    select count(*)::int
    from message_dispatcher.message_dispatches md
    where md.template_key = 'matching.new_opportunity'
      and md.template_variables->>'service_request_id'
        = (select service_request_id from _accept_match_sr)::text
      and md.status = 'CANCELED'::message_dispatcher.message_dispatch_status
  ),
  1,
  'accept_proposal: cancels pending matching MMD rows'
);

-- 3) cancel_service_request: DISPATCH_CANCELLED, visibility revoke, MMD cancel
create temp table _cancel_sr as
select pg_temp.cns_seed_sr('cns integration cancel') as service_request_id;

select pg_temp.cns_seed_visibility(
  (select service_request_id from _cancel_sr),
  '5d09e025-20a2-4842-aeef-324d42a431e1'::uuid
);
select pg_temp.cns_seed_mmd(
  (select service_request_id from _cancel_sr),
  '5d09e025-20a2-4842-aeef-324d42a431e1'::uuid
);

select pg_temp.cns_set_auth('28e30f1d-3c47-441f-94c6-76b6ea0db470'::uuid);

select public.cancel_service_request(
  (select service_request_id from _cancel_sr),
  gen_random_uuid()
);

select is(
  (
    select d.status::text
    from public.service_request_dispatches d
    where d.service_request_id = (select service_request_id from _cancel_sr)
  ),
  'DISPATCH_CANCELLED',
  'cancel_service_request: sets dispatch status to DISPATCH_CANCELLED'
);

select ok(
  (
    select v.revoked_at is not null
    from public.service_request_provider_visibility v
    where v.service_request_id = (select service_request_id from _cancel_sr)
      and v.provider_id = '5d09e025-20a2-4842-aeef-324d42a431e1'::uuid
  ),
  'cancel_service_request: revokes batch feed visibility'
);

select is(
  (
    select count(*)::int
    from message_dispatcher.message_dispatches md
    where md.template_key = 'matching.new_opportunity'
      and md.template_variables->>'service_request_id'
        = (select service_request_id from _cancel_sr)::text
      and md.status = 'CANCELED'::message_dispatcher.message_dispatch_status
  ),
  1,
  'cancel_service_request: cancels pending matching MMD rows'
);

-- 4) expire_pending_proposals: inline gate eval resumes dispatch below cap
create temp table _expire_sr as
select pg_temp.cns_seed_sr('cns integration expire gate') as service_request_id;

create temp table _expire_proposals as
select
  (pg_temp.cns_submit_proposal('5d09e025-20a2-4842-aeef-324d42a431e1'::uuid, (select service_request_id from _expire_sr))->'proposal'->>'id')::uuid as p1,
  (pg_temp.cns_submit_proposal('4cf92e3a-64cd-4491-998e-9163138f8e96'::uuid, (select service_request_id from _expire_sr))->'proposal'->>'id')::uuid as p2,
  (pg_temp.cns_submit_proposal('c1111111-1111-4111-8111-111111111111'::uuid, (select service_request_id from _expire_sr))->'proposal'->>'id')::uuid as p3,
  (pg_temp.cns_submit_proposal('c2222222-2222-4222-8222-222222222222'::uuid, (select service_request_id from _expire_sr))->'proposal'->>'id')::uuid as p4;

select is(
  (
    select d.status::text
    from public.service_request_dispatches d
    where d.service_request_id = (select service_request_id from _expire_sr)
  ),
  'DISPATCH_STOPPED',
  'expire_pending_proposals: four in-flight proposals stop dispatch'
);

update public.provider_proposals
set submitted_at = now() - interval '25 hours'
where id = (select p1 from _expire_proposals);

select public.expire_pending_proposals(500);

select isnt(
  (
    select d.status::text
    from public.service_request_dispatches d
    where d.service_request_id = (select service_request_id from _expire_sr)
  ),
  'DISPATCH_STOPPED',
  'expire_pending_proposals: inline gate eval resumes dispatch below cap'
);

-- 5) initiate_conversation: allowed under DISPATCH_STOPPED when slot available
create temp table _initiate_sr as
select pg_temp.cns_seed_sr('cns integration initiate gate') as service_request_id;

select pg_temp.cns_submit_proposal('5d09e025-20a2-4842-aeef-324d42a431e1'::uuid, (select service_request_id from _initiate_sr));
select pg_temp.cns_submit_proposal('4cf92e3a-64cd-4491-998e-9163138f8e96'::uuid, (select service_request_id from _initiate_sr));
select pg_temp.cns_submit_proposal('c1111111-1111-4111-8111-111111111111'::uuid, (select service_request_id from _initiate_sr));
select pg_temp.cns_submit_proposal('c2222222-2222-4222-8222-222222222222'::uuid, (select service_request_id from _initiate_sr));

select is(
  (
    select d.status::text
    from public.service_request_dispatches d
    where d.service_request_id = (select service_request_id from _initiate_sr)
  ),
  'DISPATCH_STOPPED',
  'initiate_conversation: four proposals reach DISPATCH_STOPPED'
);

select pg_temp.cns_set_auth('c4444444-4444-4444-8444-444444444444'::uuid);

select lives_ok(
  $$
    select public.cns_initiate_conversation(
      (select service_request_id from _initiate_sr),
      gen_random_uuid()
    )
  $$,
  'initiate_conversation: allowed under DISPATCH_STOPPED when CNS slot available'
);

select finish();

rollback;

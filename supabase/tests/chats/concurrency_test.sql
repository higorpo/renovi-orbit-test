-- pgTAP: concurrent slot / accept / cancel races (task 103, Req. 4, 14).
-- Serializes via FOR UPDATE on shared rows (same lock order as concurrent sessions).

begin;

\ir fixtures/seed_chat.inc

select plan(10);

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

create or replace function pg_temp.cns_seed_provider_user(
  p_user_id uuid,
  p_name text default 'Concurrency test provider'
)
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
    p_user_id::text || '@concurrency-test.local',
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

  insert into auth.identities (
    id,
    user_id,
    identity_data,
    provider,
    provider_id,
    last_sign_in_at,
    created_at,
    updated_at
  )
  values (
    p_user_id,
    p_user_id,
    json_build_object(
      'sub',
      p_user_id::text,
      'email',
      p_user_id::text || '@concurrency-test.local'
    )::jsonb,
    'email',
    p_user_id::text,
    now(),
    now(),
    now()
  )
  on conflict (provider_id, provider) do nothing;
end;
$$;

create or replace function pg_temp.cns_concurrency_seed_sr()
returns uuid
language plpgsql
as $$
declare
  v_sr_id uuid;
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
    gen_random_uuid(),
    sr.client_id,
    sr.service_id,
    sr.address_id,
    'CNS concurrency pgTAP fixture',
    sr.description,
    sr.form_data,
    sr.form_version,
    'OPEN',
    sr.urgency
  from public.service_requests sr
  where sr.id = '7017e457-5a32-44e7-b8da-1727a14f4d33'::uuid
  returning id into v_sr_id;

  return v_sr_id;
end;
$$;

create or replace function pg_temp.cns_provider_first_message(
  p_provider_id uuid,
  p_service_request_id uuid,
  p_idempotency_key uuid
)
returns jsonb
language plpgsql
as $$
begin
  perform pg_temp.cns_set_auth(p_provider_id);
  return public.cns_send_message(
    'TEXT'::public.cns_message_type,
    p_idempotency_key,
    jsonb_build_object('text', 'Race contender'),
    null,
    p_service_request_id
  );
end;
$$;

create or replace function pg_temp.cns_submit_pending(
  p_chat_id uuid,
  p_idempotency_key uuid
)
returns jsonb
language plpgsql
as $$
declare
  v_response jsonb;
begin
  with pricing as (
    select *
    from public.calculate_provider_service_pricing(300.00::numeric)
  )
  select public.create_provider_proposal(
    (select c.service_request_id from public.chats c where c.id = p_chat_id),
    pricing.original_amount,
    'Concurrency race proposal',
    2,
    'hours',
    jsonb_build_array(
      jsonb_build_object(
        'start_date', (current_date + 2)::text,
        'shift', 'morning'
      )
    ),
    '{}'::text[],
    pricing.tax_rate,
    pricing.tax_amount,
    pricing.final_amount,
    pricing.pricing_signature
  )
  into v_response
  from pricing;

  return v_response;
end;
$$;

select pg_temp.cns_seed_provider_user('b1111111-1111-4111-8111-111111111111'::uuid, 'Race provider B');
select pg_temp.cns_seed_provider_user('b2222222-2222-4222-8222-222222222222'::uuid, 'Race provider C');

update public.platform_constants
set value = '2'::jsonb
where key = 'chats.max_active_slots_per_service_request';

-- R4-AC09: last-slot race under FOR UPDATE on negotiation stats (one winner).
create temp table _last_slot_sr as
select pg_temp.cns_concurrency_seed_sr() as service_request_id;

select pg_temp.cns_provider_first_message(
  '5d09e025-20a2-4842-aeef-324d42a431e1'::uuid,
  (select service_request_id from _last_slot_sr),
  'f1030001-0001-4001-8001-000000000001'::uuid
);

do $lock$
begin
  perform 1
  from public.service_request_negotiation_stats s
  where s.service_request_id = (select service_request_id from _last_slot_sr)
  for update;
end;
$lock$;

select lives_ok(
  $sql$
    select pg_temp.cns_provider_first_message(
      'b1111111-1111-4111-8111-111111111111'::uuid,
      (select service_request_id from _last_slot_sr),
      'f1030002-0002-4002-8002-000000000002'::uuid
    );
  $sql$,
  'last-slot race: first contender wins while stats row is locked'
);

select throws_ok(
  $sql$
    select pg_temp.cns_provider_first_message(
      'b2222222-2222-4222-8222-222222222222'::uuid,
      (select service_request_id from _last_slot_sr),
      'f1030003-0003-4003-8003-000000000003'::uuid
    );
  $sql$,
  'P0001',
  'NO_ACTIVE_SLOT',
  'last-slot race: second contender loses with NO_ACTIVE_SLOT'
);

select is(
  (
    select active_chat_count
    from public.service_request_negotiation_stats
    where service_request_id = (select service_request_id from _last_slot_sr)
  ),
  2,
  'last-slot race: active_chat_count stays at limit after contention'
);

-- R7-AC03: dual accept on same SR — exactly one succeeds.
create temp table _dual_accept_sr as
select pg_temp.cns_concurrency_seed_sr() as service_request_id;

create temp table _dual_accept_chat_a as
select pg_temp.cns_provider_first_message(
  '5d09e025-20a2-4842-aeef-324d42a431e1'::uuid,
  (select service_request_id from _dual_accept_sr),
  'f1030010-0010-4010-8010-000000000010'::uuid
) as first_send;

create temp table _dual_accept_chat_b as
select pg_temp.cns_provider_first_message(
  'b1111111-1111-4111-8111-111111111111'::uuid,
  (select service_request_id from _dual_accept_sr),
  'f1030011-0011-4011-8011-000000000011'::uuid
) as first_send;

select pg_temp.cns_set_auth('5d09e025-20a2-4842-aeef-324d42a431e1'::uuid);

create temp table _dual_accept_submit_a as
select pg_temp.cns_submit_pending(
  (select (first_send->'conversation'->>'id')::uuid from _dual_accept_chat_a),
  'f1030012-0012-4012-8012-000000000012'::uuid
) as response;

select pg_temp.cns_set_auth('b1111111-1111-4111-8111-111111111111'::uuid);

create temp table _dual_accept_submit_b as
select pg_temp.cns_submit_pending(
  (select (first_send->'conversation'->>'id')::uuid from _dual_accept_chat_b),
  'f1030013-0013-4013-8013-000000000013'::uuid
) as response;

select pg_temp.cns_set_auth('28e30f1d-3c47-441f-94c6-76b6ea0db470'::uuid);

create temp table _dual_accept_slot as
select jsonb_build_object(
  'start_date', (current_date + 2)::text,
  'shift', 'morning'
) as selected_slot;

select lives_ok(
  $sql$
    select public.accept_proposal(
      (select (response->'proposal'->>'id')::uuid from _dual_accept_submit_a),
      (select selected_slot from _dual_accept_slot),
      'f1030014-0014-4014-8014-000000000014'::uuid
    );
  $sql$,
  'dual accept: first accept wins'
);

select throws_ok(
  $sql$
    select public.accept_proposal(
      (select (response->'proposal'->>'id')::uuid from _dual_accept_submit_b),
      (select selected_slot from _dual_accept_slot),
      'f1030015-0015-4015-8015-000000000015'::uuid
    );
  $sql$,
  'P0001',
  'SR_ALREADY_COMPLETED',
  'dual accept: second accept fails after SR completed'
);

select is(
  (
    select count(*)::int
    from public.provider_proposals pp
    where pp.service_request_id = (select service_request_id from _dual_accept_sr)
      and pp.status = 'ACCEPTED'::public.proposal_status
  ),
  1,
  'dual accept: exactly one ACCEPTED proposal remains'
);

-- R2-AC06: cancel vs accept — ordering determines the single winner.
create temp table _cancel_race_sr as
select pg_temp.cns_concurrency_seed_sr() as service_request_id;

create temp table _cancel_race_chat as
select pg_temp.cns_provider_first_message(
  '5d09e025-20a2-4842-aeef-324d42a431e1'::uuid,
  (select service_request_id from _cancel_race_sr),
  'f1030020-0020-4020-8020-000000000020'::uuid
) as first_send;

select pg_temp.cns_set_auth('5d09e025-20a2-4842-aeef-324d42a431e1'::uuid);

create temp table _cancel_race_submit as
select pg_temp.cns_submit_pending(
  (select (first_send->'conversation'->>'id')::uuid from _cancel_race_chat),
  'f1030021-0021-4021-8021-000000000021'::uuid
) as response;

select pg_temp.cns_set_auth('28e30f1d-3c47-441f-94c6-76b6ea0db470'::uuid);

select lives_ok(
  $sql$
    select public.cancel_service_request(
      (select service_request_id from _cancel_race_sr),
      'f1030022-0022-4022-8022-000000000022'::uuid
    );
  $sql$,
  'cancel vs accept: cancel wins when it runs first'
);

select throws_ok(
  $sql$
    select public.accept_proposal(
      (select (response->'proposal'->>'id')::uuid from _cancel_race_submit),
      jsonb_build_object(
        'start_date', (current_date + 2)::text,
        'shift', 'morning'
      ),
      'f1030023-0023-4023-8023-000000000023'::uuid
    );
  $sql$,
  'P0001',
  'SR_NOT_OPEN',
  'cancel vs accept: accept loses when cancel committed first'
);

create temp table _accept_race_sr as
select pg_temp.cns_concurrency_seed_sr() as service_request_id;

create temp table _accept_race_chat as
select pg_temp.cns_provider_first_message(
  '5d09e025-20a2-4842-aeef-324d42a431e1'::uuid,
  (select service_request_id from _accept_race_sr),
  'f1030030-0030-4030-8030-000000000030'::uuid
) as first_send;

select pg_temp.cns_set_auth('5d09e025-20a2-4842-aeef-324d42a431e1'::uuid);

create temp table _accept_race_submit as
select pg_temp.cns_submit_pending(
  (select (first_send->'conversation'->>'id')::uuid from _accept_race_chat),
  'f1030031-0031-4031-8031-000000000031'::uuid
) as response;

select pg_temp.cns_set_auth('28e30f1d-3c47-441f-94c6-76b6ea0db470'::uuid);

select lives_ok(
  $sql$
    select public.accept_proposal(
      (select (response->'proposal'->>'id')::uuid from _accept_race_submit),
      jsonb_build_object(
        'start_date', (current_date + 2)::text,
        'shift', 'morning'
      ),
      'f1030032-0032-4032-8032-000000000032'::uuid
    );
  $sql$,
  'cancel vs accept: accept wins when it runs first'
);

select throws_ok(
  $sql$
    select public.cancel_service_request(
      (select service_request_id from _accept_race_sr),
      'f1030033-0033-4033-8033-000000000033'::uuid
    );
  $sql$,
  'P0001',
  'SR_ALREADY_COMPLETED',
  'cancel vs accept: cancel loses when accept committed first'
);

select finish();

rollback;

-- pgTAP: submit_service_rating RPC (matching M13a).

begin;

reset role;

select plan(5);

\ir ../rls/fixtures/seed_rls_actors.inc

create or replace function pg_temp.matching_seed_provider_profile()
returns uuid
language plpgsql
as $$
declare
  v_provider_id uuid := gen_random_uuid();
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
    v_provider_id,
    'authenticated',
    'authenticated',
    v_provider_id::text || '@matching-submit-rating-test.local',
    crypt('Abc123', gen_salt('bf')),
    now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    json_build_object('full_name', 'Submit rating test provider', 'role', 'provider')::jsonb,
    now(),
    now(),
    '',
    '',
    '',
    ''
  );

  insert into public.profiles (id, role, full_name)
  values (v_provider_id, 'provider', 'Submit rating test provider')
  on conflict (id) do update
    set role = excluded.role,
        full_name = excluded.full_name;

  return v_provider_id;
end;
$$;

create or replace function pg_temp.matching_seed_contracted_service(
  p_provider_id uuid,
  p_status public.contracted_service_status default 'COMPLETED'::public.contracted_service_status
)
returns uuid
language plpgsql
as $$
declare
  v_sr_id uuid;
  v_proposal_id uuid := gen_random_uuid();
  v_contracted_service_id uuid := gen_random_uuid();
  v_slot jsonb := jsonb_build_object(
    'start_date', to_char(current_date + 1, 'YYYY-MM-DD'),
    'shift', 'morning'
  );
  v_pricing record;
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
    'matching submit rating fixture',
    sr.description,
    sr.form_data,
    sr.form_version,
    'OPEN'::public.service_request_status,
    sr.urgency
  from public.service_requests sr
  where sr.id = '7017e457-5a32-44e7-b8da-1727a14f4d33'::uuid
  returning id into v_sr_id;

  perform pg_temp.rls_set_auth(p_provider_id);
  select * into v_pricing from public.calculate_provider_service_pricing(100.00::numeric);
  reset role;

  insert into public.provider_proposals (
    id,
    provider_id,
    service_request_id,
    proposed_amount,
    proposal_description,
    proposal_duration_value,
    proposal_duration_unit,
    proposal_suggested_slots,
    photos,
    tax_rate,
    tax_amount,
    final_amount,
    pricing_signature,
    status,
    version,
    revision_count,
    submitted_at
  )
  values (
    v_proposal_id,
    p_provider_id,
    v_sr_id,
    100.00,
    'Submit rating test proposal',
    2,
    'hours',
    jsonb_build_array(v_slot),
    '{}'::text[],
    v_pricing.tax_rate,
    v_pricing.tax_amount,
    v_pricing.final_amount,
    v_pricing.pricing_signature,
    'ACCEPTED'::public.proposal_status,
    1,
    0,
    now()
  );

  insert into public.contracted_services (
    id,
    service_request_id,
    accepted_proposal_id,
    client_id,
    provider_id,
    duration_unit,
    duration_value,
    scheduled_start_date,
    scheduled_end_date,
    scheduled_shift,
    agreed_slot,
    status
  )
  select
    v_contracted_service_id,
    v_sr_id,
    v_proposal_id,
    sr.client_id,
    p_provider_id,
    'hours',
    2,
    current_date + 1,
    null,
    'morning',
    v_slot,
    p_status
  from public.service_requests sr
  where sr.id = v_sr_id;

  return v_contracted_service_id;
end;
$$;

create temp table _rating_provider as
select pg_temp.matching_seed_provider_profile() as provider_id;

create temp table _rating_cs as
select pg_temp.matching_seed_contracted_service(
  (select provider_id from _rating_provider)
) as contracted_service_id;

create temp table _rating_client as
select cs.client_id
from public.contracted_services cs
where cs.id = (select contracted_service_id from _rating_cs);

select set_config(
  'test.submit.cs_id',
  (select contracted_service_id::text from _rating_cs),
  true
);
select set_config(
  'test.submit.client_id',
  (select client_id::text from _rating_client),
  true
);
select set_config(
  'test.submit.provider_id',
  (select provider_id::text from _rating_provider),
  true
);

-- EXECUTE revoked from authenticated; call via service_role + actor JWT.
select ok(
  not has_function_privilege(
    'authenticated',
    'public.submit_service_rating(uuid, smallint, smallint, smallint, smallint, text)'::regprocedure,
    'EXECUTE'
  ),
  'authenticated cannot execute submit_service_rating'
);

select pg_temp.rls_set_service_as_user(current_setting('test.submit.client_id')::uuid);

select ok(
  (
    select (public.submit_service_rating(
      current_setting('test.submit.cs_id')::uuid,
      5::smallint,
      4::smallint,
      4::smallint,
      5::smallint,
      'Great work'::text
    )->>'success')::boolean
  ),
  'client submits rating for completed contracted service'
);

select throws_ok(
  $$
    select public.submit_service_rating(
      current_setting('test.submit.cs_id')::uuid,
      5::smallint,
      5::smallint,
      5::smallint,
      5::smallint
    )
  $$,
  '23505',
  null,
  'duplicate submit is rejected'
);

select pg_temp.rls_set_service_as_user('4cf92e3a-64cd-4491-998e-9163138f8e96'::uuid);

select throws_ok(
  $$
    select public.submit_service_rating(
      current_setting('test.submit.cs_id')::uuid,
      5::smallint,
      5::smallint,
      5::smallint,
      5::smallint
    )
  $$,
  '42501',
  null,
  'non-client caller is rejected'
);

reset role;

select set_config(
  'test.submit.pending_cs_id',
  pg_temp.matching_seed_contracted_service(
    current_setting('test.submit.provider_id')::uuid,
    'PENDING_PAYMENT'::public.contracted_service_status
  )::text,
  true
);

select pg_temp.rls_set_service_as_user(current_setting('test.submit.client_id')::uuid);

select throws_ok(
  $$
    select public.submit_service_rating(
      current_setting('test.submit.pending_cs_id')::uuid,
      5::smallint,
      5::smallint,
      5::smallint,
      5::smallint
    )
  $$,
  '22023',
  null,
  'non-completed contracted service is rejected'
);

select finish();

rollback;

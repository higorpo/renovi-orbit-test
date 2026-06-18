-- pgTAP: update_service_rating RPC (matching M13b).

begin;

reset role;

select plan(3);

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
    v_provider_id::text || '@matching-update-rating-test.local',
    crypt('Abc123', gen_salt('bf')),
    now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    json_build_object('full_name', 'Update rating test provider', 'role', 'provider')::jsonb,
    now(),
    now(),
    '',
    '',
    '',
    ''
  );

  insert into public.profiles (id, role, full_name)
  values (v_provider_id, 'provider', 'Update rating test provider')
  on conflict (id) do update
    set role = excluded.role,
        full_name = excluded.full_name;

  return v_provider_id;
end;
$$;

create or replace function pg_temp.matching_seed_contracted_service(p_provider_id uuid)
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
    'matching update rating fixture',
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
    'Update rating test proposal',
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
    'COMPLETED'::public.contracted_service_status
  from public.service_requests sr
  where sr.id = v_sr_id;

  return v_contracted_service_id;
end;
$$;

create temp table _update_provider as
select pg_temp.matching_seed_provider_profile() as provider_id;

create temp table _update_cs as
select pg_temp.matching_seed_contracted_service(
  (select provider_id from _update_provider)
) as contracted_service_id;

create temp table _update_client as
select cs.client_id
from public.contracted_services cs
where cs.id = (select contracted_service_id from _update_cs);

select set_config(
  'test.update.cs_id',
  (select contracted_service_id::text from _update_cs),
  true
);
select set_config(
  'test.update.client_id',
  (select client_id::text from _update_client),
  true
);

select pg_temp.rls_set_auth(current_setting('test.update.client_id')::uuid);

select public.submit_service_rating(
  current_setting('test.update.cs_id')::uuid,
  5::smallint,
  5::smallint,
  5::smallint,
  5::smallint,
  'Initial'::text
);

select is(
  (
    select (public.update_service_rating(
      current_setting('test.update.cs_id')::uuid,
      4::smallint,
      4::smallint,
      4::smallint,
      4::smallint,
      'Updated'::text
    )->>'overall_score')::numeric
  ),
  4.00::numeric,
  'edit within 48 hours updates overall_score'
);

reset role;

update public.service_ratings
set submitted_at = now() - interval '72 hours'
where contracted_service_id = current_setting('test.update.cs_id')::uuid;

select pg_temp.rls_set_auth(current_setting('test.update.client_id')::uuid);

select throws_ok(
  $$
    select public.update_service_rating(
      current_setting('test.update.cs_id')::uuid,
      3::smallint,
      3::smallint,
      3::smallint,
      3::smallint
    )
  $$,
  '22023',
  null,
  'edit after 48 hours is rejected'
);

select pg_temp.rls_set_auth('00000000-0000-0000-0000-000000000001'::uuid);

select throws_ok(
  $$
    select public.update_service_rating(
      current_setting('test.update.cs_id')::uuid,
      3::smallint,
      3::smallint,
      3::smallint,
      3::smallint
    )
  $$,
  '42501',
  null,
  'wrong client cannot update rating'
);

select finish();

rollback;

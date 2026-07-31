-- pgTAP: rating RPC integration — submit/update guards, weighted overall_score,
-- provider_rating_stats trigger side effects, RLS deny direct insert (task 73).

begin;

select plan(12);

\ir ../rls/fixtures/seed_rls_actors.inc

create or replace function pg_temp.rating_seed_provider()
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
    v_provider_id::text || '@rating-rpcs-integration.local',
    crypt('Abc123', gen_salt('bf')),
    now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    json_build_object('full_name', 'Rating RPC integration provider', 'role', 'provider')::jsonb,
    now(),
    now(),
    '',
    '',
    '',
    ''
  )
  on conflict (id) do nothing;

  insert into public.profiles (id, role, full_name)
  values (v_provider_id, 'provider', 'Rating RPC integration provider')
  on conflict (id) do update set role = excluded.role, full_name = excluded.full_name;

  return v_provider_id;
end;
$$;

create or replace function pg_temp.rating_get_pricing(p_provider_id uuid)
returns table (
  original_amount numeric,
  tax_rate numeric,
  tax_amount numeric,
  final_amount numeric,
  pricing_signature text
)
language plpgsql
security definer
set search_path = public
as $$
begin
  perform set_config('request.jwt.claim.sub', p_provider_id::text, true);
  perform set_config(
    'request.jwt.claims',
    json_build_object('role', 'authenticated', 'sub', p_provider_id::text)::text,
    true
  );
  return query
  select *
  from public.calculate_provider_service_pricing(100.00::numeric);
end;
$$;

create or replace function pg_temp.rating_seed_contracted_service(
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
  v_pricing record;
  v_slot jsonb := jsonb_build_object(
    'start_date', to_char(current_date + 1, 'YYYY-MM-DD'),
    'shift', 'morning'
  );
begin
  select *
  into v_pricing
  from pg_temp.rating_get_pricing(p_provider_id);

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
    'rating rpc integration fixture',
    sr.description,
    sr.form_data,
    sr.form_version,
    'OPEN'::public.service_request_status,
    sr.urgency
  from public.service_requests sr
  where sr.id = '7017e457-5a32-44e7-b8da-1727a14f4d33'::uuid
  returning id into v_sr_id;

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
    v_pricing.original_amount,
    'Rating RPC integration proposal',
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

create or replace function pg_temp.rating_expected_overall(
  p_quality smallint,
  p_punctuality smallint,
  p_communication smallint,
  p_value smallint
)
returns numeric
language sql
stable
as $$
  -- Mirror matching.rating_dimension_weight_* seeds (service_role-only helper).
  select round((
    0.40::numeric * p_quality
    + 0.25::numeric * p_punctuality
    + 0.20::numeric * p_communication
    + 0.15::numeric * p_value
  )::numeric, 2);
$$;

create temp table _rating_provider as
select pg_temp.rating_seed_provider() as provider_id;

create temp table _rating_cs as
select pg_temp.rating_seed_contracted_service(
  (select provider_id from _rating_provider)
) as contracted_service_id;

create temp table _pending_cs as
select pg_temp.rating_seed_contracted_service(
  (select provider_id from _rating_provider),
  'PENDING_PAYMENT'::public.contracted_service_status
) as contracted_service_id;

create temp table _rating_client as
select cs.client_id
from public.contracted_services cs
where cs.id = (select contracted_service_id from _rating_cs);

select set_config(
  'test.rating.provider_id',
  (select provider_id from _rating_provider)::text,
  true
);
select set_config(
  'test.rating.cs_id',
  (select contracted_service_id from _rating_cs)::text,
  true
);
select set_config(
  'test.rating.pending_cs_id',
  (select contracted_service_id from _pending_cs)::text,
  true
);
select set_config(
  'test.rating.client_id',
  (select client_id from _rating_client)::text,
  true
);

-- EXECUTE revoked from authenticated; exercise RPC as service_role with actor JWT.
select ok(
  not has_function_privilege(
    'authenticated',
    'public.submit_service_rating(uuid, smallint, smallint, smallint, smallint, text)'::regprocedure,
    'EXECUTE'
  ),
  'authenticated cannot execute submit_service_rating'
);

select pg_temp.rls_set_service_as_user(current_setting('test.rating.client_id')::uuid);

select set_config(
  'test.rating.submit_response',
  public.submit_service_rating(
    current_setting('test.rating.cs_id')::uuid,
    5::smallint,
    4::smallint,
    4::smallint,
    5::smallint,
    'Great work'
  )::text,
  true
);

select ok(
  ((current_setting('test.rating.submit_response')::jsonb)->>'success')::boolean,
  'submit_service_rating: client submits rating for completed contracted service'
);

select is(
  ((current_setting('test.rating.submit_response')::jsonb)->>'overall_score')::numeric,
  pg_temp.rating_expected_overall(5::smallint, 4::smallint, 4::smallint, 5::smallint),
  'submit_service_rating: response overall_score uses weighted dimension formula'
);

select is(
  (
    select sr.overall_score
    from public.service_ratings sr
    where sr.contracted_service_id = current_setting('test.rating.cs_id')::uuid
  ),
  pg_temp.rating_expected_overall(5::smallint, 4::smallint, 4::smallint, 5::smallint),
  'submit_service_rating: persisted overall_score matches weighted formula'
);

select throws_ok(
  $$
    select public.submit_service_rating(
      current_setting('test.rating.cs_id')::uuid,
      5::smallint,
      5::smallint,
      5::smallint,
      5::smallint
    )
  $$,
  '23505',
  null,
  'submit_service_rating: duplicate submit is rejected'
);

select pg_temp.rls_set_service_as_user('4cf92e3a-64cd-4491-998e-9163138f8e96'::uuid);

select throws_ok(
  $$
    select public.submit_service_rating(
      current_setting('test.rating.cs_id')::uuid,
      5::smallint,
      5::smallint,
      5::smallint,
      5::smallint
    )
  $$,
  '42501',
  null,
  'submit_service_rating: non-client caller is rejected'
);

select pg_temp.rls_set_service_as_user(current_setting('test.rating.client_id')::uuid);

select throws_ok(
  $$
    select public.submit_service_rating(
      current_setting('test.rating.pending_cs_id')::uuid,
      5::smallint,
      5::smallint,
      5::smallint,
      5::smallint
    )
  $$,
  '22023',
  null,
  'submit_service_rating: non-completed contracted service is rejected'
);

select pg_temp.rls_set_service_as_user(current_setting('test.rating.client_id')::uuid);

select is(
  (
    select (public.update_service_rating(
      current_setting('test.rating.cs_id')::uuid,
      4::smallint,
      4::smallint,
      4::smallint,
      4::smallint,
      'Updated within window'
    )->>'overall_score')::numeric
  ),
  pg_temp.rating_expected_overall(4::smallint, 4::smallint, 4::smallint, 4::smallint),
  'update_service_rating: edit within 48 hours updates weighted overall_score'
);

reset role;

update public.service_ratings
set submitted_at = now() - interval '49 hours'
where contracted_service_id = current_setting('test.rating.cs_id')::uuid;

select pg_temp.rls_set_service_as_user(current_setting('test.rating.client_id')::uuid);

select throws_ok(
  $$
    select public.update_service_rating(
      current_setting('test.rating.cs_id')::uuid,
      3::smallint,
      3::smallint,
      3::smallint,
      3::smallint
    )
  $$,
  '22023',
  null,
  'update_service_rating: edit after 48 hours is rejected'
);

select pg_temp.rls_set_service_as_user('00000000-0000-0000-0000-000000000001'::uuid);

select throws_ok(
  $$
    select public.update_service_rating(
      current_setting('test.rating.cs_id')::uuid,
      3::smallint,
      3::smallint,
      3::smallint,
      3::smallint
    )
  $$,
  '42501',
  null,
  'update_service_rating: wrong client cannot update rating'
);

reset role;

select is(
  (
    select prs.rating_count
    from public.provider_rating_stats prs
    where prs.provider_id = current_setting('test.rating.provider_id')::uuid
  ),
  1,
  'rating RPC submit refreshes provider_rating_stats rating_count via trigger'
);

select pg_temp.rls_set_auth(current_setting('test.rating.client_id')::uuid);

select throws_ok(
  $$
    insert into public.service_ratings (
      contracted_service_id,
      service_request_id,
      client_id,
      provider_id,
      score_quality,
      score_punctuality,
      score_communication,
      score_value,
      overall_score
    )
    select
      cs.id,
      cs.service_request_id,
      cs.client_id,
      cs.provider_id,
      5::smallint,
      5::smallint,
      5::smallint,
      5::smallint,
      5.00
    from public.contracted_services cs
    where cs.id = current_setting('test.rating.pending_cs_id')::uuid
  $$,
  '42501',
  null,
  'RLS denies direct INSERT into service_ratings'
);

select finish();

rollback;

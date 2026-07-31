-- pgTAP: matching tables RLS — RPC-only writes, scoped rating reads (task 49).

begin;

select plan(37);

create or replace function pg_temp.rls_set_auth(p_user_id uuid)
returns void
language plpgsql
as $$
begin
  reset role;
  execute 'set local role authenticated';
  perform set_config('request.jwt.claim.sub', p_user_id::text, true);
  perform set_config(
    'request.jwt.claims',
    json_build_object('role', 'authenticated', 'sub', p_user_id::text)::text,
    true
  );
end;
$$;

create or replace function pg_temp.rls_set_anon()
returns void
language plpgsql
as $$
begin
  reset role;
  execute 'set local role anon';
  perform set_config('request.jwt.claim.sub', '', true);
  perform set_config(
    'request.jwt.claims',
    json_build_object('role', 'anon')::text,
    true
  );
end;
$$;

create or replace function pg_temp.rls_seed_user(
  p_user_id uuid,
  p_role text default 'client',
  p_name text default 'RLS test user'
)
returns void
language plpgsql
as $$
declare
  v_meta_role text := case when p_role = 'admin' then 'client' else p_role end;
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
    p_user_id::text || '@rls-test.local',
    crypt('Abc123', gen_salt('bf')),
    now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    json_build_object('full_name', p_name, 'role', v_meta_role)::jsonb,
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
      p_user_id::text || '@rls-test.local'
    )::jsonb,
    'email',
    p_user_id::text,
    now(),
    now(),
    now()
  )
  on conflict (provider_id, provider) do nothing;

  if p_role = 'admin' then
    alter table public.profiles disable trigger profiles_prevent_admin_role_update;
    update public.profiles
    set full_name = p_name, role = 'admin'
    where id = p_user_id;
    alter table public.profiles enable trigger profiles_prevent_admin_role_update;
  end if;
end;
$$;

select set_config('rls.client_id', '28e30f1d-3c47-441f-94c6-76b6ea0db470', true);
select set_config('rls.provider_id', '5d09e025-20a2-4842-aeef-324d42a431e1', true);
select set_config('rls.other_id', 'b2222222-2222-4222-8222-222222222222', true);

select pg_temp.rls_seed_user(current_setting('rls.other_id')::uuid, 'client', 'Matching RLS Other');

create or replace function pg_temp.matching_rls_seed_open_service_request()
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
    'matching rls pgTAP fixture',
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

create or replace function pg_temp.matching_rls_seed_fixtures()
returns table (
  dispatch_id uuid,
  batch_id uuid,
  visibility_id uuid,
  rating_id uuid,
  service_request_id uuid
)
language plpgsql
as $$
declare
  v_service_request_id uuid;
  v_dispatch_id uuid;
  v_batch_id uuid := gen_random_uuid();
  v_visibility_id uuid := gen_random_uuid();
  v_event_id uuid := gen_random_uuid();
  v_batch_provider_id uuid := gen_random_uuid();
  v_contracted_service_id uuid := gen_random_uuid();
  v_proposal_id uuid := gen_random_uuid();
  v_rating_id uuid := gen_random_uuid();
  v_slot jsonb := jsonb_build_object(
    'start_date', to_char(current_date + 1, 'YYYY-MM-DD'),
    'shift', 'morning'
  );
  v_pricing record;
begin
  v_service_request_id := pg_temp.matching_rls_seed_open_service_request();

  select d.id
  into v_dispatch_id
  from public.service_request_dispatches d
  where d.service_request_id = v_service_request_id;

  insert into public.service_request_dispatch_batches (
    id,
    dispatch_id,
    batch_number
  )
  values (v_batch_id, v_dispatch_id, 1);

  insert into public.service_request_dispatch_batch_providers (
    id,
    batch_id,
    provider_id,
    ranking_score
  )
  values (
    v_batch_provider_id,
    v_batch_id,
    current_setting('rls.provider_id')::uuid,
    4.5000
  );

  insert into public.service_request_provider_visibility (
    id,
    service_request_id,
    provider_id,
    source,
    granted_at
  )
  values (
    v_visibility_id,
    v_service_request_id,
    current_setting('rls.provider_id')::uuid,
    'batch',
    now()
  );

  insert into public.service_request_dispatch_events (
    id,
    dispatch_id,
    service_request_id,
    provider_id,
    event_type
  )
  values (
    v_event_id,
    v_dispatch_id,
    v_service_request_id,
    current_setting('rls.provider_id')::uuid,
    'batch_opened'::public.service_request_dispatch_event_type
  );

  insert into public.provider_latest_locations (
    provider_id,
    location,
    location_recorded_at
  )
  values (
    current_setting('rls.provider_id')::uuid,
    extensions.st_setsrid(extensions.st_makepoint(-46.6333, -23.5505), 4326)::extensions.geography,
    now()
  )
  on conflict (provider_id) do update set
    location = excluded.location,
    location_recorded_at = excluded.location_recorded_at,
    updated_at = now();

  perform pg_temp.rls_set_auth(current_setting('rls.provider_id')::uuid);
  select * into v_pricing from public.calculate_provider_service_pricing(100.00::numeric);
  select (public.create_provider_proposal(
    v_service_request_id,
    gen_random_uuid(),
    v_pricing.original_amount,
    'RLS rating fixture proposal',
    2,
    'hours',
    jsonb_build_array(v_slot),
    '{}'::text[],
    v_pricing.tax_rate,
    v_pricing.tax_amount,
    v_pricing.final_amount,
    v_pricing.pricing_signature
  )->>'id')::uuid
  into v_proposal_id;

  reset role;

  update public.provider_proposals
  set status = 'ACCEPTED'::public.proposal_status
  where id = v_proposal_id;

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
  values (
    v_contracted_service_id,
    v_service_request_id,
    v_proposal_id,
    current_setting('rls.client_id')::uuid,
    current_setting('rls.provider_id')::uuid,
    'hours',
    2,
    current_date + 1,
    null,
    'morning',
    v_slot,
    'COMPLETED'::public.contracted_service_status
  );

  insert into public.service_ratings (
    id,
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
  values (
    v_rating_id,
    v_contracted_service_id,
    v_service_request_id,
    current_setting('rls.client_id')::uuid,
    current_setting('rls.provider_id')::uuid,
    5,
    5,
    5,
    5,
    5.00
  );

  return query
  select v_dispatch_id, v_batch_id, v_visibility_id, v_rating_id, v_service_request_id;
end;
$$;

reset role;

create temp table _fixture as
select *
from pg_temp.matching_rls_seed_fixtures();

select set_config(
  'rls.dispatch_id',
  (select dispatch_id::text from _fixture),
  true
);
select set_config(
  'rls.rating_id',
  (select rating_id::text from _fixture),
  true
);
select set_config(
  'rls.service_request_id',
  (select service_request_id::text from _fixture),
  true
);

-- Structural: RLS deny policies on dispatch tables ----------------------------

select ok(
  (
    select count(*) = 3
    from pg_policies
    where schemaname = 'public'
      and tablename = 'service_request_dispatches'
      and policyname in (
        'service_request_dispatches_insert_denied',
        'service_request_dispatches_update_denied',
        'service_request_dispatches_delete_denied'
      )
  ),
  'service_request_dispatches has insert/update/delete deny policies'
);

select ok(
  (
    select count(*) = 3
    from pg_policies
    where schemaname = 'public'
      and tablename = 'service_request_dispatch_batches'
      and policyname in (
        'service_request_dispatch_batches_insert_denied',
        'service_request_dispatch_batches_update_denied',
        'service_request_dispatch_batches_delete_denied'
      )
  ),
  'service_request_dispatch_batches has insert/update/delete deny policies'
);

select ok(
  (
    select count(*) = 3
    from pg_policies
    where schemaname = 'public'
      and tablename = 'service_request_dispatch_batch_providers'
      and policyname in (
        'service_request_dispatch_batch_providers_insert_denied',
        'service_request_dispatch_batch_providers_update_denied',
        'service_request_dispatch_batch_providers_delete_denied'
      )
  ),
  'service_request_dispatch_batch_providers has insert/update/delete deny policies'
);

select ok(
  (
    select count(*) = 3
    from pg_policies
    where schemaname = 'public'
      and tablename = 'service_request_provider_visibility'
      and policyname in (
        'service_request_provider_visibility_insert_denied',
        'service_request_provider_visibility_update_denied',
        'service_request_provider_visibility_delete_denied'
      )
  ),
  'service_request_provider_visibility has insert/update/delete deny policies'
);

select ok(
  (
    select count(*) = 3
    from pg_policies
    where schemaname = 'public'
      and tablename = 'service_request_dispatch_events'
      and policyname in (
        'service_request_dispatch_events_insert_denied',
        'service_request_dispatch_events_update_denied',
        'service_request_dispatch_events_delete_denied'
      )
  ),
  'service_request_dispatch_events has insert/update/delete deny policies'
);

select ok(
  (
    select c.relrowsecurity
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public'
      and c.relname = 'provider_latest_locations'
  ),
  'provider_latest_locations has RLS enabled (default deny, no permissive policies)'
);

select is(
  (
    select count(*)::int
    from pg_policies
    where schemaname = 'public'
      and tablename = 'provider_latest_locations'
  ),
  0,
  'provider_latest_locations has no permissive policies'
);

-- Behavioral: SELECT denied on dispatch + location tables ---------------------

select pg_temp.rls_set_auth(current_setting('rls.provider_id')::uuid);

select is(
  (select count(*)::int from public.service_request_dispatches),
  0,
  'authenticated cannot SELECT service_request_dispatches'
);

select is(
  (select count(*)::int from public.service_request_dispatch_batches),
  0,
  'authenticated cannot SELECT service_request_dispatch_batches'
);

select is(
  (select count(*)::int from public.service_request_dispatch_batch_providers),
  0,
  'authenticated cannot SELECT service_request_dispatch_batch_providers'
);

select is(
  (select count(*)::int from public.service_request_provider_visibility),
  0,
  'authenticated cannot SELECT service_request_provider_visibility'
);

select is(
  (select count(*)::int from public.service_request_dispatch_events),
  0,
  'authenticated cannot SELECT service_request_dispatch_events'
);

-- Grant hygiene revoked table SELECT (42501) rather than RLS empty-set (0 rows).
select throws_ok(
  $$select count(*)::int from public.provider_latest_locations$$,
  '42501',
  null,
  'authenticated cannot SELECT provider_latest_locations (no table privilege)'
);

-- Behavioral: INSERT denied (RLS) -------------------------------------------

select throws_ok(
  $$
    insert into public.service_request_dispatch_events (
      dispatch_id,
      service_request_id,
      event_type
    )
    values (
      current_setting('rls.dispatch_id')::uuid,
      current_setting('rls.service_request_id')::uuid,
      'batch_opened'::public.service_request_dispatch_event_type
    )
  $$,
  '42501',
  null,
  'authenticated cannot INSERT service_request_dispatch_events'
);

select throws_ok(
  $$
    insert into public.service_request_provider_visibility (
      service_request_id,
      provider_id,
      source,
      granted_at
    )
    values (
      current_setting('rls.service_request_id')::uuid,
      '5d09e025-20a2-4842-aeef-324d42a431e1'::uuid,
      'batch',
      now()
    )
  $$,
  '42501',
  null,
  'authenticated cannot INSERT service_request_provider_visibility'
);

select throws_ok(
  $$
    insert into public.provider_latest_locations (
      provider_id,
      location,
      location_recorded_at
    )
    values (
      '5d09e025-20a2-4842-aeef-324d42a431e1'::uuid,
      extensions.st_setsrid(extensions.st_makepoint(-46.6, -23.5), 4326)::extensions.geography,
      now()
    )
  $$,
  '42501',
  null,
  'authenticated cannot INSERT provider_latest_locations'
);

-- provider_proposal_stats: deny all authenticated access ----------------------

select ok(
  (
    select count(*) = 3
    from pg_policies
    where schemaname = 'public'
      and tablename = 'provider_proposal_stats'
      and policyname in (
        'provider_proposal_stats_insert_denied',
        'provider_proposal_stats_update_denied',
        'provider_proposal_stats_delete_denied'
      )
  ),
  'provider_proposal_stats has insert/update/delete deny policies'
);

select is(
  (select count(*)::int from public.provider_proposal_stats),
  0,
  'authenticated cannot SELECT provider_proposal_stats'
);

-- provider_rating_stats: client SELECT revoked (grant hygiene) ----------------

select ok(
  not has_table_privilege('authenticated', 'public.provider_rating_stats', 'SELECT'),
  'authenticated cannot SELECT provider_rating_stats'
);

select ok(
  not has_table_privilege('anon', 'public.provider_rating_stats', 'SELECT'),
  'anon cannot SELECT provider_rating_stats'
);

select pg_temp.rls_set_auth(current_setting('rls.other_id')::uuid);

select throws_ok(
  format(
    $$select count(*)::int from public.provider_rating_stats where provider_id = %L$$,
    current_setting('rls.provider_id')
  ),
  '42501',
  null,
  'authenticated cannot read provider_rating_stats aggregates'
);

-- service_ratings: scoped SELECT, RPC-only writes -------------------------------

select ok(
  (
    select count(*) = 3
    from pg_policies
    where schemaname = 'public'
      and tablename = 'service_ratings'
      and policyname in (
        'service_ratings_insert_denied',
        'service_ratings_update_denied',
        'service_ratings_delete_denied'
      )
  ),
  'service_ratings has insert/update/delete deny policies'
);

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
    values (
      gen_random_uuid(),
      '7017e457-5a32-44e7-b8da-1727a14f4d33'::uuid,
      '28e30f1d-3c47-441f-94c6-76b6ea0db470'::uuid,
      '5d09e025-20a2-4842-aeef-324d42a431e1'::uuid,
      5, 5, 5, 5, 5.00
    )
  $$,
  '42501',
  null,
  'authenticated cannot INSERT service_ratings'
);

select pg_temp.rls_set_auth(current_setting('rls.client_id')::uuid);

select ok(
  (
    select count(*) = 1
    from public.service_ratings
    where id = current_setting('rls.rating_id')::uuid
  ),
  'client reads own service_ratings row (service_ratings_select)'
);

select pg_temp.rls_set_auth(current_setting('rls.provider_id')::uuid);

select ok(
  (
    select count(*) = 1
    from public.service_ratings
    where id = current_setting('rls.rating_id')::uuid
  ),
  'provider reads received service_ratings row (service_ratings_select)'
);

select pg_temp.rls_set_auth(current_setting('rls.other_id')::uuid);

select is(
  (select count(*)::int from public.service_ratings),
  0,
  'unrelated authenticated user cannot SELECT service_ratings'
);

-- Structural: deny SELECT policies exist on dispatch tables -------------------

select ok(
  (
    select count(*) = 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'service_request_dispatches'
      and policyname = 'service_request_dispatches_select_denied'
  ),
  'service_request_dispatches_select_denied policy exists'
);

select ok(
  (
    select count(*) = 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'service_request_provider_visibility'
      and policyname = 'service_request_provider_visibility_select_denied'
  ),
  'service_request_provider_visibility_select_denied policy exists'
);

-- REVOKE audit: cron/gate/batch RPCs not callable by clients (task 50) --------

select ok(
  not has_function_privilege(
    'anon',
    'public.cron_process_service_request_dispatches()'::regprocedure,
    'EXECUTE'
  ),
  'anon cannot execute cron_process_service_request_dispatches'
);

select ok(
  not has_function_privilege(
    'authenticated',
    'public.cron_process_service_request_dispatches()'::regprocedure,
    'EXECUTE'
  ),
  'authenticated cannot execute cron_process_service_request_dispatches'
);

select ok(
  has_function_privilege(
    'postgres',
    'public.cron_process_service_request_dispatches()'::regprocedure,
    'EXECUTE'
  ),
  'postgres can execute cron_process_service_request_dispatches'
);

select ok(
  not has_function_privilege(
    'anon',
    'public.evaluate_service_request_dispatch_gates(uuid)'::regprocedure,
    'EXECUTE'
  ),
  'anon cannot execute evaluate_service_request_dispatch_gates'
);

select ok(
  not has_function_privilege(
    'authenticated',
    'public.evaluate_service_request_dispatch_gates(uuid)'::regprocedure,
    'EXECUTE'
  ),
  'authenticated cannot execute evaluate_service_request_dispatch_gates'
);

select ok(
  has_function_privilege(
    'service_role',
    'public.evaluate_service_request_dispatch_gates(uuid)'::regprocedure,
    'EXECUTE'
  ),
  'service_role can execute evaluate_service_request_dispatch_gates'
);

select ok(
  not has_function_privilege(
    'anon',
    'public.matching_open_batch(uuid)'::regprocedure,
    'EXECUTE'
  ),
  'anon cannot execute matching_open_batch'
);

select ok(
  not has_function_privilege(
    'authenticated',
    'public.matching_open_batch(uuid)'::regprocedure,
    'EXECUTE'
  ),
  'authenticated cannot execute matching_open_batch'
);

select ok(
  has_function_privilege(
    'service_role',
    'public.matching_open_batch(uuid)'::regprocedure,
    'EXECUTE'
  ),
  'service_role can execute matching_open_batch'
);

select finish();

rollback;

-- pgTAP: provider rating read RPCs — aggregates, public list cursor pagination,
-- visibility gate, no client PII, project_service_row client_rating_* fields.

begin;

reset role;

select plan(18);

-- Auth helpers (inlined so this file runs under supabase test db <path>).
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

create or replace function pg_temp.rating_read_seed_provider(
  p_slug text,
  p_visibility text default 'public'
)
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
    v_provider_id::text || '@rating-read-rpcs.local',
    crypt('Abc123', gen_salt('bf')),
    now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    json_build_object('full_name', 'Rating read provider', 'role', 'provider')::jsonb,
    now(),
    now(),
    '',
    '',
    '',
    ''
  );

  insert into public.profiles (id, role, full_name)
  values (v_provider_id, 'provider', 'Rating read provider')
  on conflict (id) do update
    set role = excluded.role,
        full_name = excluded.full_name;

  insert into public.provider_profiles_public (
    provider_id,
    display_name,
    slug,
    profile_visibility
  )
  values (
    v_provider_id,
    'Rating read provider',
    p_slug,
    p_visibility
  )
  on conflict (provider_id) do update
    set display_name = excluded.display_name,
        slug = excluded.slug,
        profile_visibility = excluded.profile_visibility;

  return v_provider_id;
end;
$$;

create or replace function pg_temp.rating_read_seed_contracted(
  p_provider_id uuid,
  p_client_id uuid,
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
    p_client_id,
    sr.service_id,
    sr.address_id,
    'rating read rpc fixture',
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
    v_pricing.original_amount,
    'Rating read proposal',
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
  values (
    v_contracted_service_id,
    v_sr_id,
    v_proposal_id,
    p_client_id,
    p_provider_id,
    'hours',
    2,
    current_date + 1,
    null,
    'morning',
    v_slot,
    p_status
  );

  update public.service_requests
  set
    status = 'COMPLETED'::public.service_request_status,
    contracted_service_id = v_contracted_service_id,
    completed_at = now()
  where id = v_sr_id;

  return v_contracted_service_id;
end;
$$;

create or replace function pg_temp.rating_read_insert_rating(
  p_contracted_service_id uuid,
  p_overall numeric,
  p_comment text,
  p_submitted_at timestamptz
)
returns uuid
language plpgsql
as $$
declare
  v_id uuid := gen_random_uuid();
  v_cs public.contracted_services%rowtype;
begin
  select * into v_cs
  from public.contracted_services
  where id = p_contracted_service_id;

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
    overall_score,
    comment,
    submitted_at
  )
  values (
    v_id,
    v_cs.id,
    v_cs.service_request_id,
    v_cs.client_id,
    v_cs.provider_id,
    5,
    5,
    5,
    5,
    p_overall,
    p_comment,
    p_submitted_at
  );

  return v_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- Fixtures
-- ---------------------------------------------------------------------------

select set_config(
  'test.rr.public_provider_id',
  pg_temp.rating_read_seed_provider('rating-read-public-slug', 'public')::text,
  true
);
select set_config(
  'test.rr.restricted_provider_id',
  pg_temp.rating_read_seed_provider('rating-read-restricted-slug', 'restricted')::text,
  true
);
select set_config(
  'test.rr.client_id',
  '28e30f1d-3c47-441f-94c6-76b6ea0db470',
  true
);

select set_config(
  'test.rr.cs_public',
  pg_temp.rating_read_seed_contracted(
    current_setting('test.rr.public_provider_id')::uuid,
    current_setting('test.rr.client_id')::uuid
  )::text,
  true
);
select set_config(
  'test.rr.cs_public_2',
  pg_temp.rating_read_seed_contracted(
    current_setting('test.rr.public_provider_id')::uuid,
    current_setting('test.rr.client_id')::uuid
  )::text,
  true
);
select set_config(
  'test.rr.cs_public_3',
  pg_temp.rating_read_seed_contracted(
    current_setting('test.rr.public_provider_id')::uuid,
    current_setting('test.rr.client_id')::uuid
  )::text,
  true
);
select set_config(
  'test.rr.cs_restricted',
  pg_temp.rating_read_seed_contracted(
    current_setting('test.rr.restricted_provider_id')::uuid,
    current_setting('test.rr.client_id')::uuid
  )::text,
  true
);

select set_config(
  'test.rr.rating_1',
  pg_temp.rating_read_insert_rating(
    current_setting('test.rr.cs_public')::uuid,
    4.50,
    'Ótimo serviço',
    timestamptz '2026-08-01 12:00:00+00'
  )::text,
  true
);
select set_config(
  'test.rr.rating_2',
  pg_temp.rating_read_insert_rating(
    current_setting('test.rr.cs_public_2')::uuid,
    5.00,
    '',
    timestamptz '2026-08-02 12:00:00+00'
  )::text,
  true
);
select set_config(
  'test.rr.rating_3',
  pg_temp.rating_read_insert_rating(
    current_setting('test.rr.cs_public_3')::uuid,
    3.75,
    'Bom',
    timestamptz '2026-08-03 12:00:00+00'
  )::text,
  true
);
select set_config(
  'test.rr.rating_restricted',
  pg_temp.rating_read_insert_rating(
    current_setting('test.rr.cs_restricted')::uuid,
    4.00,
    'Restrito',
    timestamptz '2026-08-04 12:00:00+00'
  )::text,
  true
);

-- ---------------------------------------------------------------------------
-- Grants
-- ---------------------------------------------------------------------------

select ok(
  has_function_privilege(
    'authenticated',
    'public.get_provider_rating_summaries(uuid[])'::regprocedure,
    'EXECUTE'
  ),
  'authenticated can execute get_provider_rating_summaries'
);

select ok(
  not has_function_privilege(
    'anon',
    'public.get_provider_rating_summaries(uuid[])'::regprocedure,
    'EXECUTE'
  ),
  'anon cannot execute get_provider_rating_summaries'
);

select ok(
  has_function_privilege(
    'anon',
    'public.list_public_provider_ratings(uuid, integer, timestamptz, uuid)'::regprocedure,
    'EXECUTE'
  ),
  'anon can execute list_public_provider_ratings'
);

-- ---------------------------------------------------------------------------
-- get_public_provider_by_slug aggregates
-- ---------------------------------------------------------------------------

select pg_temp.rls_set_anon();

select is(
  (
    select (public.get_public_provider_by_slug('rating-read-public-slug')->>'rating_count')::int
  ),
  3,
  'get_public_provider_by_slug rating_count matches inserted ratings'
);

select ok(
  (
    select (public.get_public_provider_by_slug('rating-read-public-slug')->>'rating_avg')::numeric
      between 4.40 and 4.45
  ),
  'get_public_provider_by_slug rating_avg is overall average'
);

select is(
  (
    select (public.get_public_provider_by_slug('rating-read-public-slug')->>'completed_services_count')::int
  ),
  3,
  'get_public_provider_by_slug completed_services_count counts COMPLETED'
);

select is(
  public.get_public_provider_by_slug('rating-read-restricted-slug'),
  null::jsonb,
  'anon cannot read restricted provider via get_public_provider_by_slug'
);

-- ---------------------------------------------------------------------------
-- get_provider_rating_summaries
-- ---------------------------------------------------------------------------

select pg_temp.rls_set_auth(current_setting('test.rr.client_id')::uuid);

select is(
  (
    select jsonb_array_length(
      public.get_provider_rating_summaries(array[
        current_setting('test.rr.public_provider_id')::uuid,
        current_setting('test.rr.restricted_provider_id')::uuid
      ])
    )
  ),
  2,
  'get_provider_rating_summaries returns one entry per requested provider'
);

select is(
  (
    select (s->>'rating_count')::int
    from jsonb_array_elements(
      public.get_provider_rating_summaries(
        array[current_setting('test.rr.public_provider_id')::uuid]
      )
    ) s
    limit 1
  ),
  3,
  'get_provider_rating_summaries rating_count for public provider'
);

select is(
  (
    select (s->>'completed_services_count')::int
    from jsonb_array_elements(
      public.get_provider_rating_summaries(
        array[current_setting('test.rr.public_provider_id')::uuid]
      )
    ) s
    limit 1
  ),
  3,
  'get_provider_rating_summaries completed_services_count for public provider'
);

-- ---------------------------------------------------------------------------
-- list_public_provider_ratings — visibility, PII, cursor
-- ---------------------------------------------------------------------------

select pg_temp.rls_set_anon();

select is(
  public.list_public_provider_ratings(
    current_setting('test.rr.restricted_provider_id')::uuid,
    20,
    null,
    null
  ),
  null::jsonb,
  'anon list_public_provider_ratings returns null for restricted profile'
);

select ok(
  (
    select
      not (payload::text like '%' || current_setting('test.rr.client_id') || '%')
      and not (payload::text ilike '%client_id%')
      and not (payload::text ilike '%full_name%')
    from (
      select public.list_public_provider_ratings(
        current_setting('test.rr.public_provider_id')::uuid,
        20,
        null,
        null
      ) as payload
    ) q
  ),
  'list_public_provider_ratings omits client PII'
);

select set_config(
  'test.rr.page1',
  public.list_public_provider_ratings(
    current_setting('test.rr.public_provider_id')::uuid,
    2,
    null,
    null
  )::text,
  true
);

select ok(
  (
    select
      (payload->>'has_more')::boolean
      and jsonb_array_length(payload->'items') = 2
      and payload->'next_cursor' is not null
      and payload->'next_cursor' ? 'submitted_at'
      and payload->'next_cursor' ? 'id'
    from (select current_setting('test.rr.page1')::jsonb as payload) q
  ),
  'list page 1 returns 2 items, has_more, and next_cursor'
);

select set_config(
  'test.rr.page2',
  public.list_public_provider_ratings(
    current_setting('test.rr.public_provider_id')::uuid,
    2,
    ((current_setting('test.rr.page1')::jsonb->'next_cursor'->>'submitted_at')::timestamptz),
    ((current_setting('test.rr.page1')::jsonb->'next_cursor'->>'id')::uuid)
  )::text,
  true
);

select ok(
  (
    select
      not (payload->>'has_more')::boolean
      and jsonb_array_length(payload->'items') = 1
      and payload->>'next_cursor' is null
    from (select current_setting('test.rr.page2')::jsonb as payload) q
  ),
  'list page 2 returns remaining item without has_more'
);

select ok(
  (
    select
      not exists (
        select 1
        from jsonb_array_elements(p1->'items') a
        join jsonb_array_elements(p2->'items') b on a->>'id' = b->>'id'
      )
    from (
      select
        current_setting('test.rr.page1')::jsonb as p1,
        current_setting('test.rr.page2')::jsonb as p2
    ) q
  ),
  'list cursor page 2 does not repeat page 1 items'
);

select is(
  (
    select i->>'comment'
    from jsonb_array_elements(current_setting('test.rr.page1')::jsonb->'items') i
    where i->>'id' = current_setting('test.rr.rating_2')
  ),
  null,
  'empty comment is returned as null (no fake text)'
);

-- ---------------------------------------------------------------------------
-- project_service_row client_rating_*
-- ---------------------------------------------------------------------------

reset role;

select ok(
  (
    select pg_get_functiondef(p.oid) ~ 'client_rating_overall_score'
      and pg_get_functiondef(p.oid) ~ 'client_rating_submitted_at'
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname = 'project_service_row'
      and pg_get_function_identity_arguments(p.oid) in (
        'uuid, uuid',
        'p_service_request_id uuid, p_viewer_id uuid'
      )
  ),
  'project_service_row projects client_rating_overall_score and client_rating_submitted_at'
);

select is(
  (
    select (public.project_service_row(cs.service_request_id, cs.client_id)
      -> 'contracted' ->> 'client_rating_overall_score')::numeric
    from public.contracted_services cs
    where cs.id = current_setting('test.rr.cs_public')::uuid
  ),
  4.50,
  'project_service_row contracted client_rating_overall_score matches service_ratings'
);

select * from finish();
rollback;

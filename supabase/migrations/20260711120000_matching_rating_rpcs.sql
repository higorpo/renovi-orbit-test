-- Matching M13a — submit_service_rating RPC (design §15.6, ADR 0005).

create or replace function public.submit_service_rating(
  p_contracted_service_id uuid,
  p_score_quality smallint,
  p_score_punctuality smallint,
  p_score_communication smallint,
  p_score_value smallint,
  p_comment text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_client_id uuid := auth.uid();
  v_cs public.contracted_services%rowtype;
  v_overall numeric(4, 2);
  v_rating_id uuid;
  v_w_quality numeric;
  v_w_punctuality numeric;
  v_w_communication numeric;
  v_w_value numeric;
begin
  if v_client_id is null then
    raise exception 'Authentication required'
      using errcode = '28000';
  end if;

  if p_contracted_service_id is null then
    raise exception 'p_contracted_service_id is required'
      using errcode = '22023';
  end if;

  if p_score_quality not between 1 and 5
    or p_score_punctuality not between 1 and 5
    or p_score_communication not between 1 and 5
    or p_score_value not between 1 and 5
  then
    raise exception 'dimension scores must be between 1 and 5'
      using errcode = '22023';
  end if;

  select *
  into v_cs
  from public.contracted_services cs
  where cs.id = p_contracted_service_id
  for update;

  if not found then
    raise exception 'contracted service not found'
      using errcode = 'P0001';
  end if;

  if v_cs.client_id is distinct from v_client_id then
    raise exception 'not authorized to rate this contracted service'
      using errcode = '42501';
  end if;

  if v_cs.status <> 'COMPLETED'::public.contracted_service_status then
    raise exception 'contracted service must be COMPLETED before rating'
      using errcode = '22023';
  end if;

  if exists (
    select 1
    from public.service_ratings sr
    where sr.contracted_service_id = p_contracted_service_id
  ) then
    raise exception 'rating already exists for contracted service'
      using errcode = '23505';
  end if;

  v_w_quality := public.platform_constant_numeric('matching.rating_dimension_weight_quality', 0.40);
  v_w_punctuality := public.platform_constant_numeric('matching.rating_dimension_weight_punctuality', 0.25);
  v_w_communication := public.platform_constant_numeric('matching.rating_dimension_weight_communication', 0.20);
  v_w_value := public.platform_constant_numeric('matching.rating_dimension_weight_value', 0.15);

  v_overall := round((
    v_w_quality * p_score_quality
    + v_w_punctuality * p_score_punctuality
    + v_w_communication * p_score_communication
    + v_w_value * p_score_value
  )::numeric, 2);

  insert into public.service_ratings (
    contracted_service_id,
    service_request_id,
    client_id,
    provider_id,
    score_quality,
    score_punctuality,
    score_communication,
    score_value,
    overall_score,
    comment
  )
  values (
    p_contracted_service_id,
    v_cs.service_request_id,
    v_cs.client_id,
    v_cs.provider_id,
    p_score_quality,
    p_score_punctuality,
    p_score_communication,
    p_score_value,
    v_overall,
    nullif(btrim(p_comment), '')
  )
  returning id into v_rating_id;

  return jsonb_build_object(
    'success', true,
    'rating_id', v_rating_id,
    'overall_score', v_overall
  );
end;
$$;

comment on function public.submit_service_rating(uuid, smallint, smallint, smallint, smallint, text) is
  'Client submits a rating for a COMPLETED contracted service; stats refresh via trigger.';

revoke all on function public.submit_service_rating(uuid, smallint, smallint, smallint, smallint, text) from public;
grant execute on function public.submit_service_rating(uuid, smallint, smallint, smallint, smallint, text) to authenticated;

-- Matching M13b — update_service_rating RPC (design §15.6, ADR 0005).

create or replace function public.update_service_rating(
  p_contracted_service_id uuid,
  p_score_quality smallint,
  p_score_punctuality smallint,
  p_score_communication smallint,
  p_score_value smallint,
  p_comment text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_client_id uuid := auth.uid();
  v_rating public.service_ratings%rowtype;
  v_overall numeric(4, 2);
  v_w_quality numeric;
  v_w_punctuality numeric;
  v_w_communication numeric;
  v_w_value numeric;
begin
  if v_client_id is null then
    raise exception 'Authentication required'
      using errcode = '28000';
  end if;

  if p_contracted_service_id is null then
    raise exception 'p_contracted_service_id is required'
      using errcode = '22023';
  end if;

  if p_score_quality not between 1 and 5
    or p_score_punctuality not between 1 and 5
    or p_score_communication not between 1 and 5
    or p_score_value not between 1 and 5
  then
    raise exception 'dimension scores must be between 1 and 5'
      using errcode = '22023';
  end if;

  select *
  into v_rating
  from public.service_ratings sr
  where sr.contracted_service_id = p_contracted_service_id
  for update;

  if not found then
    raise exception 'rating not found for contracted service'
      using errcode = 'P0001';
  end if;

  if v_rating.client_id is distinct from v_client_id then
    raise exception 'not authorized to update this rating'
      using errcode = '42501';
  end if;

  if now() > v_rating.submitted_at + interval '48 hours' then
    raise exception 'rating edit window has expired'
      using errcode = '22023';
  end if;

  v_w_quality := public.platform_constant_numeric('matching.rating_dimension_weight_quality', 0.40);
  v_w_punctuality := public.platform_constant_numeric('matching.rating_dimension_weight_punctuality', 0.25);
  v_w_communication := public.platform_constant_numeric('matching.rating_dimension_weight_communication', 0.20);
  v_w_value := public.platform_constant_numeric('matching.rating_dimension_weight_value', 0.15);

  v_overall := round((
    v_w_quality * p_score_quality
    + v_w_punctuality * p_score_punctuality
    + v_w_communication * p_score_communication
    + v_w_value * p_score_value
  )::numeric, 2);

  update public.service_ratings
  set
    score_quality = p_score_quality,
    score_punctuality = p_score_punctuality,
    score_communication = p_score_communication,
    score_value = p_score_value,
    overall_score = v_overall,
    comment = nullif(btrim(p_comment), '')
  where id = v_rating.id;

  return jsonb_build_object(
    'success', true,
    'rating_id', v_rating.id,
    'overall_score', v_overall
  );
end;
$$;

comment on function public.update_service_rating(uuid, smallint, smallint, smallint, smallint, text) is
  'Client updates a rating within 48 hours of submit; stats refresh via trigger.';

revoke all on function public.update_service_rating(uuid, smallint, smallint, smallint, smallint, text) from public;
grant execute on function public.update_service_rating(uuid, smallint, smallint, smallint, smallint, text) to authenticated;

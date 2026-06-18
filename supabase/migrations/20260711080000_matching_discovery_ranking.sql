-- Matching M9 — discovery + ranking (design §15.1, §15.2).

create or replace function public.matching_h3_ring_cells(
  p_center_h3 bigint,
  p_resolution int
)
returns setof bigint
language plpgsql
stable
set search_path = public, extensions
as $$
declare
  v_cell bigint;
begin
  if p_center_h3 is null then
    return;
  end if;

  begin
    for v_cell in
      execute $sql$
        select cell::bigint
        from (
          select unnest(extensions.h3_grid_disk($1::extensions.h3index, 3)) as cell
        ) disk
      $sql$
      using p_center_h3
    loop
      return next v_cell;
    end loop;
  exception
    when others then
      return;
  end;
end;
$$;

comment on function public.matching_h3_ring_cells(bigint, int) is
  'Returns H3 grid disk (k=3) for coarse discovery pre-filter; empty when h3 extension unavailable.';

create or replace function public.matching_discover_candidates(
  p_service_request_id uuid,
  p_limit int default null
)
returns table (
  provider_id uuid,
  distance_meters numeric,
  has_valid_beacon boolean,
  device_id text
)
language plpgsql
stable
security definer
set search_path = public, extensions
as $$
declare
  v_sr record;
  v_freshness_hours int;
  v_h3_res int;
  v_center_h3 bigint;
  v_radius_m numeric;
  v_pool_cap int;
begin
  v_pool_cap := public.platform_constant_int('matching.discovery_pool_cap', 200);
  p_limit := least(
    greatest(coalesce(p_limit, v_pool_cap), 1),
    v_pool_cap
  );
  v_radius_m := public.platform_constant_numeric('matching.discovery_beacon_radius_meters', 20000);

  select
    sr.id,
    sr.location,
    sr.h3_index,
    sr.service_id,
    pn.id as neighborhood_id
  into v_sr
  from public.service_requests sr
  join public.client_addresses ca on ca.id = sr.address_id
  left join public.platform_neighborhoods pn
    on pn.city_id = ca.city_id
    and lower(trim(pn.name)) = lower(trim(ca.neighborhood))
  where sr.id = p_service_request_id
    and sr.status = 'OPEN'::public.service_request_status;

  if not found then
    return;
  end if;

  v_freshness_hours := public.platform_constant_int('matching.beacon_location_max_age_hours', 24);
  v_h3_res := public.platform_constant_int('matching.h3_resolution', 7);

  if v_sr.h3_index is not null and btrim(v_sr.h3_index) ~ '^[0-9]+$' then
    v_center_h3 := v_sr.h3_index::bigint;
  else
    v_center_h3 := null;
  end if;

  return query
  with h3_cells as (
    select cell
    from public.matching_h3_ring_cells(v_center_h3, v_h3_res) as cell
  ),
  excluded as (
    select v.provider_id
    from public.service_request_provider_visibility v
    where v.service_request_id = p_service_request_id
      and v.source = 'batch'
      and v.revoked_at is null
  ),
  beacon_prefilter as (
    select
      pll.provider_id,
      pll.device_id,
      st_distance(pll.location, v_sr.location)::numeric as distance_meters,
      true as has_valid_beacon
    from public.provider_latest_locations pll
    join public.profiles p on p.id = pll.provider_id
    join public.provider_offered_services pos
      on pos.provider_id = p.id
      and pos.service_id = v_sr.service_id
    where p.role = 'provider'
      and p.operational_status = 'active'::public.provider_operational_status
      and pll.location is not null
      and v_sr.location is not null
      and pll.location_recorded_at >= now() - (v_freshness_hours || ' hours')::interval
      and st_dwithin(pll.location, v_sr.location, v_radius_m)
      and not exists (
        select 1 from excluded e where e.provider_id = pll.provider_id
      )
      and (
        not exists (select 1 from h3_cells)
        or pll.h3_index in (select hc.cell from h3_cells hc)
      )
  ),
  neighborhood_prefilter as (
    select
      p.id as provider_id,
      null::text as device_id,
      null::numeric as distance_meters,
      false as has_valid_beacon
    from public.profiles p
    join public.provider_offered_services pos
      on pos.provider_id = p.id
      and pos.service_id = v_sr.service_id
    join public.provider_service_area_neighborhoods psan on psan.provider_id = p.id
    where p.role = 'provider'
      and p.operational_status = 'active'::public.provider_operational_status
      and v_sr.neighborhood_id is not null
      and psan.neighborhood_id = v_sr.neighborhood_id
      and not exists (
        select 1 from excluded e where e.provider_id = p.id
      )
      and not exists (
        select 1 from beacon_prefilter be where be.provider_id = p.id
      )
  ),
  candidate_union as (
    select * from beacon_prefilter
    union all
    select * from neighborhood_prefilter
  ),
  load_cap as (
    select
      cu.provider_id,
      count(cs.id) filter (
        where cs.status = 'PENDING_PAYMENT'::public.contracted_service_status
          and cs.scheduled_start_date is not null
          and cs.scheduled_end_date is not null
          and daterange(cs.scheduled_start_date, cs.scheduled_end_date, '[]')
            && daterange(
              current_date,
              current_date + public.platform_constant_int('matching.provider_load_lookforward_days', 14),
              '[]'
            )
      ) as scheduled_load
    from candidate_union cu
    left join public.contracted_services cs on cs.provider_id = cu.provider_id
    group by cu.provider_id
  ),
  combined as (
    select
      cu.provider_id,
      cu.distance_meters,
      cu.has_valid_beacon,
      cu.device_id
    from candidate_union cu
    join load_cap lc on lc.provider_id = cu.provider_id
    where lc.scheduled_load < public.platform_constant_int('matching.provider_max_scheduled_load', 28)
  )
  select
    c.provider_id,
    c.distance_meters,
    c.has_valid_beacon,
    c.device_id
  from combined c
  order by c.distance_meters nulls last, c.provider_id
  limit p_limit;
end;
$$;

comment on function public.matching_discover_candidates(uuid, int) is
  'Discovers eligible providers for batch open: beacon radius path union neighborhood fallback; pool cap from platform_constants.';

create or replace function public.matching_rank_candidates_with_discover(
  p_service_request_id uuid,
  p_discovered jsonb
)
returns table (
  provider_id uuid,
  ranking_score numeric,
  score_components jsonb,
  device_id text
)
language sql
stable
security definer
set search_path = public, extensions
as $$
  with cfg as (
    select
      public.platform_constant_numeric('matching.ranking_weight_proximity', 0.40) as w_prox,
      public.platform_constant_numeric('matching.ranking_weight_quality', 0.35) as w_qual,
      public.platform_constant_numeric('matching.ranking_weight_conversion', 0.25) as w_conv,
      public.platform_constant_numeric('matching.no_beacon_score_penalty', 0.20) as no_beacon_pen,
      public.platform_constant_numeric('matching.ranking_exploration_max_boost', 0.10) as max_expl,
      public.platform_constant_int('matching.ranking_tiebreak_exposure_lookback_hours', 24) as exp_hours,
      public.platform_constant_numeric('matching.discovery_beacon_radius_meters', 20000) as radius_m
  ),
  discover as (
    select
      (row->>'provider_id')::uuid as provider_id,
      nullif(row->>'distance_meters', '')::numeric as distance_meters,
      coalesce((row->>'has_valid_beacon')::boolean, false) as has_valid_beacon,
      nullif(row->>'device_id', '') as device_id
    from jsonb_array_elements(coalesce(p_discovered, '[]'::jsonb)) as row
    where nullif(row->>'provider_id', '') is not null
  ),
  exposure as (
    select
      vis.provider_id,
      count(*)::int as exposure_count
    from public.service_request_provider_visibility vis
    inner join discover d on d.provider_id = vis.provider_id
    cross join cfg
    where vis.source = 'batch'
      and vis.revoked_at is null
      and vis.granted_at >= now() - (cfg.exp_hours || ' hours')::interval
    group by vis.provider_id
  ),
  completion_stats as (
    select
      cs.provider_id,
      max(cs.updated_at) filter (
        where cs.status = 'COMPLETED'::public.contracted_service_status
      ) as last_completed_at,
      count(*) filter (
        where cs.status = 'COMPLETED'::public.contracted_service_status
          and cs.updated_at >= now() - interval '14 days'
      )::int as recent_completions
    from public.contracted_services cs
    inner join discover d on d.provider_id = cs.provider_id
    group by cs.provider_id
  ),
  batch_stats as (
    select
      bp.provider_id,
      max(bp.created_at) as last_batch_at,
      count(*) filter (
        where bp.created_at >= now() - interval '24 hours'
      )::int as batches_24h
    from public.service_request_dispatch_batch_providers bp
    inner join discover d on d.provider_id = bp.provider_id
    group by bp.provider_id
  ),
  base as (
    select
      d.provider_id,
      d.device_id,
      d.has_valid_beacon,
      d.distance_meters,
      case
        when d.has_valid_beacon and d.distance_meters is not null then
          greatest(0, 1 - (d.distance_meters / cfg.radius_m))
        else 0
      end as proximity_norm,
      coalesce(prs.ranking_quality_score, 5.0) as quality,
      coalesce(pps.ranking_conversion_score, 0.5) as conversion,
      coalesce(e.exposure_count, 0) as exposure_count,
      cstats.last_completed_at,
      coalesce(cstats.recent_completions, 0) as recent_completions,
      bstats.last_batch_at,
      coalesce(bstats.batches_24h, 0) as batches_24h,
      cfg.w_prox,
      cfg.w_qual,
      cfg.w_conv,
      cfg.no_beacon_pen,
      cfg.max_expl
    from discover d
    cross join cfg
    left join public.provider_rating_stats prs on prs.provider_id = d.provider_id
    left join public.provider_proposal_stats pps on pps.provider_id = d.provider_id
    left join exposure e on e.provider_id = d.provider_id
    left join completion_stats cstats on cstats.provider_id = d.provider_id
    left join batch_stats bstats on bstats.provider_id = d.provider_id
  ),
  scored as (
    select
      b.*,
      (
        b.proximity_norm * b.w_prox
        + (b.quality / 5.0) * b.w_qual
        + b.conversion * b.w_conv
      ) as primary_score,
      case
        when b.last_completed_at is null or b.last_completed_at < now() - interval '30 days' then 0.05
        else 0
      end as inactivity_boost,
      case
        when b.recent_completions >= 2 then -0.10
        else 0
      end as recent_completion_penalty,
      case
        when b.last_batch_at is null or b.last_batch_at < now() - interval '30 minutes' then
          case when b.conversion >= 0.4 then 0.05 else 0 end
        else 0
      end as recent_batch_boost,
      (-0.05 * b.batches_24h) as recent_batch_penalty,
      (-0.02 * b.exposure_count) as exposure_penalty,
      case
        when not b.has_valid_beacon then b.no_beacon_pen
        else 0
      end as beacon_penalty_mult,
      case
        when (b.quality / 5.0) >= 0.4 and b.conversion >= 0.35 then b.max_expl
        else 0
      end as exploration_boost_raw
    from base b
  ),
  final_scored as (
    select
      s.*,
      least(s.exploration_boost_raw, s.max_expl) as exploration_boost
    from scored s
  )
  select
    fs.provider_id,
    round((
      fs.primary_score
      * (1 - fs.beacon_penalty_mult)
      * (1 + fs.exploration_boost)
      + fs.inactivity_boost
      + fs.recent_completion_penalty
      + fs.recent_batch_boost
      + fs.recent_batch_penalty
      + fs.exposure_penalty
    )::numeric, 4) as ranking_score,
    jsonb_build_object(
      'proximity_norm', fs.proximity_norm,
      'quality', fs.quality,
      'conversion', fs.conversion,
      'primary_score', fs.primary_score,
      'inactivity_boost', fs.inactivity_boost,
      'recent_completion_penalty', fs.recent_completion_penalty,
      'recent_batch_boost', fs.recent_batch_boost,
      'recent_batch_penalty', fs.recent_batch_penalty,
      'exposure_penalty', fs.exposure_penalty,
      'beacon_penalty_mult', fs.beacon_penalty_mult,
      'exploration_boost', fs.exploration_boost,
      'exposure_count', fs.exposure_count
    ) as score_components,
    fs.device_id
  from final_scored fs
  order by ranking_score desc, fs.exposure_count asc, fs.provider_id asc;
$$;

comment on function public.matching_rank_candidates_with_discover(uuid, jsonb) is
  'Ranks a pre-discovered candidate snapshot; avoids re-running matching_discover_candidates.';

create or replace function public.matching_rank_candidates(
  p_service_request_id uuid,
  p_candidates uuid[]
)
returns table (
  provider_id uuid,
  ranking_score numeric,
  score_components jsonb,
  device_id text
)
language sql
stable
security definer
set search_path = public, extensions
as $$
  with discovered as (
    select
      d.provider_id,
      d.distance_meters,
      d.has_valid_beacon,
      d.device_id
    from public.matching_discover_candidates(
      p_service_request_id,
      public.platform_constant_int('matching.discovery_pool_cap', 200)
    ) d
  ),
  candidates as (
    select unnest(coalesce(p_candidates, '{}'::uuid[])) as provider_id
  ),
  snapshot as (
    select
      c.provider_id,
      d.distance_meters,
      coalesce(d.has_valid_beacon, false) as has_valid_beacon,
      d.device_id
    from candidates c
    left join discovered d on d.provider_id = c.provider_id
  )
  select *
  from public.matching_rank_candidates_with_discover(
    p_service_request_id,
    (
      select coalesce(
        jsonb_agg(
          jsonb_build_object(
            'provider_id', s.provider_id,
            'distance_meters', s.distance_meters,
            'has_valid_beacon', s.has_valid_beacon,
            'device_id', s.device_id
          )
        ),
        '[]'::jsonb
      )
      from snapshot s
    )
  );
$$;

comment on function public.matching_rank_candidates(uuid, uuid[]) is
  'Ranks provider candidates; filters a single discover pass to p_candidates for pgTAP and legacy callers.';

revoke all on function public.matching_h3_ring_cells(bigint, int)
  from public, anon, authenticated;
revoke all on function public.matching_discover_candidates(uuid, int)
  from public, anon, authenticated;
revoke all on function public.matching_rank_candidates_with_discover(uuid, jsonb)
  from public, anon, authenticated;
revoke all on function public.matching_rank_candidates(uuid, uuid[])
  from public, anon, authenticated;

grant execute on function public.matching_discover_candidates(uuid, int) to service_role;
grant execute on function public.matching_rank_candidates_with_discover(uuid, jsonb) to service_role;
grant execute on function public.matching_rank_candidates(uuid, uuid[]) to service_role;

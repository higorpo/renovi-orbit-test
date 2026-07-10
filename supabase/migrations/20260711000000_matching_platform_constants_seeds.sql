-- Matching M1 — platform_constant_numeric helper + matching.* seeds (design §3.1 M1, requirements platform_constants).

create or replace function public.platform_constant_numeric(p_key text, p_default numeric)
returns numeric
language plpgsql
stable
set search_path = public
as $$
declare
  v_raw jsonb;
  v_parsed numeric;
begin
  select pc.value
  into v_raw
  from public.platform_constants pc
  where pc.key = p_key;

  if v_raw is null then
    raise warning 'INVALID_PLATFORM_CONSTANT_FALLBACK key=% reason=missing using_default=%',
      p_key, p_default;
    return p_default;
  end if;

  begin
    v_parsed := (v_raw #>> '{}')::numeric;
  exception
    when others then
      raise warning 'INVALID_PLATFORM_CONSTANT_FALLBACK key=% reason=not_numeric using_default=%',
        p_key, p_default;
      return p_default;
  end;

  return v_parsed;
end;
$$;

comment on function public.platform_constant_numeric(text, numeric) is
  'Reads platform_constants as numeric with WARNING fallback to p_default when missing or invalid.';

revoke all on function public.platform_constant_numeric(text, numeric) from public, anon, authenticated;
grant execute on function public.platform_constant_numeric(text, numeric) to service_role;

insert into public.platform_constants (key, value, description)
values
  (
    'matching.dispatch_start_delay_minutes',
    '5'::jsonb,
    'Delay before first batch after Service Request creation.'
  ),
  (
    'matching.batch_interval_minutes',
    '60'::jsonb,
    'Minimum time between progressive dispatch batches.'
  ),
  (
    'matching.batch_size',
    '10'::jsonb,
    'Max providers per progressive dispatch batch.'
  ),
  (
    'matching.dispatch_lifecycle_hours',
    '48'::jsonb,
    'Max dispatch duration before DISPATCH_EXPIRED; clock starts at dispatch created_at.'
  ),
  (
    'matching.beacon_location_max_age_hours',
    '24'::jsonb,
    'Beacon freshness window for GPS eligibility.'
  ),
  (
    'matching.no_beacon_score_penalty',
    '0.20'::jsonb,
    'Ranking penalty multiplier when provider has no valid beacon.'
  ),
  (
    'matching.h3_resolution',
    '7'::jsonb,
    'H3 cell resolution for provider_latest_locations.'
  ),
  (
    'matching.provider_load_lookforward_days',
    '14'::jsonb,
    'Scheduled load lookforward window for provider eligibility.'
  ),
  (
    'matching.provider_max_scheduled_load',
    '28'::jsonb,
    'Max scheduled PENDING_PAYMENT contracted services in load window.'
  ),
  (
    'matching.ranking_weight_proximity',
    '0.40'::jsonb,
    'Primary ranking weight for proximity normalization.'
  ),
  (
    'matching.ranking_weight_quality',
    '0.35'::jsonb,
    'Primary ranking weight for provider quality score.'
  ),
  (
    'matching.ranking_weight_conversion',
    '0.25'::jsonb,
    'Primary ranking weight for proposal conversion score.'
  ),
  (
    'matching.ranking_exploration_max_boost',
    '0.10'::jsonb,
    'Max secondary exploration boost in ranking composition.'
  ),
  (
    'matching.ranking_tiebreak_exposure_lookback_hours',
    '24'::jsonb,
    'Rolling window for batch exposure tie-break count.'
  ),
  (
    'matching.rating_dimension_weight_quality',
    '0.40'::jsonb,
    'Per-rating overall score weight for quality dimension.'
  ),
  (
    'matching.rating_dimension_weight_punctuality',
    '0.25'::jsonb,
    'Per-rating overall score weight for punctuality dimension.'
  ),
  (
    'matching.rating_dimension_weight_communication',
    '0.20'::jsonb,
    'Per-rating overall score weight for communication dimension.'
  ),
  (
    'matching.rating_dimension_weight_value',
    '0.15'::jsonb,
    'Per-rating overall score weight for value dimension.'
  ),
  (
    'matching.rating_min_count_for_ranking',
    '3'::jsonb,
    'Minimum rating count before real quality score is used in ranking.'
  ),
  (
    'matching.conversion_min_resolved_for_ranking',
    '3'::jsonb,
    'Minimum resolved proposals before real conversion score is used in ranking.'
  ),
  (
    'matching.conversion_lookback_days',
    '90'::jsonb,
    'Proposal conversion lookback window for provider_proposal_stats.'
  ),
  (
    'matching.dispatch_lease_seconds',
    '300'::jsonb,
    'Cron worker lease TTL on service_request_dispatches.'
  ),
  (
    'matching.dispatch_pause_active_chat_threshold',
    '10'::jsonb,
    'Active chats threshold before DISPATCH_PAUSED gate.'
  ),
  (
    'matching.dispatch_active_chat_window_hours',
    '24'::jsonb,
    'Rolling window for active chat counting in pause gate and least_competitive sort.'
  ),
  (
    'matching.discovery_beacon_radius_meters',
    '20000'::jsonb,
    'Max beacon distance (meters) for batch discovery ST_DWithin pre-filter.'
  ),
  (
    'matching.discovery_pool_cap',
    '200'::jsonb,
    'Max provider candidates returned by matching_discover_candidates per call.'
  ),
  (
    'matching.cron_dispatch_batch_limit',
    '50'::jsonb,
    'Max dispatch rows processed per cron phase-2 loop iteration.'
  ),
  (
    'matching.feed_page_max',
    '50'::jsonb,
    'Max items per list_provider_opportunities page (server clamp).'
  ),
  (
    'matching.cron_expire_dispatch_batch_limit',
    '500'::jsonb,
    'Max dispatch rows expired per matching cron phase-1 sweep iteration.'
  )
on conflict (key) do update set
  value = excluded.value,
  description = excluded.description,
  updated_at = now();

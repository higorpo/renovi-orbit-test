-- pgTAP: matching_rank_candidates scoring (matching M9b).

begin;

select plan(3);

create temp table _rank_sr as
select '7017e457-5a32-44e7-b8da-1727a14f4d33'::uuid as service_request_id;

-- Clear leftover visibility from seeds/crons for the seed SR + provider pair.
delete from public.service_request_provider_visibility
where service_request_id = (select service_request_id from _rank_sr)
  and provider_id = '5d09e025-20a2-4842-aeef-324d42a431e1'::uuid;

insert into public.service_request_provider_visibility (
  service_request_id,
  provider_id,
  source,
  granted_at
)
values (
  (select service_request_id from _rank_sr),
  '5d09e025-20a2-4842-aeef-324d42a431e1'::uuid,
  'batch',
  now() - interval '1 hour'
);

select is(
  (
    select r.score_components ?& array[
      'proximity_norm',
      'quality',
      'conversion',
      'primary_score',
      'exploration_boost',
      'exposure_count'
    ]
    from public.matching_rank_candidates(
      (select service_request_id from _rank_sr),
      array['4cf92e3a-64cd-4491-998e-9163138f8e96'::uuid]
    ) r
  ),
  true,
  'score_components includes audit keys'
);

delete from public.provider_latest_locations
where provider_id = '4cf92e3a-64cd-4491-998e-9163138f8e96'::uuid;

select is(
  (
    select (r.score_components->>'beacon_penalty_mult')::numeric
    from public.matching_rank_candidates(
      (select service_request_id from _rank_sr),
      array['4cf92e3a-64cd-4491-998e-9163138f8e96'::uuid]
    ) r
  ),
  public.platform_constant_numeric('matching.no_beacon_score_penalty', 0.20),
  'no-beacon candidate gets configured penalty multiplier'
);

select is(
  (
    select r.provider_id
    from public.matching_rank_candidates(
      (select service_request_id from _rank_sr),
      array[
        '4cf92e3a-64cd-4491-998e-9163138f8e96'::uuid,
        '5d09e025-20a2-4842-aeef-324d42a431e1'::uuid
      ]
    ) r
    limit 1
  ),
  '4cf92e3a-64cd-4491-998e-9163138f8e96'::uuid,
  'lower batch exposure ranks ahead when other score inputs are aligned'
);

select finish();

rollback;

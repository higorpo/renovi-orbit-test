-- pgTAP: platform_constant_numeric helper (matching M1).

begin;

select plan(4);

select is(
  public.platform_constant_numeric('matching.__missing_key_for_test__', 0.42),
  0.42::numeric,
  'returns p_default when key is missing'
);

select is(
  public.platform_constant_numeric('matching.ranking_weight_proximity', 0.99),
  0.40::numeric,
  'reads seeded fractional constant'
);

select is(
  public.platform_constant_int('matching.batch_size', 99),
  10,
  'integer keys remain readable via platform_constant_int'
);

select is(
  (select count(*)::int from public.platform_constants where key like 'matching.%'),
  32,
  'seeds all matching.* platform constants'
);

select finish();

rollback;

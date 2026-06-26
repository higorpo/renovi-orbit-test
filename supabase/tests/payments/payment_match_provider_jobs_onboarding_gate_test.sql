-- pgTAP: payment Task 26 — match_provider_jobs onboarding gate.

begin;

select plan(2);

select is(
  jsonb_array_length(
    public.match_provider_jobs(
      '5d09e025-20a2-4842-aeef-324d42a431e1'::uuid,
      -23.5505,
      -46.6333,
      10
    )->'items'
  ),
  0,
  'non-ACTIVE provider receives empty feed'
);

select ok(
  (
    public.match_provider_jobs(
      '5d09e025-20a2-4842-aeef-324d42a431e1'::uuid,
      -23.5505,
      -46.6333,
      10
    )->>'total_count'
  )::int = 0,
  'non-ACTIVE provider total_count is zero'
);

select finish();

rollback;

-- pgTAP: service-completion Task 1 — platform_constants seeds (design §3.1, decision 23).

begin;

select plan(13);

select is(
  (
    select count(*)::int
    from public.platform_constants
    where key in (
      'checklist_criterion_min',
      'checklist_criterion_max',
      'checklist_evidence_min',
      'checklist_evidence_max',
      'checklist_ai_max_attempts',
      'enrichment_lease_ttl_seconds',
      'enrichment_claim_batch_size',
      'enrichment_retry_base_seconds',
      'completion_evidence_orphan_ttl_hours',
      'auto_complete_batch_size',
      'auto_complete_grace_hours'
    )
  ),
  11,
  'seeds all service-completion platform_constants keys'
);

select is(
  public.platform_constant_int('checklist_criterion_min', 3),
  3,
  'checklist_criterion_min = 3'
);

select is(
  public.platform_constant_int('checklist_criterion_max', 12),
  12,
  'checklist_criterion_max = 12'
);

select is(
  public.platform_constant_int('checklist_evidence_min', 1),
  1,
  'checklist_evidence_min = 1'
);

select is(
  public.platform_constant_int('checklist_evidence_max', 5),
  5,
  'checklist_evidence_max = 5'
);

select is(
  public.platform_constant_int('checklist_ai_max_attempts', 3),
  3,
  'checklist_ai_max_attempts = 5'
);

select is(
  public.platform_constant_int('enrichment_lease_ttl_seconds', 120),
  120,
  'enrichment_lease_ttl_seconds = 120'
);

select is(
  public.platform_constant_int('enrichment_claim_batch_size', 20),
  20,
  'enrichment_claim_batch_size = 20'
);

select is(
  public.platform_constant_int('enrichment_retry_base_seconds', 30),
  30,
  'enrichment_retry_base_seconds = 30'
);

select is(
  public.platform_constant_int('completion_evidence_orphan_ttl_hours', 24),
  24,
  'completion_evidence_orphan_ttl_hours = 24'
);

select is(
  public.platform_constant_int('auto_complete_batch_size', 100),
  100,
  'auto_complete_batch_size = 100'
);

select is(
  public.platform_constant_int('auto_complete_grace_hours', 24),
  24,
  'auto_complete_grace_hours reused (= 24)'
);

-- Helper documents fallback when key is absent (WARNING emitted; default returned).
select is(
  public.platform_constant_int('service_completion.__missing_key_for_test__', 7),
  7,
  'missing key returns documented default via platform_constant_int'
);

select finish();

rollback;

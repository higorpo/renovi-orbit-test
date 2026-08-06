-- Service completion Task 1: seed checklist / enrichment / orphan / auto-complete
-- platform_constants (design §3.1, CONTEXT decision 23).

-- New operational keys — upsert values + descriptions.
insert into public.platform_constants (key, value, description)
values
  (
    'checklist_criterion_min',
    '3'::jsonb,
    'Minimum completion_criterion blocks required in a checklist schema (static_text excluded)'
  ),
  (
    'checklist_criterion_max',
    '12'::jsonb,
    'Maximum completion_criterion blocks allowed in a checklist schema (static_text excluded)'
  ),
  (
    'checklist_evidence_min',
    '1'::jsonb,
    'Minimum evidence images required when a criterion requires evidence'
  ),
  (
    'checklist_evidence_max',
    '5'::jsonb,
    'Maximum evidence images allowed per criterion that requires evidence'
  ),
  (
    'checklist_ai_max_attempts',
    '5'::jsonb,
    'Max AI enrichment attempts before template cascade fallback'
  ),
  (
    'enrichment_lease_ttl_seconds',
    '120'::jsonb,
    'Lease TTL seconds for enrichment_claim_batch RUNNING ownership'
  ),
  (
    'enrichment_claim_batch_size',
    '20'::jsonb,
    'Max PENDING enrichments claimed per enrichment_claim_batch tick'
  ),
  (
    'enrichment_retry_base_seconds',
    '30'::jsonb,
    'Base backoff seconds for enrichment_schedule_retry (exponential: base * 2^attempt)'
  ),
  (
    'completion_evidence_orphan_ttl_hours',
    '24'::jsonb,
    'Hours before open/unreferenced completion evidence uploads are eligible for orphan janitor'
  ),
  (
    'auto_complete_batch_size',
    '100'::jsonb,
    'Max EXECUTED rows claimed per service_completion_auto_complete_executed tick (distinct from enrichment_claim_batch_size)'
  ),
  (
    'auto_mark_executed_batch_size',
    '100'::jsonb,
    'Max CONFIRMED rows claimed per service_completion_auto_mark_executed tick'
  )
on conflict (key) do update set
  value = excluded.value,
  description = excluded.description,
  updated_at = now();

-- Reuse existing auto_complete_grace_hours: insert default if missing; never overwrite value.
insert into public.platform_constants (key, value, description)
values (
  'auto_complete_grace_hours',
  '24'::jsonb,
  'Hours after executed_at before auto-complete promotes service to COMPLETED'
)
on conflict (key) do update set
  description = excluded.description,
  updated_at = now();

-- Hours after end-of-day (BRT) of coalesce(scheduled_end_date, scheduled_start_date)
-- before system auto-marks CONFIRMED → EXECUTED without checklist.
insert into public.platform_constants (key, value, description)
values (
  'auto_mark_executed_grace_hours',
  '24'::jsonb,
  'Hours after BRT end-of-day of coalesce(scheduled_end_date, scheduled_start_date) before auto-mark EXECUTED without checklist'
)
on conflict (key) do update set
  description = excluded.description,
  updated_at = now();

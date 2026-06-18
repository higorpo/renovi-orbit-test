-- Staging verification — full batch → visibility → MMD path (matching task 58).
-- Run with service_role on staging. Replace placeholders before executing.
--
-- Usage:
--   \set sr_id '00000000-0000-4000-8000-000000000001'
--   \set provider_id '00000000-0000-4000-8000-000000000002'
-- Or edit the literals in the WHERE clauses below.

-- =============================================================================
-- 1. Dispatch bootstrap
-- =============================================================================
select
  'dispatch' as check_name,
  d.id as dispatch_id,
  d.status,
  d.batch_number,
  d.next_batch_at,
  d.lease_owner,
  d.updated_at
from public.service_request_dispatches d
where d.service_request_id = '00000000-0000-4000-8000-000000000001'::uuid;

-- =============================================================================
-- 2. Latest cron runs (batch processor)
-- =============================================================================
select
  'cron_runs' as check_name,
  jr.started_at,
  jr.finished_at,
  jr.processed_count,
  jr.error_count,
  jr.duration_ms,
  jr.metadata
from public.job_runs jr
where jr.job_name = 'matching_process_service_request_dispatches'
order by jr.started_at desc
limit 5;

-- =============================================================================
-- 3. Batch + batch_providers
-- =============================================================================
select
  'batch_providers' as check_name,
  b.batch_number,
  bp.provider_id,
  bp.ranking_score,
  b.created_at
from public.service_request_dispatches d
join public.service_request_dispatch_batches b on b.dispatch_id = d.id
join public.service_request_dispatch_batch_providers bp on bp.batch_id = b.id
where d.service_request_id = '00000000-0000-4000-8000-000000000001'::uuid
order by b.batch_number desc, bp.ranking_score desc;

-- =============================================================================
-- 4. Feed visibility (batch source)
-- =============================================================================
select
  'visibility' as check_name,
  v.provider_id,
  v.source,
  v.granted_at,
  v.dismissed_at
from public.service_request_provider_visibility v
where v.service_request_id = '00000000-0000-4000-8000-000000000001'::uuid
  and v.provider_id = '00000000-0000-4000-8000-000000000002'::uuid;

-- =============================================================================
-- 5. MMD ingest for matching.new_opportunity
-- =============================================================================
select
  'mmd_dispatches' as check_name,
  md.id,
  md.channel,
  md.status,
  md.template_key,
  md.metadata->>'idempotency_key' as idempotency_key,
  md.created_at,
  md.updated_at
from message_dispatcher.message_dispatches md
where md.template_key = 'matching.new_opportunity'
  and md.metadata->>'idempotency_key' like format(
    'dispatch:%s:%%',
    '00000000-0000-4000-8000-000000000001'
  )
order by md.created_at desc;

-- =============================================================================
-- 6. Recent dispatch events (correlation)
-- =============================================================================
select
  'dispatch_events' as check_name,
  e.event_type,
  e.created_at,
  e.payload
from public.service_request_dispatch_events e
where e.service_request_id = '00000000-0000-4000-8000-000000000001'::uuid
order by e.created_at desc
limit 20;

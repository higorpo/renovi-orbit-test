-- Matching ops — dashboard and alert queries (task 45).
-- Run with service_role or platform admin. Safe to schedule in Grafana / Supabase SQL cron.

-- =============================================================================
-- ALERT: cron error rate (15 min) — fire when error_rate > 0.05 AND total_runs >= 3
-- =============================================================================
-- matching_alert_cron_error_rate_15m
select
  count(*) filter (where jr.error_count > 0) as error_runs,
  count(*) as total_runs,
  round(
    count(*) filter (where jr.error_count > 0)::numeric / nullif(count(*), 0),
    4
  ) as error_rate
from public.job_runs jr
where jr.job_name = 'matching_process_service_request_dispatches'
  and jr.finished_at is not null
  and jr.started_at > now() - interval '15 minutes';

-- =============================================================================
-- ALERT: stuck dispatch leases — fire when stuck_lease_count > 0
-- =============================================================================
-- matching_alert_stuck_leases
select count(*)::bigint as stuck_lease_count
from public.service_request_dispatches d
where d.lease_owner is not null
  and d.lease_expires_at is not null
  and d.lease_expires_at < now() - interval '10 minutes';

-- Triage detail (optional companion panel)
select
  d.id as dispatch_id,
  d.service_request_id,
  d.status,
  d.lease_owner,
  d.lease_expires_at,
  d.next_batch_at,
  d.updated_at
from public.service_request_dispatches d
where d.lease_owner is not null
  and d.lease_expires_at < now() - interval '10 minutes'
order by d.lease_expires_at asc
limit 50;

-- =============================================================================
-- ALERT: consecutive cron failures — fire when consecutive_error_runs > 10
-- =============================================================================
-- matching_alert_consecutive_cron_errors
select public.matching_ops_consecutive_cron_errors(10, 100);

-- =============================================================================
-- DASHBOARD: active dispatches by status
-- =============================================================================
select d.status, count(*)::bigint as dispatch_count
from public.service_request_dispatches d
group by d.status
order by dispatch_count desc;

-- =============================================================================
-- DASHBOARD: batch open latency (p50 / p95 seconds after due next_batch_at)
-- Uses batch_opened events; NULL when event payload lacks timing anchor.
-- =============================================================================
with opened as (
  select
    e.dispatch_id,
    e.created_at as opened_at,
    (e.payload->>'batch_id')::uuid as batch_id
  from public.service_request_dispatch_events e
  where e.event_type = 'batch_opened'
    and e.created_at > now() - interval '7 days'
),
due as (
  select
    o.dispatch_id,
    o.opened_at,
    d.next_batch_at as due_at
  from opened o
  join public.service_request_dispatches d on d.id = o.dispatch_id
  where d.next_batch_at is not null
)
select
  count(*)::bigint as sample_count,
  round(
    percentile_cont(0.5) within group (
      order by extract(epoch from (opened_at - due_at))
    )::numeric,
    2
  ) as p50_latency_seconds,
  round(
    percentile_cont(0.95) within group (
      order by extract(epoch from (opened_at - due_at))
    )::numeric,
    2
  ) as p95_latency_seconds
from due;

-- =============================================================================
-- DASHBOARD: pool exhaustion rate (daily)
-- =============================================================================
select
  date_trunc('day', e.created_at) as day,
  count(*)::bigint as pool_exhausted_count
from public.service_request_dispatch_events e
where e.event_type = 'pool_exhausted'
  and e.created_at > now() - interval '30 days'
group by 1
order by 1 desc;

-- =============================================================================
-- DASHBOARD: MMD matching.new_opportunity delivery ratio (24h)
-- =============================================================================
select
  count(*)::bigint as total_dispatches,
  count(*) filter (
    where md.status = 'DELIVERED'::message_dispatcher.message_dispatch_status
  )::bigint as success_count,
  round(
    count(*) filter (
      where md.status = 'DELIVERED'::message_dispatcher.message_dispatch_status
    )::numeric / nullif(count(*), 0),
    4
  ) as delivery_ratio
from message_dispatcher.message_dispatches md
where md.template_key = 'matching.new_opportunity'
  and md.created_at > now() - interval '24 hours';

-- =============================================================================
-- DASHBOARD: latest matching cron runs (24h)
-- =============================================================================
select
  jr.id,
  jr.started_at,
  jr.finished_at,
  jr.duration_ms,
  jr.processed_count,
  jr.error_count,
  jr.metadata
from public.job_runs jr
where jr.job_name = 'matching_process_service_request_dispatches'
  and jr.started_at > now() - interval '24 hours'
order by jr.started_at desc
limit 100;

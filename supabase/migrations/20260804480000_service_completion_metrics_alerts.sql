-- Service completion Task 56: metrics snapshot + Sentry alert evaluator/cron (design §10.4–10.6).
-- Also: supporting indexes for metrics/alerts + enrichment_events retention prune.

-- ---------------------------------------------------------------------------
-- Indexes used by metrics / alerts (IF NOT EXISTS — may already exist from Task 3/4)
-- ---------------------------------------------------------------------------

create index if not exists idx_enrichments_ops_attention
  on public.service_request_enrichments (ops_attention_at)
  where ops_attention_at is not null;

comment on index public.idx_enrichments_ops_attention is
  'Partial index for ops_attention open-count metrics and CRITICAL alert sampling.';

create index if not exists idx_enrichment_events_reclaim_created
  on public.service_request_enrichment_events (created_at)
  where event_type = 'RECLAIM';

comment on index public.idx_enrichment_events_reclaim_created is
  'Partial index for lease reclaim count metrics (event_type = RECLAIM).';

insert into public.platform_constants (key, value, description)
values
  (
    'enrichment_pending_age_warning_minutes',
    '15'::jsonb,
    'PENDING enrichment age (excl. ops_attention) WARNING threshold for Task 56 alerts'
  ),
  (
    'enrichment_pending_age_critical_minutes',
    '60'::jsonb,
    'PENDING enrichment age (excl. ops_attention) CRITICAL threshold for Task 56 alerts'
  ),
  (
    'service_completion_auto_complete_error_consecutive',
    '2'::jsonb,
    'Consecutive auto-complete job_runs with error_count>0 before WARNING alert (flap suppression)'
  )
on conflict (key) do update set
  value = excluded.value,
  description = excluded.description,
  updated_at = now();

-- ---------------------------------------------------------------------------
-- Metrics snapshot (cheap aggregates; service_role)
-- ---------------------------------------------------------------------------

create or replace function public.service_completion_ops_metrics(
  p_lookback_hours int default 24
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_hours int := greatest(coalesce(p_lookback_hours, 24), 1);
  v_since timestamptz := now() - make_interval(hours => v_hours);
  v_age jsonb;
  v_source jsonb;
  v_late jsonb;
  v_complete jsonb;
  v_reclaim_count bigint;
  v_ops_attention_count bigint;
  v_orphan_deletes bigint;
  v_jobs jsonb;
begin
  if coalesce(auth.role(), '') <> 'service_role' then
    raise exception 'service_role required for service_completion_ops_metrics'
      using errcode = '42501';
  end if;

  -- Enrichment age for due PENDING (ops_attention excluded) — seconds since created_at.
  select jsonb_build_object(
    'pending_count', count(*)::int,
    'age_seconds_p50', coalesce(
      percentile_cont(0.5) within group (
        order by extract(epoch from (now() - e.created_at))
      ),
      0
    ),
    'age_seconds_p95', coalesce(
      percentile_cont(0.95) within group (
        order by extract(epoch from (now() - e.created_at))
      ),
      0
    )
  )
  into v_age
  from public.service_request_enrichments e
  where e.status = 'PENDING'::public.enrichment_status
    and e.ops_attention_at is null;

  select jsonb_build_object(
    'ready_total', count(*)::int,
    'ai_count', count(*) filter (where e.source = 'ai'::public.checklist_source)::int,
    'fallback_count', count(*) filter (
      where e.source = 'fallback_template'::public.checklist_source
    )::int,
    'ai_ratio', case
      when count(*) = 0 then null
      else round(
        (
          count(*) filter (where e.source = 'ai'::public.checklist_source)::numeric
          / count(*)::numeric
        ),
        4
      )
    end
  )
  into v_source
  from public.service_request_enrichments e
  where e.status = 'READY'::public.enrichment_status
    and e.materialized_at is not null
    and e.materialized_at >= v_since;

  select jsonb_build_object(
    'frozen_total', count(*)::int,
    'executed_late_count', count(*) filter (where ev.executed_late)::int,
    'executed_late_ratio', case
      when count(*) = 0 then null
      else round(
        (count(*) filter (where ev.executed_late)::numeric / count(*)::numeric),
        4
      )
    end
  )
  into v_late
  from public.contracted_service_completion_evidence ev
  where ev.phase = 'frozen'::public.completion_evidence_phase
    and ev.frozen_at >= v_since;

  select jsonb_build_object(
    'completed_total', count(*)::int,
    'manual_client_count', count(*) filter (where cs.completed_by = 'client')::int,
    'auto_system_count', count(*) filter (where cs.completed_by = 'system')::int,
    'auto_complete_ratio', case
      when count(*) = 0 then null
      else round(
        (
          count(*) filter (where cs.completed_by = 'system')::numeric
          / count(*)::numeric
        ),
        4
      )
    end
  )
  into v_complete
  from public.contracted_services cs
  where cs.status = 'COMPLETED'
    and cs.completed_at is not null
    and cs.completed_at >= v_since;

  select count(*)::bigint
  into v_reclaim_count
  from public.service_request_enrichment_events ev
  where ev.event_type = 'RECLAIM'
    and ev.created_at >= v_since;

  select count(*)::bigint
  into v_ops_attention_count
  from public.service_request_enrichments e
  where e.ops_attention_at is not null;

  -- Orphan janitor metric lands with Task 58/59; expose slot from job_runs when present.
  select coalesce(sum(jr.transitioned_count), 0)::bigint
  into v_orphan_deletes
  from public.job_runs jr
  where jr.job_name = 'service_completion_cron_orphan_upload_janitor'
    and jr.started_at >= v_since
    and jr.finished_at is not null;

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'job_name', x.job_name,
        'started_at', x.started_at,
        'finished_at', x.finished_at,
        'error_count', x.error_count,
        'processed_count', x.processed_count,
        'transitioned_count', x.transitioned_count,
        'fatal_error', nullif(x.metadata->>'fatal_error', '')
      )
      order by x.job_name
    ),
    '[]'::jsonb
  )
  into v_jobs
  from (
    select distinct on (jr.job_name)
      jr.job_name,
      jr.started_at,
      jr.finished_at,
      jr.error_count,
      jr.processed_count,
      jr.transitioned_count,
      jr.metadata
    from public.job_runs jr
    where jr.job_name in (
      'enrichment_cron_sweep',
      'service_completion_cron_auto_complete_executed',
      'service_completion_cron_orphan_upload_janitor',
      'service_completion_emit_sentry_alerts'
    )
    order by jr.job_name, jr.started_at desc
  ) x;

  return jsonb_build_object(
    'lookback_hours', v_hours,
    'as_of', now(),
    'enrichment_age', v_age,
    'ai_vs_fallback', v_source,
    'executed_late', v_late,
    'auto_vs_manual_complete', v_complete,
    'lease_reclaim_count_24h_window', v_reclaim_count,
    'ops_attention_open_count', v_ops_attention_count,
    'orphan_deletes', v_orphan_deletes,
    'latest_job_runs', v_jobs
  );
end;
$$;

comment on function public.service_completion_ops_metrics(int) is
  'Ops metrics snapshot: enrichment age p50/p95, AI/fallback, executed_late, auto vs manual, reclaim, ops_attention, orphan deletes (Task 56). service_role only.';

revoke all on function public.service_completion_ops_metrics(int)
  from public, anon, authenticated;
grant execute on function public.service_completion_ops_metrics(int) to service_role;

-- ---------------------------------------------------------------------------
-- Alert evaluator → orbit-emit-sentry-alerts (generic level+message)
-- ---------------------------------------------------------------------------

create or replace function public.service_completion_evaluate_sentry_alerts()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_alerts jsonb := '[]'::jsonb;
  v_ops_count bigint;
  v_ops_sample jsonb;
  v_global_templates int;
  v_pending_over_warn int;
  v_pending_over_crit int;
  v_warn_minutes int;
  v_crit_minutes int;
  v_consec int;
  v_auto_error_streak int;
  v_oldest_pending_minutes numeric;
begin
  if coalesce(auth.role(), '') <> 'service_role' then
    raise exception 'service_role required for service_completion_evaluate_sentry_alerts'
      using errcode = '42501';
  end if;

  v_warn_minutes := greatest(
    public.platform_constant_int('enrichment_pending_age_warning_minutes', 15),
    1
  );
  v_crit_minutes := greatest(
    public.platform_constant_int('enrichment_pending_age_critical_minutes', 60),
    v_warn_minutes
  );
  v_consec := greatest(
    public.platform_constant_int('service_completion_auto_complete_error_consecutive', 2),
    1
  );

  -- CRITICAL: any open ops_attention (template cascade / stuck enrichment).
  select count(*)::bigint
  into v_ops_count
  from public.service_request_enrichments e
  where e.ops_attention_at is not null;

  if coalesce(v_ops_count, 0) > 0 then
    select jsonb_agg(jsonb_build_object(
      'enrichment_id', s.id,
      'service_request_id', s.service_request_id,
      'reason', s.ops_attention_reason
    ))
    into v_ops_sample
    from (
      select e.id, e.service_request_id, e.ops_attention_reason
      from public.service_request_enrichments e
      where e.ops_attention_at is not null
      order by e.ops_attention_at
      limit 5
    ) s;

    v_alerts := v_alerts || jsonb_build_array(
      jsonb_build_object(
        'level', 'CRITICAL',
        'message', 'service_completion_ops_attention',
        'code', 'OPS_ATTENTION',
        'count', v_ops_count,
        'samples', coalesce(v_ops_sample, '[]'::jsonb)
      )
    );
  end if;

  -- CRITICAL: missing active global completion checklist template (fallback impossible).
  select count(*)::int
  into v_global_templates
  from public.completion_checklist_templates t
  where t.is_global
    and t.is_active;

  if coalesce(v_global_templates, 0) = 0 then
    v_alerts := v_alerts || jsonb_build_array(
      jsonb_build_object(
        'level', 'CRITICAL',
        'message', 'service_completion_missing_global_template',
        'code', 'MISSING_TEMPLATES',
        'count', 0
      )
    );
  end if;

  -- PENDING age WARNING → CRITICAL (exclude ops_attention).
  select
    count(*) filter (
      where extract(epoch from (now() - e.created_at)) / 60.0 >= v_warn_minutes
    )::int,
    count(*) filter (
      where extract(epoch from (now() - e.created_at)) / 60.0 >= v_crit_minutes
    )::int,
    coalesce(
      max(extract(epoch from (now() - e.created_at)) / 60.0),
      0
    )
  into v_pending_over_warn, v_pending_over_crit, v_oldest_pending_minutes
  from public.service_request_enrichments e
  where e.status = 'PENDING'::public.enrichment_status
    and e.ops_attention_at is null
    and (e.next_attempt_at is null or e.next_attempt_at <= now());

  if coalesce(v_pending_over_crit, 0) > 0 then
    v_alerts := v_alerts || jsonb_build_array(
      jsonb_build_object(
        'level', 'CRITICAL',
        'message', 'service_completion_enrichment_pending_age_critical',
        'code', 'PENDING_AGE_CRITICAL',
        'count', v_pending_over_crit,
        'threshold_minutes', v_crit_minutes,
        'oldest_pending_minutes', round(v_oldest_pending_minutes, 1)
      )
    );
  elsif coalesce(v_pending_over_warn, 0) > 0 then
    v_alerts := v_alerts || jsonb_build_array(
      jsonb_build_object(
        'level', 'WARNING',
        'message', 'service_completion_enrichment_pending_age_warning',
        'code', 'PENDING_AGE_WARNING',
        'count', v_pending_over_warn,
        'threshold_minutes', v_warn_minutes,
        'oldest_pending_minutes', round(v_oldest_pending_minutes, 1)
      )
    );
  end if;

  -- WARNING: consecutive auto-complete job_runs with errors (flap suppression).
  select count(*)::int
  into v_auto_error_streak
  from (
    select jr.error_count
    from public.job_runs jr
    where jr.job_name = 'service_completion_cron_auto_complete_executed'
      and jr.finished_at is not null
    order by jr.started_at desc
    limit v_consec
  ) recent
  where coalesce(recent.error_count, 0) > 0;

  if coalesce(v_auto_error_streak, 0) >= v_consec then
    v_alerts := v_alerts || jsonb_build_array(
      jsonb_build_object(
        'level', 'WARNING',
        'message', 'service_completion_auto_complete_job_errors',
        'code', 'AUTO_COMPLETE_JOB_ERRORS',
        'count', v_auto_error_streak,
        'consecutive_required', v_consec
      )
    );
  end if;

  return v_alerts;
end;
$$;

comment on function public.service_completion_evaluate_sentry_alerts() is
  'Returns orbit-emit-sentry-alerts payloads for ops_attention, missing templates, PENDING age, auto-complete errors (Task 56).';

revoke all on function public.service_completion_evaluate_sentry_alerts()
  from public, anon, authenticated;
grant execute on function public.service_completion_evaluate_sentry_alerts() to service_role;
grant execute on function public.service_completion_evaluate_sentry_alerts() to postgres;

-- ---------------------------------------------------------------------------
-- Cron wrapper
-- ---------------------------------------------------------------------------

create or replace function public.service_completion_cron_emit_sentry_alerts()
returns void
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_job_name constant text := 'service_completion_emit_sentry_alerts';
  v_job_run_id bigint;
  v_started_at timestamptz := clock_timestamp();
  v_alerts jsonb;
  v_alert_count int := 0;
begin
  v_job_run_id := public.job_run_begin(v_job_name, 'v1');

  begin
    perform set_config('request.jwt.claim.role', 'service_role', true);
    perform set_config(
      'request.jwt.claims',
      json_build_object('role', 'service_role')::text,
      true
    );

    v_alerts := public.service_completion_evaluate_sentry_alerts();
    v_alert_count := coalesce(jsonb_array_length(v_alerts), 0);

    if v_alert_count > 0 then
      perform public.orbit_post_sentry_alerts(v_alerts);
    end if;

    perform public.job_run_finish(
      v_job_run_id,
      v_started_at,
      v_alert_count,
      v_alert_count,
      0,
      jsonb_build_object(
        'alerts', v_alerts,
        'alert_count', v_alert_count
      ),
      null
    );
  exception
    when others then
      perform public.job_run_abort_latest(v_job_name, sqlerrm);
      raise;
  end;
end;
$$;

comment on function public.service_completion_cron_emit_sentry_alerts() is
  'pg_cron: evaluate service-completion alert conditions and post to orbit-emit-sentry-alerts (Task 56).';

revoke all on function public.service_completion_cron_emit_sentry_alerts()
  from public, anon, authenticated;
grant execute on function public.service_completion_cron_emit_sentry_alerts() to postgres;

do $register$
declare
  v_jobid integer;
begin
  select j.jobid
  into v_jobid
  from cron.job j
  where j.jobname = 'service_completion_emit_sentry_alerts';

  if v_jobid is not null then
    perform cron.unschedule(v_jobid);
  end if;

  perform cron.schedule(
    'service_completion_emit_sentry_alerts',
    '*/5 * * * *',
    $$select public.service_completion_cron_emit_sentry_alerts();$$
  );
end;
$register$;

-- ---------------------------------------------------------------------------
-- Enrichment events retention prune (default 90 days; job_runs telemetry)
-- Append-only table revokes DELETE from service_role; this SECURITY DEFINER
-- function runs as owner and is the intentional retention exception.
-- ---------------------------------------------------------------------------

create or replace function public.service_completion_prune_enrichment_events(
  p_retention_days int default 90,
  p_batch_limit int default 10000
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_started_at timestamptz := clock_timestamp();
  v_retention interval;
  v_deleted_count int := 0;
  v_duration_ms int;
begin
  if p_retention_days is null or p_retention_days < 1 or p_retention_days > 365 then
    raise exception 'p_retention_days must be between 1 and 365'
      using errcode = '22023';
  end if;

  if p_batch_limit is null or p_batch_limit < 1 or p_batch_limit > 50000 then
    raise exception 'p_batch_limit must be between 1 and 50000'
      using errcode = '22023';
  end if;

  v_retention := make_interval(days => p_retention_days);

  with doomed as (
    select ev.ctid
    from public.service_request_enrichment_events ev
    where ev.created_at < clock_timestamp() - v_retention
    order by ev.created_at
    limit p_batch_limit
  ),
  deleted as (
    delete from public.service_request_enrichment_events ev
    using doomed d
    where ev.ctid = d.ctid
    returning 1
  )
  select count(*)::int into v_deleted_count from deleted;

  v_duration_ms := (
    extract(epoch from (clock_timestamp() - v_started_at)) * 1000
  )::int;

  if v_deleted_count > 0 then
    raise log 'service_completion_prune_enrichment_events deleted=% retention_days=% batch_limit=%',
      v_deleted_count,
      p_retention_days,
      p_batch_limit;
  end if;

  return jsonb_build_object(
    'deleted_count', v_deleted_count,
    'retention_days', p_retention_days,
    'batch_limit', p_batch_limit,
    'duration_ms', v_duration_ms
  );
end;
$$;

comment on function public.service_completion_prune_enrichment_events(int, int) is
  'Deletes enrichment_events older than retention window (default 90d); intentional append-only retention exception.';

revoke all on function public.service_completion_prune_enrichment_events(int, int)
  from public, anon, authenticated;
grant execute on function public.service_completion_prune_enrichment_events(int, int)
  to service_role;

create or replace function public.service_completion_cron_prune_enrichment_events()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_job_name constant text := 'service_completion_prune_enrichment_events';
  v_started_at timestamptz := clock_timestamp();
  v_job_run_id bigint;
  v_result jsonb;
begin
  v_job_run_id := public.job_run_begin(v_job_name, 'v1');
  v_result := public.service_completion_prune_enrichment_events(90, 10000);

  perform public.job_run_finish(
    v_job_run_id,
    v_started_at,
    coalesce((v_result->>'deleted_count')::int, 0),
    coalesce((v_result->>'deleted_count')::int, 0),
    0,
    jsonb_build_object(
      'retention_days', coalesce((v_result->>'retention_days')::int, 90),
      'batch_limit', coalesce((v_result->>'batch_limit')::int, 10000)
    ),
    null
  );

  return v_result || jsonb_build_object('job_run_id', v_job_run_id);
exception
  when others then
    perform public.job_run_abort_latest(v_job_name, sqlerrm);
    raise;
end;
$$;

comment on function public.service_completion_cron_prune_enrichment_events() is
  'pg_cron entrypoint: prune expired enrichment_events with job_runs telemetry.';

revoke all on function public.service_completion_cron_prune_enrichment_events()
  from public, anon, authenticated;
grant execute on function public.service_completion_cron_prune_enrichment_events()
  to postgres;

do $prune_cron$
declare
  v_jobid integer;
begin
  select j.jobid
  into v_jobid
  from cron.job j
  where j.jobname = 'service_completion_prune_enrichment_events';

  if v_jobid is not null then
    perform cron.unschedule(v_jobid);
  end if;

  perform cron.schedule(
    'service_completion_prune_enrichment_events',
    '15 5 * * *',
    $$select public.service_completion_cron_prune_enrichment_events();$$
  );
end;
$prune_cron$;

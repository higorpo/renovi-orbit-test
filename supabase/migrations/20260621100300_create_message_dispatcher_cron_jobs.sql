-- Multichannel Message Dispatcher (MMD) — migration 4 of 4 (design §13.1).
-- pg_cron schedules (tasks 40–42, 70 in docs/message-dispatcher/tasks.md).

-- pg_cron: created in 20260318200000_create_provider_proposals.sql (avoid duplicate CREATE EXTENSION).
create extension if not exists pg_net with schema extensions;

grant usage on schema cron to postgres;
grant all privileges on all tables in schema cron to postgres;

-- Task 40: activate due SCHEDULED dispatches every minute (design §6.4).
do $cron$
declare
  v_jobid integer;
begin
  select j.jobid
  into v_jobid
  from cron.job j
  where j.jobname = 'mmd_activate_scheduled';

  if v_jobid is not null then
    perform cron.unschedule(v_jobid);
  end if;
end;
$cron$;

select cron.schedule(
  'mmd_activate_scheduled',
  '* * * * *',
  $$select message_dispatcher.message_dispatcher_activate_scheduled();$$
);

-- Task 41: promote due FAILED_RETRYABLE every minute (design §6.4).
do $cron$
declare
  v_jobid integer;
begin
  select j.jobid
  into v_jobid
  from cron.job j
  where j.jobname = 'mmd_promote_retries';

  if v_jobid is not null then
    perform cron.unschedule(v_jobid);
  end if;
end;
$cron$;

select cron.schedule(
  'mmd_promote_retries',
  '* * * * *',
  $$select message_dispatcher.message_dispatcher_promote_retries();$$
);

-- Task 42: reclaim stale PROCESSING leases every minute (design §6.4; run before promote in ops).
do $cron$
declare
  v_jobid integer;
begin
  select j.jobid
  into v_jobid
  from cron.job j
  where j.jobname = 'mmd_reclaim_leases';

  if v_jobid is not null then
    perform cron.unschedule(v_jobid);
  end if;
end;
$cron$;

select cron.schedule(
  'mmd_reclaim_leases',
  '* * * * *',
  $$select message_dispatcher.message_dispatcher_reclaim_leases();$$
);

create or replace function message_dispatcher.message_dispatcher_worker_invoke_min_interval_seconds()
returns integer
language sql
stable
security definer
set search_path = message_dispatcher, public, auth
as $$
  select greatest(
    coalesce(
      (
        select (pc.value #>> '{}')::int
        from public.platform_constants pc
        where pc.key = 'message_dispatcher.worker_invoke_min_interval_seconds'
      ),
      15
    ),
    15
  );
$$;

comment on function message_dispatcher.message_dispatcher_worker_invoke_min_interval_seconds() is
  'Minimum seconds between pg_net worker POSTs (design §1.6; floor 15).';

revoke all on function message_dispatcher.message_dispatcher_worker_invoke_min_interval_seconds() from public;
revoke all on function message_dispatcher.message_dispatcher_worker_invoke_min_interval_seconds() from authenticated;
grant execute on function message_dispatcher.message_dispatcher_worker_invoke_min_interval_seconds() to postgres;

create or replace function message_dispatcher.message_dispatcher_try_claim_worker_invoke()
returns boolean
language plpgsql
security definer
set search_path = message_dispatcher, public, auth
as $$
declare
  v_min_seconds integer;
begin
  v_min_seconds := message_dispatcher.message_dispatcher_worker_invoke_min_interval_seconds();

  update public.platform_constants pc
  set
    value = to_jsonb(now()::text),
    updated_at = now()
  where pc.key = 'message_dispatcher.last_worker_invoke_at'
    and (
      pc.value is null
      or pc.value = 'null'::jsonb
      or nullif(trim(pc.value #>> '{}'), '') is null
      or (pc.value #>> '{}')::timestamptz
        <= now() - make_interval(secs => v_min_seconds)
    );

  return found;
end;
$$;

comment on function message_dispatcher.message_dispatcher_try_claim_worker_invoke() is
  'Atomically claim a worker invoke slot; false when within min interval (design §1.6, task 108).';

revoke all on function message_dispatcher.message_dispatcher_try_claim_worker_invoke() from public;
revoke all on function message_dispatcher.message_dispatcher_try_claim_worker_invoke() from authenticated;
grant execute on function message_dispatcher.message_dispatcher_try_claim_worker_invoke() to postgres;

create or replace function message_dispatcher.message_dispatcher_invoke_worker()
returns void
language plpgsql
security definer
set search_path = message_dispatcher, public, auth, extensions
as $$
declare
  v_url text;
  v_secret text;
begin
  select nullif(trim(pc.value #>> '{}'), '')
  into v_url
  from public.platform_constants pc
  where pc.key = 'message_dispatcher.worker_url';

  select nullif(trim(pc.value #>> '{}'), '')
  into v_secret
  from public.platform_constants pc
  where pc.key = 'message_dispatcher.cron_secret';

  if v_url is null or v_secret is null then
    return;
  end if;

  if not message_dispatcher.message_dispatcher_try_claim_worker_invoke() then
    return;
  end if;

  perform net.http_post(
    url := v_url,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || v_secret,
      'X-Dispatcher-Secret', v_secret
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 25000
  );
end;
$$;

comment on function message_dispatcher.message_dispatcher_invoke_worker() is
  'Fire-and-forget POST to message-dispatcher-worker via pg_net (design §6.4, task 70). Throttled to worker_invoke_min_interval_seconds (≥15, task 108).';

revoke all on function message_dispatcher.message_dispatcher_invoke_worker() from public;
revoke all on function message_dispatcher.message_dispatcher_invoke_worker() from authenticated;
grant execute on function message_dispatcher.message_dispatcher_invoke_worker() to postgres;

do $cron$
declare
  v_jobid integer;
begin
  select j.jobid
  into v_jobid
  from cron.job j
  where j.jobname = 'mmd_invoke_worker';

  if v_jobid is not null then
    perform cron.unschedule(v_jobid);
  end if;
end;
$cron$;

-- MVP pg_cron granularity is 60s (design §6.4); RPC enforces ≥15s between pg_net POSTs (design §1.6).
select cron.schedule(
  'mmd_invoke_worker',
  '*/1 * * * *',
  $$select message_dispatcher.message_dispatcher_invoke_worker();$$
);

-- Task 84: SQL alert views (design §10.5).
create or replace view message_dispatcher.alert_queue_lag_v as
select count(*)::bigint as lag_count
from message_dispatcher.message_dispatches d
where d.status = 'QUEUED'
  and d.scheduled_for < now() - interval '5 minutes';

comment on view message_dispatcher.alert_queue_lag_v is
  'Queue lag: QUEUED rows overdue by 5m (alert when lag_count > 1000).';

create or replace view message_dispatcher.alert_terminal_spike_v as
with windowed as (
  select
    count(*) filter (where d.created_at > now() - interval '15 minutes')::bigint as ingested_15m,
    count(*) filter (
      where d.created_at > now() - interval '15 minutes'
        and d.status = 'FAILED_TERMINAL'
    )::bigint as terminal_15m
  from message_dispatcher.message_dispatches d
)
select
  ingested_15m,
  terminal_15m,
  case
    when ingested_15m = 0 then 0::numeric
    else round(terminal_15m::numeric / ingested_15m::numeric, 4)
  end as terminal_rate
from windowed;

comment on view message_dispatcher.alert_terminal_spike_v is
  'Terminal spike: FAILED_TERMINAL share of ingests in last 15m (alert when rate > 0.05).';

create or replace view message_dispatcher.alert_janitor_churn_v as
select count(*)::bigint as lease_reclaims_1m
from message_dispatcher.message_dispatches d
where d.failure_code = 'lease_expired'
  and d.updated_at > now() - interval '1 minute';

comment on view message_dispatcher.alert_janitor_churn_v is
  'Janitor churn: lease_expired reclaims in last 1m (alert when lease_reclaims_1m > 100).';

-- Task 109: backpressure when FAILED_RETRYABLE backlog is high (design §9.5).
create or replace view message_dispatcher.alert_retryable_depth_v as
select count(*)::bigint as retryable_count
from message_dispatcher.message_dispatches d
where d.status = 'FAILED_RETRYABLE';

comment on view message_dispatcher.alert_retryable_depth_v is
  'Retryable backlog depth (alert when retryable_count > retryable_depth_alert_threshold, default 10k).';

create or replace view message_dispatcher.alert_retryable_by_source_v as
select
  coalesce(nullif(trim(d.source_system), ''), 'orbit') as source_system,
  count(*)::bigint as retryable_count
from message_dispatcher.message_dispatches d
where d.status = 'FAILED_RETRYABLE'
group by 1
order by retryable_count desc;

comment on view message_dispatcher.alert_retryable_by_source_v is
  'FAILED_RETRYABLE rows grouped by source_system for backpressure triage (design §9.5).';

revoke all on message_dispatcher.alert_queue_lag_v from authenticated;
revoke all on message_dispatcher.alert_terminal_spike_v from authenticated;
revoke all on message_dispatcher.alert_janitor_churn_v from authenticated;
revoke all on message_dispatcher.alert_retryable_depth_v from authenticated;
revoke all on message_dispatcher.alert_retryable_by_source_v from authenticated;

grant select on message_dispatcher.alert_queue_lag_v to service_role;
grant select on message_dispatcher.alert_terminal_spike_v to service_role;
grant select on message_dispatcher.alert_janitor_churn_v to service_role;
grant select on message_dispatcher.alert_retryable_depth_v to service_role;
grant select on message_dispatcher.alert_retryable_by_source_v to service_role;

create or replace function message_dispatcher.message_dispatcher_evaluate_alerts()
returns jsonb
language plpgsql
security definer
set search_path = message_dispatcher, public, auth
stable
as $$
declare
  v_lag bigint;
  v_ingested_15m bigint;
  v_terminal_15m bigint;
  v_terminal_rate numeric;
  v_janitor bigint;
  v_retryable bigint;
  v_retryable_threshold bigint;
  v_queue_threshold constant bigint := 1000;
  v_terminal_threshold constant numeric := 0.05;
  v_janitor_threshold constant bigint := 100;
begin
  select lag_count into v_lag from message_dispatcher.alert_queue_lag_v;

  select ingested_15m, terminal_15m, terminal_rate
  into v_ingested_15m, v_terminal_15m, v_terminal_rate
  from message_dispatcher.alert_terminal_spike_v;

  select lease_reclaims_1m into v_janitor from message_dispatcher.alert_janitor_churn_v;

  select retryable_count into v_retryable from message_dispatcher.alert_retryable_depth_v;

  select greatest(
    coalesce(
      (
        select (pc.value #>> '{}')::bigint
        from public.platform_constants pc
        where pc.key = 'message_dispatcher.retryable_depth_alert_threshold'
      ),
      10000::bigint
    ),
    10000::bigint
  )
  into v_retryable_threshold;

  return jsonb_build_object(
    'queue_lag',
    jsonb_build_object(
      'value', v_lag,
      'threshold', v_queue_threshold,
      'breached', v_lag > v_queue_threshold
    ),
    'terminal_spike',
    jsonb_build_object(
      'ingested_15m', v_ingested_15m,
      'terminal_15m', v_terminal_15m,
      'rate', v_terminal_rate,
      'threshold', v_terminal_threshold,
      'breached', v_ingested_15m > 0 and v_terminal_rate > v_terminal_threshold
    ),
    'janitor_churn',
    jsonb_build_object(
      'value', v_janitor,
      'threshold', v_janitor_threshold,
      'breached', v_janitor > v_janitor_threshold
    ),
    'retryable_depth',
    jsonb_build_object(
      'value', v_retryable,
      'threshold', v_retryable_threshold,
      'breached', v_retryable > v_retryable_threshold
    )
  );
end;
$$;

comment on function message_dispatcher.message_dispatcher_evaluate_alerts() is
  'Returns design §10.5 alert evaluation (queue lag, terminal spike, janitor churn, retryable depth).';

revoke all on function message_dispatcher.message_dispatcher_evaluate_alerts() from public;
revoke all on function message_dispatcher.message_dispatcher_evaluate_alerts() from authenticated;
grant execute on function message_dispatcher.message_dispatcher_evaluate_alerts() to service_role;

-- Task 83: refresh stats gauges for Logflare scrape (design §10.2). Task 84: includes alert snapshots.
create or replace function message_dispatcher.message_dispatcher_refresh_stats()
returns void
language plpgsql
security definer
set search_path = message_dispatcher, public, auth
as $$
declare
  v_alerts jsonb;
begin
  delete from message_dispatcher.message_dispatcher_stats;

  insert into message_dispatcher.message_dispatcher_stats (metric_name, labels, value)
  select
    'mmd_queue_depth',
    jsonb_build_object('status', d.status::text),
    count(*)::bigint
  from message_dispatcher.message_dispatches d
  group by d.status;

  insert into message_dispatcher.message_dispatcher_stats (metric_name, labels, value)
  values (
    'mmd_queue_lag',
    '{"threshold":"5m"}'::jsonb,
    (
      select count(*)::bigint
      from message_dispatcher.message_dispatches d
      where d.status = 'QUEUED'
        and d.scheduled_for < now() - interval '5 minutes'
    )
  );

  insert into message_dispatcher.message_dispatcher_stats (metric_name, labels, value)
  values (
    'mmd_retryable_failures',
    '{}'::jsonb,
    (
      select count(*)::bigint
      from message_dispatcher.message_dispatches d
      where d.status = 'FAILED_RETRYABLE'
    )
  );

  v_alerts := message_dispatcher.message_dispatcher_evaluate_alerts();

  insert into message_dispatcher.message_dispatcher_stats (metric_name, labels, value)
  values
    (
      'mmd_alert_queue_lag',
      jsonb_build_object('breached', (v_alerts->'queue_lag'->>'breached')::boolean),
      (v_alerts->'queue_lag'->>'value')::bigint
    ),
    (
      'mmd_alert_terminal_spike',
      jsonb_build_object('breached', (v_alerts->'terminal_spike'->>'breached')::boolean),
      ((v_alerts->'terminal_spike'->>'rate')::numeric * 10000)::bigint
    ),
    (
      'mmd_alert_janitor_churn',
      jsonb_build_object('breached', (v_alerts->'janitor_churn'->>'breached')::boolean),
      (v_alerts->'janitor_churn'->>'value')::bigint
    ),
    (
      'mmd_alert_retryable_depth',
      jsonb_build_object('breached', (v_alerts->'retryable_depth'->>'breached')::boolean),
      (v_alerts->'retryable_depth'->>'value')::bigint
    );
end;
$$;

comment on function message_dispatcher.message_dispatcher_refresh_stats() is
  'Replace gauge rows in message_dispatcher_stats for Logflare scrape (design §10.2–10.5, tasks 83–84, 109).';

revoke all on function message_dispatcher.message_dispatcher_refresh_stats() from public;
revoke all on function message_dispatcher.message_dispatcher_refresh_stats() from authenticated;
grant execute on function message_dispatcher.message_dispatcher_refresh_stats() to postgres;

do $cron$
declare
  v_jobid integer;
begin
  select j.jobid
  into v_jobid
  from cron.job j
  where j.jobname = 'mmd_refresh_stats';

  if v_jobid is not null then
    perform cron.unschedule(v_jobid);
  end if;
end;
$cron$;

select cron.schedule(
  'mmd_refresh_stats',
  '* * * * *',
  $$select message_dispatcher.message_dispatcher_refresh_stats();$$
);

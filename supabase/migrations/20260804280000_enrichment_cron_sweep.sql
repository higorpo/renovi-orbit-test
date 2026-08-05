-- Service completion Task 28: enrichment_cron_sweep + pg_cron + job_runs (design §4.7 / §6 / §10.2).
-- Safety net: reclaim expired leases → repair READY-without-dispatch → wake Edge for due PENDING.

create or replace function public.enrichment_cron_sweep()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_job_name constant text := 'enrichment_cron_sweep';
  v_job_run_id bigint;
  v_started_at timestamptz := clock_timestamp();
  v_batch_size int;
  v_reclaim jsonb := '{}'::jsonb;
  v_repair jsonb := '{}'::jsonb;
  v_reclaim_count int := 0;
  v_repair_count int := 0;
  v_due_pending_count int := 0;
  v_wake_requested boolean := false;
  v_wake_request_id bigint := null;
  v_error_count int := 0;
  v_error_samples jsonb := '[]'::jsonb;
  v_step text;
begin
  v_job_run_id := public.job_run_begin(v_job_name, 'v1');
  v_batch_size := public.platform_constant_int('enrichment_claim_batch_size', 20);

  -- Edge RPCs gate on auth.role() = service_role; mirror payment cron JWT claim pattern.
  perform set_config('request.jwt.claim.role', 'service_role', true);
  perform set_config(
    'request.jwt.claims',
    json_build_object('role', 'service_role')::text,
    true
  );

  -- (a) Reclaim expired RUNNING leases
  v_step := 'reclaim';
  begin
    v_reclaim := public.enrichment_reclaim_expired_leases(v_batch_size);
    v_reclaim_count := coalesce((v_reclaim->>'reclaimed_count')::int, 0);
  exception
    when others then
      v_error_count := v_error_count + 1;
      v_error_samples := v_error_samples || jsonb_build_array(
        jsonb_build_object(
          'step', v_step,
          'sqlstate', sqlstate,
          'message', public.sanitize_job_error(sqlerrm)
        )
      );
      raise warning
        'enrichment_cron_sweep reclaim failed sqlstate=% message=%',
        sqlstate,
        sqlerrm;
  end;

  -- (b) Repair READY without matching dispatch
  v_step := 'repair';
  begin
    v_repair := public.enrichment_repair_ready_without_dispatch(v_batch_size);
    v_repair_count := coalesce((v_repair->>'repaired_count')::int, 0);
  exception
    when others then
      v_error_count := v_error_count + 1;
      v_error_samples := v_error_samples || jsonb_build_array(
        jsonb_build_object(
          'step', v_step,
          'sqlstate', sqlstate,
          'message', public.sanitize_job_error(sqlerrm)
        )
      );
      raise warning
        'enrichment_cron_sweep repair failed sqlstate=% message=%',
        sqlstate,
        sqlerrm;
  end;

  -- (c) Presence check for due PENDING (ops_attention skipped); EXISTS is enough to wake Edge
  v_step := 'check_due';
  begin
    -- Boolean wake gate only — avoid count(*) full scan of due PENDING.
    select case when exists (
      select 1
      from public.service_request_enrichments e
      where e.status = 'PENDING'::public.enrichment_status
        and e.ops_attention_at is null
        and (e.next_attempt_at is null or e.next_attempt_at <= now())
    ) then 1 else 0 end
    into v_due_pending_count;
  exception
    when others then
      v_error_count := v_error_count + 1;
      v_error_samples := v_error_samples || jsonb_build_array(
        jsonb_build_object(
          'step', v_step,
          'sqlstate', sqlstate,
          'message', public.sanitize_job_error(sqlerrm)
        )
      );
      v_due_pending_count := 0;
      raise warning
        'enrichment_cron_sweep check_due failed sqlstate=% message=%',
        sqlstate,
        sqlerrm;
  end;

  if v_due_pending_count > 0 then
    v_step := 'wake';
    begin
      if public.orbit_internal_edge_invoke_is_configured() then
        v_wake_request_id := public.orbit_invoke_edge_function(
          'generate-completion-checklist',
          jsonb_build_object(
            'reason', 'cron_sweep',
            -- 0/1 presence flag (not a full due count) — Edge claims its own batch.
            'due_pending_count', v_due_pending_count,
            'batch_size', v_batch_size
          ),
          60000
        );
        v_wake_requested := true;
      else
        raise warning
          'enrichment_cron_sweep wake skipped: orbit_invoke not configured (due_pending_count=%)',
          v_due_pending_count;
      end if;
    exception
      when others then
        v_error_count := v_error_count + 1;
        v_error_samples := v_error_samples || jsonb_build_array(
          jsonb_build_object(
            'step', v_step,
            'sqlstate', sqlstate,
            'message', public.sanitize_job_error(sqlerrm)
          )
        );
        raise warning
          'enrichment_cron_sweep wake failed sqlstate=% message=%',
          sqlstate,
          sqlerrm;
    end;
  end if;

  perform public.job_run_finish(
    v_job_run_id,
    v_started_at,
    -- scanned: work units observed this tick
    v_reclaim_count + v_repair_count + v_due_pending_count,
    -- succeeded: reclaim + repair + successful wake scheduling
    v_reclaim_count + v_repair_count + case when v_wake_requested then 1 else 0 end,
    v_error_count,
    jsonb_build_object(
      'reclaim_count', v_reclaim_count,
      'repair_count', v_repair_count,
      'due_pending_count', v_due_pending_count,
      'wake_requested', v_wake_requested,
      'wake_request_id', v_wake_request_id,
      'batch_size', v_batch_size,
      'error_samples', v_error_samples
    ),
    case when v_error_count > 0 then 'step_errors' else null end
  );

  return jsonb_build_object(
    'job_run_id', v_job_run_id,
    'reclaim_count', v_reclaim_count,
    'repair_count', v_repair_count,
    'due_pending_count', v_due_pending_count,
    'wake_requested', v_wake_requested,
    'wake_request_id', v_wake_request_id,
    'error_count', v_error_count,
    'error_samples', v_error_samples
  );
exception
  when others then
    perform public.job_run_abort_latest(v_job_name, sqlerrm);
    raise;
end;
$$;

comment on function public.enrichment_cron_sweep() is
  'pg_cron safety net: reclaim expired leases, repair READY-without-dispatch, wake generate-completion-checklist for due PENDING (ops_attention skipped); job_runs telemetry (Task 28).';

revoke all on function public.enrichment_cron_sweep() from public;
revoke all on function public.enrichment_cron_sweep() from anon;
revoke all on function public.enrichment_cron_sweep() from authenticated;
grant execute on function public.enrichment_cron_sweep() to postgres;

-- Cron wrapper (postgres) must be able to invoke worker RPCs after JWT claim elevation.
grant execute on function public.enrichment_reclaim_expired_leases(int) to postgres;
grant execute on function public.enrichment_repair_ready_without_dispatch(int) to postgres;

-- Schedule every minute so PENDING age stays within enrichment SLO (retry base 30s, lease 120s).
do $register$
declare
  v_jobid integer;
begin
  select j.jobid
  into v_jobid
  from cron.job j
  where j.jobname = 'enrichment_cron_sweep';

  if v_jobid is not null then
    perform cron.unschedule(v_jobid);
  end if;

  perform cron.schedule(
    'enrichment_cron_sweep',
    '* * * * *',
    $$select public.enrichment_cron_sweep();$$
  );
end;
$register$;

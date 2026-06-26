-- Payment Task 55: payment_cron_process_webhook_retry wrapper (design.md §4.7.2, §4.7.4, §6.4).

create or replace function public.payment_recover_stuck_webhook_processing(
  p_stale_minutes int default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_stale_minutes int;
  v_queue_recovered int := 0;
  v_events_recovered int := 0;
  v_base int;
begin
  if coalesce(auth.role(), '') <> 'service_role' then
    raise exception 'service_role required for payment_recover_stuck_webhook_processing'
      using errcode = '42501';
  end if;

  v_stale_minutes := coalesce(
    p_stale_minutes,
    public.platform_constant_int('webhook_stuck_processing_minutes', 15)
  );
  v_base := public.platform_constant_int('webhook_base_retry_interval_minutes', 5);

  update public.payment_webhook_processing_queue q
  set
    state = 'PENDING'::public.payment_webhook_queue_state,
    attempted_at = null,
    failure_reason = coalesce(q.failure_reason, 'stuck_processing_recovered')
  where q.state = 'PROCESSING'::public.payment_webhook_queue_state
    and q.attempted_at is not null
    and q.attempted_at < now() - make_interval(mins => v_stale_minutes);

  get diagnostics v_queue_recovered = row_count;

  update public.payment_webhook_events e
  set
    state = 'FAILED'::public.payment_webhook_event_state,
    failure_reason = coalesce(e.failure_reason, 'stuck_processing_recovered'),
    retry_count = e.retry_count + 1,
    next_retry_at = now() + (v_base * interval '1 minute'),
    updated_at = now()
  where e.state = 'PROCESSING'::public.payment_webhook_event_state
    and e.updated_at < now() - make_interval(mins => v_stale_minutes)
    and not exists (
      select 1
      from public.payment_webhook_processing_queue q
      where q.webhook_event_id = e.id
        and q.state = 'PROCESSING'::public.payment_webhook_queue_state
        and q.attempted_at >= now() - make_interval(mins => v_stale_minutes)
    );

  get diagnostics v_events_recovered = row_count;

  return jsonb_build_object(
    'queue_recovered', v_queue_recovered,
    'events_recovered', v_events_recovered,
    'stale_minutes', v_stale_minutes
  );
end;
$$;

comment on function public.payment_recover_stuck_webhook_processing(int) is
  'Reclaims webhook queue rows and events stuck in PROCESSING after worker crash (service_role only).';

revoke all on function public.payment_recover_stuck_webhook_processing(int) from public;
revoke all on function public.payment_recover_stuck_webhook_processing(int) from anon;
revoke all on function public.payment_recover_stuck_webhook_processing(int) from authenticated;

grant execute on function public.payment_recover_stuck_webhook_processing(int) to service_role;

create or replace function public.payment_finish_webhook_retry_failure(
  p_event_id uuid,
  p_failure_reason text,
  p_queue_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_base int;
  v_max_retries int;
  v_retry_count smallint;
  v_attempt_count int := 0;
  v_queue_id uuid := p_queue_id;
begin
  if coalesce(auth.role(), '') <> 'service_role' then
    raise exception 'service_role required for payment_finish_webhook_retry_failure'
      using errcode = '42501';
  end if;

  v_base := public.platform_constant_int('webhook_base_retry_interval_minutes', 5);
  v_max_retries := public.platform_constant_int('max_webhook_retries', 3);

  select e.retry_count + 1
  into v_retry_count
  from public.payment_webhook_events e
  where e.id = p_event_id
  for update;

  if not found then
    raise exception 'WEBHOOK_EVENT_NOT_FOUND'
      using errcode = 'P0002';
  end if;

  if v_queue_id is null then
    select q.id, q.attempt_count
    into v_queue_id, v_attempt_count
    from public.payment_webhook_processing_queue q
    where q.webhook_event_id = p_event_id;
  else
    select q.attempt_count
    into v_attempt_count
    from public.payment_webhook_processing_queue q
    where q.id = v_queue_id;
  end if;

  v_attempt_count := coalesce(v_attempt_count, 0);

  if v_retry_count >= v_max_retries or v_attempt_count >= v_max_retries then
    update public.payment_webhook_events e
    set
      state = 'DEAD_LETTER'::public.payment_webhook_event_state,
      failure_reason = left(p_failure_reason, 4000),
      retry_count = v_retry_count,
      next_retry_at = null,
      updated_at = now()
    where e.id = p_event_id;

    if v_queue_id is not null then
      update public.payment_webhook_processing_queue q
      set
        state = 'FAILED'::public.payment_webhook_queue_state,
        failure_reason = left(p_failure_reason, 4000)
      where q.id = v_queue_id;
    end if;

    raise log
      'payment_cron_process_webhook_retry: WEBHOOK_DEAD_LETTER CRITICAL event_id=% retry_count=% attempt_count=% reason=%',
      p_event_id,
      v_retry_count,
      v_attempt_count,
      left(p_failure_reason, 500);

    return jsonb_build_object(
      'outcome', 'dead_letter',
      'event_id', p_event_id,
      'retry_count', v_retry_count,
      'attempt_count', v_attempt_count
    );
  end if;

  update public.payment_webhook_events e
  set
    state = 'FAILED'::public.payment_webhook_event_state,
    failure_reason = left(p_failure_reason, 4000),
    retry_count = v_retry_count,
    next_retry_at = now() + (
      v_base * power(2, greatest(v_retry_count - 1, 0)) * interval '1 minute'
    ),
    updated_at = now()
  where e.id = p_event_id;

  if v_queue_id is not null then
    update public.payment_webhook_processing_queue q
    set
      state = 'FAILED'::public.payment_webhook_queue_state,
      failure_reason = left(p_failure_reason, 4000)
    where q.id = v_queue_id;
  end if;

  return jsonb_build_object(
    'outcome', 'failed',
    'event_id', p_event_id,
    'retry_count', v_retry_count,
    'attempt_count', v_attempt_count
  );
end;
$$;

comment on function public.payment_finish_webhook_retry_failure(uuid, text, uuid) is
  'Retry worker failure path: exponential backoff or DEAD_LETTER after 3 failures (service_role only).';

revoke all on function public.payment_finish_webhook_retry_failure(uuid, text, uuid) from public;
revoke all on function public.payment_finish_webhook_retry_failure(uuid, text, uuid) from anon;
revoke all on function public.payment_finish_webhook_retry_failure(uuid, text, uuid) from authenticated;

grant execute on function public.payment_finish_webhook_retry_failure(uuid, text, uuid) to service_role;

create or replace function public.payment_cron_process_webhook_retry()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_job_name constant text := 'process-webhook-retry';
  v_job_run_id bigint;
  v_started_at timestamptz := clock_timestamp();
  v_recovery jsonb;
  v_queue_claims jsonb;
  v_retry_claims jsonb;
  v_item jsonb;
  v_fail_result jsonb;
  v_process_result jsonb;
  v_event_id uuid;
  v_queue_id uuid;
  v_claimed_count int := 0;
  v_processed_count int := 0;
  v_error_count int := 0;
  v_queue_processed int := 0;
  v_events_retried int := 0;
  v_dead_letter_count int := 0;
begin
  v_job_run_id := public.job_run_begin(v_job_name, 'v1');

  begin
    perform set_config('request.jwt.claim.role', 'service_role', true);
    perform set_config(
      'request.jwt.claims',
      json_build_object('role', 'service_role')::text,
      true
    );

    v_recovery := public.payment_recover_stuck_webhook_processing();

    v_queue_claims := public.payment_claim_webhook_processing_batch();
    v_retry_claims := public.payment_claim_webhook_retry_batch();

    v_claimed_count :=
      coalesce(jsonb_array_length(v_queue_claims), 0)
      + coalesce(jsonb_array_length(v_retry_claims), 0);

    for v_item in
      select value
      from jsonb_array_elements(coalesce(v_queue_claims, '[]'::jsonb))
    loop
      v_event_id := (v_item->>'event_id')::uuid;
      v_queue_id := (v_item->>'queue_id')::uuid;

      begin
        v_process_result := public.payment_process_webhook_event(v_event_id);

        if v_process_result->>'outcome' in (
          'processed',
          'already_processed',
          'duplicate_skipped'
        ) then
          update public.payment_webhook_processing_queue q
          set state = 'PROCESSED'::public.payment_webhook_queue_state
          where q.id = v_queue_id;

          v_processed_count := v_processed_count + 1;
          v_queue_processed := v_queue_processed + 1;
        elsif v_process_result->>'outcome' = 'retry_scheduled' then
          v_fail_result := public.payment_finish_webhook_retry_failure(
            v_event_id,
            coalesce(
              v_process_result #>> '{handler,reason}',
              'handler_retry_scheduled'
            ),
            v_queue_id
          );

          if v_fail_result->>'outcome' = 'dead_letter' then
            v_dead_letter_count := v_dead_letter_count + 1;
          end if;
        else
          raise exception 'unexpected webhook process outcome: %',
            v_process_result->>'outcome';
        end if;
      exception
        when others then
          v_error_count := v_error_count + 1;
          v_fail_result := public.payment_finish_webhook_retry_failure(
            v_event_id,
            sqlerrm,
            v_queue_id
          );

          if v_fail_result->>'outcome' = 'dead_letter' then
            v_dead_letter_count := v_dead_letter_count + 1;
          end if;

          raise warning
            'payment_cron_process_webhook_retry queue row failed event_id=% queue_id=% sqlstate=% message=%',
            v_event_id,
            v_queue_id,
            sqlstate,
            sqlerrm;
      end;
    end loop;

    for v_item in
      select value
      from jsonb_array_elements(coalesce(v_retry_claims, '[]'::jsonb))
    loop
      v_event_id := (v_item->>'event_id')::uuid;
      v_queue_id := null;

      begin
        v_process_result := public.payment_process_webhook_event(v_event_id);

        if v_process_result->>'outcome' in (
          'processed',
          'already_processed',
          'duplicate_skipped'
        ) then
          update public.payment_webhook_processing_queue q
          set state = 'PROCESSED'::public.payment_webhook_queue_state
          where q.webhook_event_id = v_event_id
            and q.state <> 'PROCESSED'::public.payment_webhook_queue_state;

          v_processed_count := v_processed_count + 1;
          v_events_retried := v_events_retried + 1;
        elsif v_process_result->>'outcome' = 'retry_scheduled' then
          v_fail_result := public.payment_finish_webhook_retry_failure(
            v_event_id,
            coalesce(
              v_process_result #>> '{handler,reason}',
              'handler_retry_scheduled'
            ),
            null
          );

          if v_fail_result->>'outcome' = 'dead_letter' then
            v_dead_letter_count := v_dead_letter_count + 1;
          end if;
        else
          raise exception 'unexpected webhook process outcome: %',
            v_process_result->>'outcome';
        end if;
      exception
        when others then
          v_error_count := v_error_count + 1;
          v_fail_result := public.payment_finish_webhook_retry_failure(
            v_event_id,
            sqlerrm,
            null
          );

          if v_fail_result->>'outcome' = 'dead_letter' then
            v_dead_letter_count := v_dead_letter_count + 1;
          end if;

          raise warning
            'payment_cron_process_webhook_retry failed event retry event_id=% sqlstate=% message=%',
            v_event_id,
            sqlstate,
            sqlerrm;
      end;
    end loop;

    perform public.job_run_finish(
      v_job_run_id,
      v_started_at,
      v_claimed_count,
      v_processed_count,
      v_error_count,
      jsonb_build_object(
        'queue_processed', v_queue_processed,
        'events_retried', v_events_retried,
        'dead_letter_count', v_dead_letter_count,
        'claimed_count', v_claimed_count,
        'recovery', v_recovery
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

comment on function public.payment_cron_process_webhook_retry() is
  'pg_cron entrypoint: drain webhook processing queue + FAILED event retries with job_runs telemetry.';

revoke all on function public.payment_cron_process_webhook_retry() from public;
revoke all on function public.payment_cron_process_webhook_retry() from anon;
revoke all on function public.payment_cron_process_webhook_retry() from authenticated;

grant execute on function public.payment_cron_process_webhook_retry() to postgres;

-- Rollout: enable after webhook claim/process smoke tests (design.md §6.4).
-- select cron.schedule(
--   'process-webhook-retry',
--   '*/5 * * * *',
--   $$select public.payment_cron_process_webhook_retry();$$
-- );
-- update cron.job
-- set active = false
-- where jobname = 'process-webhook-retry';

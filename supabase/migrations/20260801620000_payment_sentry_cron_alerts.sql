-- Payment Task 82: Sentry alert bridge for SQL cron paths (design.md §10.1, Req 21.5–21.7).

create or replace function public.payment_cron_post_sentry_alerts(
  p_alerts jsonb
)
returns bigint
language plpgsql
security definer
set search_path = public, vault, extensions
as $$
declare
  v_url text;
  v_key text;
begin
  if p_alerts is null or jsonb_typeof(p_alerts) <> 'array' or jsonb_array_length(p_alerts) = 0 then
    return null;
  end if;

  select nullif(trim(decrypted_secret), '')
  into v_url
  from vault.decrypted_secrets
  where name = 'payment_supabase_url';

  select nullif(trim(decrypted_secret), '')
  into v_key
  from vault.decrypted_secrets
  where name = 'payment_service_role_key';

  if v_url is null then
    v_url := nullif(btrim(current_setting('app.supabase_url', true)), '');
  end if;

  if v_key is null then
    v_key := nullif(btrim(current_setting('app.service_role_key', true)), '');
  end if;

  if v_url is null or v_key is null then
    raise warning 'payment_cron_post_sentry_alerts skipped: missing payment_supabase_url or payment_service_role_key';
    return null;
  end if;

  return net.http_post(
    url := v_url || '/functions/v1/payment-emit-sentry-alerts',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || v_key
    ),
    body := jsonb_build_object('alerts', p_alerts),
    timeout_milliseconds := 15000
  );
end;
$$;

comment on function public.payment_cron_post_sentry_alerts(jsonb) is
  'Internal pg_net helper: dispatch §10.1 Sentry alerts from SQL cron wrappers via payment-emit-sentry-alerts EF.';

revoke all on function public.payment_cron_post_sentry_alerts(jsonb) from public;
revoke all on function public.payment_cron_post_sentry_alerts(jsonb) from anon;
revoke all on function public.payment_cron_post_sentry_alerts(jsonb) from authenticated;

grant execute on function public.payment_cron_post_sentry_alerts(jsonb) to postgres;

create or replace function public.payment_auto_cancel_services(
  p_batch_size int default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_service record;
  v_cancel_hours int;
  v_batch_size int;
  v_reason text;
  v_last_failure_reason text;
  v_results jsonb := '[]'::jsonb;
  v_errors int := 0;
begin
  if coalesce(auth.role(), '') <> 'service_role' then
    raise exception 'service_role required for payment_auto_cancel_services'
      using errcode = '42501';
  end if;

  v_cancel_hours := public.platform_constant_int('auto_cancel_hours_before_service', 12);
  v_batch_size := greatest(
    coalesce(
      p_batch_size,
      public.platform_constant_int('auto_cancel_batch_size', 100)
    ),
    1
  );

  for v_service in
    select
      cs.id as service_id,
      cs.client_id,
      cs.provider_id,
      cs.status as service_status,
      ps.id as schedule_id,
      ps.state as schedule_state,
      ps.failure_reason,
      pga.onboarding_status
    from public.contracted_services cs
    inner join public.payment_schedules ps on ps.contracted_service_id = cs.id
    left join public.provider_gateway_accounts pga
      on pga.provider_id = ps.provider_id
      and pga.gateway_slug = ps.gateway_slug
    where cs.service_execution_at - now()
      <= make_interval(hours => v_cancel_hours)
      and cs.status not in (
        'CANCELLED'::public.contracted_service_status,
        'COMPLETED'::public.contracted_service_status
      )
      and (
        ps.state in (
          'SCHEDULED'::public.payment_schedule_state,
          'FAILED'::public.payment_schedule_state,
          'FAILED_PERMANENT'::public.payment_schedule_state
        )
        or ps.state = 'IN_ANALYSIS'::public.payment_schedule_state
      )
    order by cs.service_execution_at, cs.id
    limit v_batch_size
    for update of cs, ps skip locked
  loop
    begin
      if v_service.service_status = 'CANCELLED'::public.contracted_service_status then
        continue;
      end if;

      v_reason := case
        when v_service.onboarding_status = 'SUSPENDED'::public.payment_provider_onboarding_status
          then 'PROVIDER_SUSPENDED'
        else 'NON_PAYMENT'
      end;

      v_last_failure_reason := v_service.failure_reason;

      update public.contracted_services cs
      set
        status = 'CANCELLED'::public.contracted_service_status,
        cancellation_reason = v_reason
      where cs.id = v_service.service_id;

      update public.payment_schedules ps
      set
        state = 'CANCELLED'::public.payment_schedule_state,
        cancelled_at = now(),
        cancellation_reason = v_reason,
        updated_at = now()
      where ps.id = v_service.schedule_id;

      perform public.payment_write_audit(
        p_event_type := 'AUTO_CANCELLED',
        p_entity_type := 'payment_schedule',
        p_entity_id := v_service.schedule_id,
        p_service_id := v_service.service_id,
        p_schedule_id := v_service.schedule_id,
        p_from_state := v_service.schedule_state::text,
        p_to_state := 'CANCELLED',
        p_actor := 'system'::public.payment_audit_actor,
        p_metadata := jsonb_build_object(
          'cancellation_reason', v_reason,
          'service_status', v_service.service_status::text,
          'last_failure_reason', v_last_failure_reason
        )
      );

      perform public.payment_write_event(
        p_event_type := 'ServiceAutoCancelled',
        p_aggregate_type := 'payment_schedule',
        p_aggregate_id := v_service.schedule_id,
        p_service_id := v_service.service_id,
        p_payload := jsonb_build_object(
          'schedule_id', v_service.schedule_id,
          'cancellation_reason', v_reason,
          'last_failure_reason', v_last_failure_reason,
          'requires_gateway_reconcile',
            v_service.schedule_state = 'IN_ANALYSIS'::public.payment_schedule_state
        )
      );

      v_results := v_results || jsonb_build_array(
        jsonb_build_object(
          'service_id', v_service.service_id,
          'schedule_id', v_service.schedule_id,
          'client_id', v_service.client_id,
          'provider_id', v_service.provider_id,
          'cancellation_reason', v_reason,
          'last_failure_reason', v_last_failure_reason,
          'schedule_state', v_service.schedule_state,
          'requires_gateway_reconcile',
            v_service.schedule_state = 'IN_ANALYSIS'::public.payment_schedule_state
        )
      );
    exception
      when others then
        v_errors := v_errors + 1;
        raise warning
          'payment_auto_cancel_services row failed service_id=% schedule_id=% sqlstate=% message=%',
          v_service.service_id,
          v_service.schedule_id,
          sqlstate,
          sqlerrm;
    end;
  end loop;

  return jsonb_build_object(
    'cancelled_count', jsonb_array_length(v_results),
    'cancelled', v_results,
    'errors_count', v_errors
  );
end;
$$;

create or replace function public.payment_cron_auto_cancel_unpaid_services()
returns void
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_job_name constant text := 'auto-cancel-unpaid-services';
  v_job_run_id bigint;
  v_started_at timestamptz := clock_timestamp();
  v_result jsonb;
  v_cancelled_count int;
  v_error_count int;
  v_sentry_alerts jsonb;
begin
  v_job_run_id := public.job_run_begin(v_job_name, 'v1');

  begin
    perform set_config('request.jwt.claim.role', 'service_role', true);
    perform set_config(
      'request.jwt.claims',
      json_build_object('role', 'service_role')::text,
      true
    );

    v_result := public.payment_auto_cancel_services();
    v_cancelled_count := coalesce((v_result->>'cancelled_count')::int, 0);
    v_error_count := coalesce((v_result->>'errors_count')::int, 0);

    if v_cancelled_count > 0 then
      select coalesce(
        jsonb_agg(
          jsonb_build_object(
            'kind', 'auto_cancel',
            'service_id', item->>'service_id',
            'schedule_id', item->>'schedule_id',
            'last_failure_reason', item->>'last_failure_reason'
          )
        ),
        '[]'::jsonb
      )
      into v_sentry_alerts
      from jsonb_array_elements(v_result->'cancelled') as item;

      perform public.payment_cron_post_sentry_alerts(v_sentry_alerts);
    end if;

    perform public.job_run_finish(
      v_job_run_id,
      v_started_at,
      v_cancelled_count + v_error_count,
      v_cancelled_count,
      v_error_count,
      jsonb_build_object(
        'cancelled', v_result->'cancelled',
        'cancelled_count', v_cancelled_count,
        'errors_count', v_error_count
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

create or replace function public.payment_cron_process_webhook_retry()
returns void
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_job_name constant text := 'process-webhook-retry';
  v_job_run_id bigint;
  v_started_at timestamptz := clock_timestamp();
  v_recovery jsonb;
  v_queue_claims jsonb;
  v_retry_claims jsonb;
  v_item jsonb;
  v_event_id uuid;
  v_queue_id uuid;
  v_process_result jsonb;
  v_fail_result jsonb;
  v_claimed_count int := 0;
  v_processed_count int := 0;
  v_error_count int := 0;
  v_queue_processed int := 0;
  v_events_retried int := 0;
  v_dead_letter_count int := 0;
  v_sentry_alerts jsonb := '[]'::jsonb;
  v_event record;
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

          -- CHK-037: CRITICAL dispute alert when deferred webhook path processes TRANSACTION_DISPUTE.
          if coalesce(v_process_result #>> '{handler,outcome}', '') = 'disputed'
            and v_process_result #> '{handler,sentry_alert}' is not null then
            v_sentry_alerts := v_sentry_alerts || jsonb_build_array(
              v_process_result #> '{handler,sentry_alert}'
            );
          end if;
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
            select e.id, e.event_type, e.gateway_event_id, e.failure_reason, e.retry_count
            into v_event
            from public.payment_webhook_events e
            where e.id = v_event_id;

            v_sentry_alerts := v_sentry_alerts || jsonb_build_array(
              jsonb_build_object(
                'kind', 'webhook_dead_letter',
                'event_id', v_event.id,
                'event_type', v_event.event_type,
                'gateway_event_id', v_event.gateway_event_id,
                'failure_reason', v_event.failure_reason,
                'retry_count', v_event.retry_count
              )
            );
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
            select e.id, e.event_type, e.gateway_event_id, e.failure_reason, e.retry_count
            into v_event
            from public.payment_webhook_events e
            where e.id = v_event_id;

            v_sentry_alerts := v_sentry_alerts || jsonb_build_array(
              jsonb_build_object(
                'kind', 'webhook_dead_letter',
                'event_id', v_event.id,
                'event_type', v_event.event_type,
                'gateway_event_id', v_event.gateway_event_id,
                'failure_reason', v_event.failure_reason,
                'retry_count', v_event.retry_count
              )
            );
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

          if coalesce(v_process_result #>> '{handler,outcome}', '') = 'disputed'
            and v_process_result #> '{handler,sentry_alert}' is not null then
            v_sentry_alerts := v_sentry_alerts || jsonb_build_array(
              v_process_result #> '{handler,sentry_alert}'
            );
          end if;
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
            select e.id, e.event_type, e.gateway_event_id, e.failure_reason, e.retry_count
            into v_event
            from public.payment_webhook_events e
            where e.id = v_event_id;

            v_sentry_alerts := v_sentry_alerts || jsonb_build_array(
              jsonb_build_object(
                'kind', 'webhook_dead_letter',
                'event_id', v_event.id,
                'event_type', v_event.event_type,
                'gateway_event_id', v_event.gateway_event_id,
                'failure_reason', v_event.failure_reason,
                'retry_count', v_event.retry_count
              )
            );
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
            select e.id, e.event_type, e.gateway_event_id, e.failure_reason, e.retry_count
            into v_event
            from public.payment_webhook_events e
            where e.id = v_event_id;

            v_sentry_alerts := v_sentry_alerts || jsonb_build_array(
              jsonb_build_object(
                'kind', 'webhook_dead_letter',
                'event_id', v_event.id,
                'event_type', v_event.event_type,
                'gateway_event_id', v_event.gateway_event_id,
                'failure_reason', v_event.failure_reason,
                'retry_count', v_event.retry_count
              )
            );
          end if;

          raise warning
            'payment_cron_process_webhook_retry failed event retry event_id=% sqlstate=% message=%',
            v_event_id,
            sqlstate,
            sqlerrm;
      end;
    end loop;

    if jsonb_array_length(v_sentry_alerts) > 0 then
      perform public.payment_cron_post_sentry_alerts(v_sentry_alerts);
    end if;

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

-- FIX-011 / CHK-026: 15m spike views + cron → payment-emit-sentry-alerts.

create or replace view public.payment_alert_webhook_auth_fail_spike_v
with (security_invoker = true) as
select count(*)::bigint as auth_fail_15m
from public.payment_webhook_events e
where e.failure_reason = 'INVALID_SIGNATURE'
  and e.created_at > now() - interval '15 minutes';

comment on view public.payment_alert_webhook_auth_fail_spike_v is
  'Webhook INVALID_SIGNATURE count in last 15m (alert when auth_fail_15m > threshold).';

create or replace view public.payment_alert_failed_permanent_spike_v
with (security_invoker = true) as
select count(*)::bigint as failed_permanent_15m
from public.payment_audit_log a
where a.event_type = 'CHARGE_FAILED_PERMANENT'
  and a.created_at > now() - interval '15 minutes';

comment on view public.payment_alert_failed_permanent_spike_v is
  'CHARGE_FAILED_PERMANENT audit events in last 15m (alert when count > threshold).';

revoke all on public.payment_alert_webhook_auth_fail_spike_v from public;
revoke all on public.payment_alert_webhook_auth_fail_spike_v from anon;
revoke all on public.payment_alert_webhook_auth_fail_spike_v from authenticated;
revoke all on public.payment_alert_failed_permanent_spike_v from public;
revoke all on public.payment_alert_failed_permanent_spike_v from anon;
revoke all on public.payment_alert_failed_permanent_spike_v from authenticated;

grant select on public.payment_alert_webhook_auth_fail_spike_v to service_role;
grant select on public.payment_alert_failed_permanent_spike_v to service_role;

create or replace function public.payment_evaluate_sentry_spike_alerts()
returns jsonb
language plpgsql
security definer
set search_path = public
stable
as $$
declare
  v_auth_fail_15m bigint;
  v_failed_permanent_15m bigint;
  v_auth_fail_threshold int;
  v_failed_permanent_threshold int;
  v_alerts jsonb := '[]'::jsonb;
begin
  select auth_fail_15m into v_auth_fail_15m
  from public.payment_alert_webhook_auth_fail_spike_v;

  select failed_permanent_15m into v_failed_permanent_15m
  from public.payment_alert_failed_permanent_spike_v;

  v_auth_fail_threshold := greatest(
    public.platform_constant_int('payment_webhook_auth_fail_spike_threshold_15m', 10),
    1
  );
  v_failed_permanent_threshold := greatest(
    public.platform_constant_int('payment_failed_permanent_spike_threshold_15m', 5),
    1
  );

  if coalesce(v_auth_fail_15m, 0) > v_auth_fail_threshold then
    v_alerts := v_alerts || jsonb_build_array(
      jsonb_build_object(
        'kind', 'webhook_auth_fail_spike',
        'count_15m', v_auth_fail_15m,
        'threshold', v_auth_fail_threshold
      )
    );
  end if;

  if coalesce(v_failed_permanent_15m, 0) > v_failed_permanent_threshold then
    v_alerts := v_alerts || jsonb_build_array(
      jsonb_build_object(
        'kind', 'failed_permanent_spike',
        'count_15m', v_failed_permanent_15m,
        'threshold', v_failed_permanent_threshold
      )
    );
  end if;

  return v_alerts;
end;
$$;

comment on function public.payment_evaluate_sentry_spike_alerts() is
  'Returns payment-emit-sentry-alerts payloads for breached 15m webhook auth / FAILED_PERMANENT spikes.';

revoke all on function public.payment_evaluate_sentry_spike_alerts() from public;
revoke all on function public.payment_evaluate_sentry_spike_alerts() from anon;
revoke all on function public.payment_evaluate_sentry_spike_alerts() from authenticated;

grant execute on function public.payment_evaluate_sentry_spike_alerts() to service_role;
grant execute on function public.payment_evaluate_sentry_spike_alerts() to postgres;

create or replace function public.payment_cron_emit_sentry_spike_alerts()
returns void
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_job_name constant text := 'payment-emit-sentry-spike-alerts';
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

    v_alerts := public.payment_evaluate_sentry_spike_alerts();
    v_alert_count := coalesce(jsonb_array_length(v_alerts), 0);

    if v_alert_count > 0 then
      perform public.payment_cron_post_sentry_alerts(v_alerts);
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

comment on function public.payment_cron_emit_sentry_spike_alerts() is
  'pg_cron wrapper: evaluate 15m payment spike views and post breached alerts to Sentry EF.';

revoke all on function public.payment_cron_emit_sentry_spike_alerts() from public;
revoke all on function public.payment_cron_emit_sentry_spike_alerts() from anon;
revoke all on function public.payment_cron_emit_sentry_spike_alerts() from authenticated;

grant execute on function public.payment_cron_emit_sentry_spike_alerts() to postgres;

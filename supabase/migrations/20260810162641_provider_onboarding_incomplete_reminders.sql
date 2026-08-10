-- Incomplete provider onboarding nudges (push + email) via MMD.
-- SQL-only claim → mmd_ingest_event; no Edge Function (no external I/O).
-- Stub gateway rows come from trg_profiles_bootstrap_provider_gateway_account.

create or replace function public.enqueue_provider_onboarding_incomplete_reminders(
  p_batch_size int default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, message_dispatcher
as $$
declare
  v_processed int := 0;
  v_enqueued int := 0;
  v_skipped int := 0;
  v_error_count int := 0;
  v_row record;
  v_next_count int;
  v_idempotency_key text;
  v_result jsonb;
  v_batch_size int;
  v_reminder_initial_hours int := public.platform_constant_int(
    'provider_onboarding_reminder_initial_hours',
    24
  );
  v_reminder_interval_hours int := public.platform_constant_int(
    'provider_onboarding_reminder_interval_hours',
    72
  );
  v_reminder_max_count int := public.platform_constant_int(
    'provider_onboarding_reminder_max_count',
    8
  );
begin
  v_batch_size := greatest(
    coalesce(
      p_batch_size,
      public.platform_constant_int('provider_onboarding_reminder_batch_size', 100)
    ),
    1
  );

  if v_batch_size > 500 then
    raise exception 'p_batch_size must be between 1 and 500'
      using errcode = '22023';
  end if;

  perform public.cns_set_local_statement_timeout('120s');

  for v_row in
    select
      pga.id,
      pga.provider_id,
      pga.onboarding_status,
      pga.onboarding_reminder_count,
      pga.last_onboarding_reminder_at,
      pga.created_at
    from public.provider_gateway_accounts pga
    where pga.onboarding_status in (
      'PENDING_DOCUMENTS'::public.payment_provider_onboarding_status,
      'REJECTED'::public.payment_provider_onboarding_status
    )
      and pga.onboarding_reminder_count < v_reminder_max_count
      and (
        (
          pga.last_onboarding_reminder_at is null
          and now() >= pga.created_at + make_interval(hours => v_reminder_initial_hours)
        )
        or (
          pga.last_onboarding_reminder_at is not null
          and now() >= pga.last_onboarding_reminder_at
            + make_interval(hours => v_reminder_interval_hours)
        )
      )
    order by coalesce(pga.last_onboarding_reminder_at, pga.created_at), pga.id
    limit v_batch_size
    for update of pga skip locked
  loop
    begin
      v_processed := v_processed + 1;
      v_next_count := coalesce(v_row.onboarding_reminder_count, 0) + 1;

      v_idempotency_key := format(
        'provider_onboarding_incomplete:%s:reminder:%s',
        v_row.id,
        v_next_count
      );

      if exists (
        select 1
        from message_dispatcher.message_dispatches d
        where d.idempotency_key = public.mmd_idempotency_uuid(v_idempotency_key || ':push')
      ) then
        update public.provider_gateway_accounts pga
        set
          last_onboarding_reminder_at = coalesce(pga.last_onboarding_reminder_at, now()),
          onboarding_reminder_count = greatest(pga.onboarding_reminder_count, v_next_count)
        where pga.id = v_row.id
          and (
            pga.last_onboarding_reminder_at is null
            or pga.onboarding_reminder_count < v_next_count
          );

        v_skipped := v_skipped + 1;
        continue;
      end if;

      update public.provider_gateway_accounts pga
      set
        last_onboarding_reminder_at = now(),
        onboarding_reminder_count = v_next_count
      where pga.id = v_row.id
        and pga.onboarding_status in (
          'PENDING_DOCUMENTS'::public.payment_provider_onboarding_status,
          'REJECTED'::public.payment_provider_onboarding_status
        )
        and pga.onboarding_reminder_count = coalesce(v_row.onboarding_reminder_count, 0);

      if not found then
        v_skipped := v_skipped + 1;
        continue;
      end if;

      v_result := public.mmd_ingest_event(
        'PROVIDER_ONBOARDING_INCOMPLETE_REMINDER',
        v_row.provider_id,
        v_idempotency_key,
        jsonb_build_object(
          'provider_id', v_row.provider_id,
          'provider_gateway_account_id', v_row.id,
          'onboarding_status', v_row.onboarding_status::text,
          'reminder_count', v_next_count,
          'deep_link_path', '/dashboard/conta'
        ),
        jsonb_build_object(
          'recipient', 'provider',
          'provider_gateway_account_id', v_row.id,
          'onboarding_status', v_row.onboarding_status::text,
          'reminder_count', v_next_count
        )
      );

      if coalesce((v_result->>'ingested_count')::int, 0) > 0 then
        v_enqueued := v_enqueued + 1;
      else
        v_skipped := v_skipped + 1;
      end if;
    exception
      when others then
        v_error_count := v_error_count + 1;
        raise log 'enqueue_provider_onboarding_incomplete_reminders row_error account_id=% sqlstate=% message=%',
          v_row.id,
          sqlstate,
          sqlerrm;
    end;
  end loop;

  return jsonb_build_object(
    'processed_count', v_processed,
    'enqueued_count', v_enqueued,
    'skipped_count', v_skipped,
    'error_count', v_error_count
  );
end;
$$;

comment on function public.enqueue_provider_onboarding_incomplete_reminders(int) is
  'Enqueue push+email nudges for providers stuck in PENDING_DOCUMENTS or REJECTED onboarding.';

revoke all on function public.enqueue_provider_onboarding_incomplete_reminders(int)
  from public, anon, authenticated;
grant execute on function public.enqueue_provider_onboarding_incomplete_reminders(int)
  to service_role, postgres;

create or replace function public.cron_enqueue_provider_onboarding_incomplete_reminders()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_job_name constant text := 'enqueue_provider_onboarding_incomplete_reminders';
  v_job_run_id bigint;
  v_started_at timestamptz := clock_timestamp();
  v_result jsonb;
begin
  v_job_run_id := public.job_run_begin(v_job_name, 'v1');

  begin
    v_result := public.enqueue_provider_onboarding_incomplete_reminders();
    perform public.job_run_finish(
      v_job_run_id,
      v_started_at,
      coalesce((v_result->>'processed_count')::int, 0),
      coalesce((v_result->>'enqueued_count')::int, 0),
      coalesce((v_result->>'error_count')::int, 0),
      v_result,
      null
    );
    return v_result;
  exception
    when others then
      perform public.job_run_abort_latest(v_job_name, sqlerrm);
      raise;
  end;
end;
$$;

comment on function public.cron_enqueue_provider_onboarding_incomplete_reminders() is
  'pg_cron entrypoint: incomplete provider onboarding reminders with job_runs telemetry.';

revoke all on function public.cron_enqueue_provider_onboarding_incomplete_reminders()
  from public, anon, authenticated;
grant execute on function public.cron_enqueue_provider_onboarding_incomplete_reminders()
  to postgres;

do $cron$
declare
  v_jobid integer;
begin
  select j.jobid
  into v_jobid
  from cron.job j
  where j.jobname = 'enqueue_provider_onboarding_incomplete_reminders';

  if v_jobid is not null then
    perform cron.unschedule(v_jobid);
  end if;
end;
$cron$;

-- Daily at 11:00 UTC (after detect-netcred-onboarding at 10:00).
select cron.schedule(
  'enqueue_provider_onboarding_incomplete_reminders',
  '0 11 * * *',
  $$select public.cron_enqueue_provider_onboarding_incomplete_reminders();$$
);

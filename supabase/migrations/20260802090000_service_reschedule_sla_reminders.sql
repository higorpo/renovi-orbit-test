-- Service reschedule phase 2: SLA reminders to provider (6h, then daily, max 3 + urgent <24h).

create or replace function public.enqueue_service_reschedule_reminders(
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
  v_urgent boolean;
  v_idempotency_key text;
  v_sr public.service_requests%rowtype;
  v_cs public.contracted_services%rowtype;
  v_result jsonb;
  v_batch_size int;
  v_reminder_initial_hours int := public.platform_constant_int('service_reschedule.reminder_initial_hours', 6);
  v_reminder_interval_hours int := public.platform_constant_int('service_reschedule.reminder_interval_hours', 24);
  v_reminder_max_count int := public.platform_constant_int('service_reschedule.reminder_max_count', 3);
  v_last_minute_hours int := public.platform_constant_int('service_reschedule.last_minute_hours', 24);
begin
  v_batch_size := greatest(
    coalesce(
      p_batch_size,
      public.platform_constant_int('service_reschedule.batch_size', 50)
    ),
    1
  );

  if v_batch_size > 500 then
    raise exception 'p_batch_size must be between 1 and 500'
      using errcode = '22023';
  end if;

  perform public.cns_set_local_statement_timeout('120s');

  for v_row in
    select srr.*
    from public.service_reschedule_requests srr
    inner join public.contracted_services cs on cs.id = srr.contracted_service_id
    where srr.status in (
      'REQUESTED'::public.service_reschedule_request_status,
      'ADJUSTMENT_REQUESTED'::public.service_reschedule_request_status
    )
      and cs.status in (
        'PENDING_PAYMENT'::public.contracted_service_status,
        'CONFIRMED'::public.contracted_service_status
      )
      and (
        (
          srr.urgent_reminder_sent_at is null
          and srr.original_service_execution_at - now() < make_interval(hours => v_last_minute_hours)
        )
        or (
          srr.reminder_count < v_reminder_max_count
          and srr.last_reminder_at is null
          and now() >= case
            when srr.status = 'ADJUSTMENT_REQUESTED'::public.service_reschedule_request_status
              then srr.updated_at
            else srr.created_at
          end + make_interval(hours => v_reminder_initial_hours)
        )
        or (
          srr.reminder_count < v_reminder_max_count
          and srr.last_reminder_at is not null
          and now() >= srr.last_reminder_at + make_interval(hours => v_reminder_interval_hours)
        )
      )
    order by srr.created_at
    limit v_batch_size
    for update of srr skip locked
  loop
    begin
      v_processed := v_processed + 1;

      v_urgent :=
        v_row.urgent_reminder_sent_at is null
        and v_row.original_service_execution_at - now() < make_interval(hours => v_last_minute_hours);

      v_idempotency_key := format(
        'service_reschedule:%s:reminder:%s:%s',
        v_row.id,
        coalesce(v_row.reminder_count, 0) + case when v_urgent then 0 else 1 end,
        case when v_urgent then 'urgent' else 'regular' end
      );

      if exists (
        select 1
        from message_dispatcher.message_dispatches d
        where d.idempotency_key = public.mmd_idempotency_uuid(v_idempotency_key || ':push')
      ) then
        update public.service_reschedule_requests srr
        set
          last_reminder_at = coalesce(srr.last_reminder_at, now()),
          reminder_count = case
            when v_urgent then srr.reminder_count
            else greatest(srr.reminder_count, coalesce(v_row.reminder_count, 0) + 1)
          end,
          urgent_reminder_sent_at = case
            when v_urgent then coalesce(srr.urgent_reminder_sent_at, now())
            else srr.urgent_reminder_sent_at
          end
        where srr.id = v_row.id
          and (
            srr.last_reminder_at is null
            or (v_urgent and srr.urgent_reminder_sent_at is null)
          );

        v_skipped := v_skipped + 1;
        continue;
      end if;

      update public.service_reschedule_requests srr
      set
        last_reminder_at = now(),
        reminder_count = case
          when v_urgent then reminder_count
          else reminder_count + 1
        end,
        urgent_reminder_sent_at = case
          when v_urgent then now()
          else urgent_reminder_sent_at
        end
      where srr.id = v_row.id;

      select cs.*
      into v_cs
      from public.contracted_services cs
      where cs.id = v_row.contracted_service_id;

      select sr.*
      into v_sr
      from public.service_requests sr
      where sr.id = v_cs.service_request_id;

      v_result := public.mmd_ingest_event(
        'SERVICE_RESCHEDULE_REMINDER',
        v_cs.provider_id,
        v_idempotency_key,
        jsonb_build_object(
          'contracted_service_id', v_cs.id,
          'service_request_id', v_cs.service_request_id,
          'service_request_title', coalesce(v_sr.title, 'Serviço'),
          'deep_link_path', format('/dashboard/chats/%s', v_row.chat_id)
        ),
        jsonb_build_object(
          'reschedule_request_id', v_row.id,
          'urgent', v_urgent
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
        raise log 'enqueue_service_reschedule_reminders row_error request_id=% sqlstate=% message=%',
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

comment on function public.enqueue_service_reschedule_reminders(int) is
  'Enqueue provider push reminders for open reschedule requests (6h, daily x3, urgent <24h).';

revoke all on function public.enqueue_service_reschedule_reminders(int) from public, anon, authenticated;
grant execute on function public.enqueue_service_reschedule_reminders(int) to service_role, postgres;

create or replace function public.cron_enqueue_service_reschedule_reminders()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_job_name constant text := 'enqueue_service_reschedule_reminders';
  v_job_run_id bigint;
  v_started_at timestamptz := clock_timestamp();
  v_result jsonb;
begin
  v_job_run_id := public.job_run_begin(v_job_name, 'v1');

  begin
    v_result := public.enqueue_service_reschedule_reminders();
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

comment on function public.cron_enqueue_service_reschedule_reminders() is
  'pg_cron entrypoint: service reschedule SLA reminders to provider with job_runs telemetry.';

revoke all on function public.cron_enqueue_service_reschedule_reminders() from public, anon, authenticated;
grant execute on function public.cron_enqueue_service_reschedule_reminders() to postgres;

do $cron$
declare
  v_jobid integer;
begin
  select j.jobid
  into v_jobid
  from cron.job j
  where j.jobname = 'enqueue_service_reschedule_reminders';

  if v_jobid is not null then
    perform cron.unschedule(v_jobid);
  end if;
end;
$cron$;

select cron.schedule(
  'enqueue_service_reschedule_reminders',
  '0 * * * *',
  $$select public.cron_enqueue_service_reschedule_reminders();$$
);

-- Slim domain_events processor: dedicated SLA reminder cron; domain_events passive for historical replay.

create or replace function public.record_domain_event(
  p_event_type text,
  p_aggregate_type text,
  p_aggregate_id uuid,
  p_service_request_id uuid default null,
  p_chat_id uuid default null,
  p_payload jsonb default '{}'::jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_event_id uuid;
  v_normative_types constant text[] := array[
    'CHAT_MESSAGE_SENT',
    'PROPOSAL_SUBMITTED',
    'PROPOSAL_ACCEPTED',
    'PROPOSAL_REJECTED',
    'PROPOSAL_EXPIRED',
    'PROPOSAL_REVISION_REQUESTED',
    'CONVERSATION_INACTIVATED',
    'CONVERSATION_CLOSED',
    'CHATS_CLOSED_BULK',
    'SLOT_RELEASED',
    'SERVICE_REQUEST_COMPLETED',
    'SERVICE_REQUEST_CANCELLED',
    'NEGOTIATION_TERMINATED'
  ];
  v_notification_events constant text[] := array[]::text[];
begin
  if p_event_type is null or not (p_event_type = any (v_normative_types)) then
    raise exception 'UNKNOWN_DOMAIN_EVENT_TYPE: %', coalesce(p_event_type, '<null>')
      using errcode = '22023';
  end if;

  if nullif(btrim(p_aggregate_type), '') is null then
    raise exception 'p_aggregate_type is required'
      using errcode = '22023';
  end if;

  if p_aggregate_id is null then
    raise exception 'p_aggregate_id is required'
      using errcode = '22023';
  end if;

  if p_payload is null then
    raise exception 'p_payload must not be null'
      using errcode = '22023';
  end if;

  if p_event_type = 'CHATS_CLOSED_BULK' then
    if p_service_request_id is null
      and nullif(p_payload->>'service_request_id', '') is null then
      raise exception 'CHATS_CLOSED_BULK requires service_request_id column or payload.service_request_id'
        using errcode = '22023';
    end if;

    if not (
      (p_payload ? 'chat_ids' and jsonb_typeof(p_payload->'chat_ids') = 'array')
      or (
        p_payload ? 'closed_count'
        and (p_payload->>'closed_count') ~ '^[0-9]+$'
        and (p_payload->>'closed_count')::int >= 0
      )
    ) then
      raise exception 'CHATS_CLOSED_BULK payload requires chat_ids (uuid[]) or closed_count (non-negative int)'
        using errcode = '22023';
    end if;
  end if;

  if p_event_type = any (v_notification_events) then
    if nullif(btrim(p_payload->>'idempotency_key'), '') is null then
      raise exception 'payload.idempotency_key required for notification event %', p_event_type
        using errcode = '22023';
    end if;
  end if;

  insert into public.domain_events (
    event_type,
    aggregate_type,
    aggregate_id,
    service_request_id,
    chat_id,
    payload
  )
  values (
    p_event_type,
    btrim(p_aggregate_type),
    p_aggregate_id,
    p_service_request_id,
    p_chat_id,
    p_payload
  )
  returning id into v_event_id;

  raise log 'domain_event_inserted event_type=% event_id=% service_request_id=% chat_id=%',
    p_event_type,
    v_event_id,
    p_service_request_id,
    p_chat_id;

  return v_event_id;
end;
$$;

comment on function public.record_domain_event(text, text, uuid, uuid, uuid, jsonb) is
  'Outbox insert for admin/replay and future matching events. Live notifications use table triggers; v_notification_events is empty.';

create or replace function public.cns_process_domain_events(
  p_batch_size int default 100,
  p_worker_id text default 'cns_domain_events',
  p_record_job_run boolean default true
)
returns jsonb
language plpgsql
security definer
set search_path = public, message_dispatcher
as $$
declare
  v_started_at timestamptz := clock_timestamp();
  v_job_run_id bigint;
  v_processed int := 0;
  v_succeeded int := 0;
  v_failed int := 0;
  v_dead_lettered int := 0;
  v_backlog bigint;
  v_event public.domain_events%rowtype;
  v_new_retry_count int;
  v_backoff interval;
  v_duration_ms int;
  v_max_retries constant int := 5;
  v_cns_event_types constant text[] := array[
    'CHAT_MESSAGE_SENT',
    'PROPOSAL_SUBMITTED',
    'PROPOSAL_ACCEPTED',
    'PROPOSAL_REJECTED',
    'PROPOSAL_EXPIRED',
    'PROPOSAL_REVISION_REQUESTED',
    'CONVERSATION_INACTIVATED',
    'CONVERSATION_CLOSED',
    'CHATS_CLOSED_BULK',
    'SERVICE_REQUEST_COMPLETED',
    'SERVICE_REQUEST_CANCELLED'
  ];
begin
  if p_batch_size is null or p_batch_size < 1 or p_batch_size > 500 then
    raise exception 'p_batch_size must be between 1 and 500'
      using errcode = '22023';
  end if;

  if nullif(btrim(p_worker_id), '') is null then
    raise exception 'p_worker_id is required'
      using errcode = '22023';
  end if;

  perform public.cns_set_local_statement_timeout('120s');

  if coalesce(p_record_job_run, true) then
    v_job_run_id := public.job_run_begin('cns_process_domain_events', 'v1');
  end if;

  for v_event in
    with claimed as (
      select de.id
      from public.domain_events de
      where de.processed_at is null
        and de.dead_letter = false
        and (de.locked_until is null or de.locked_until < now())
        and de.event_type = any (v_cns_event_types)
      order by de.created_at
      for update skip locked
      limit p_batch_size
    )
    update public.domain_events e
    set
      locked_until = now() + interval '30 seconds',
      locked_by = p_worker_id
    from claimed c
    where e.id = c.id
    returning e.*
  loop
    begin
      v_processed := v_processed + 1;

      perform public.cns_enqueue_notifications(v_event.id);

      perform public.cns_emit_analytics(v_event.id);

      update public.domain_events
      set
        processed_at = now(),
        locked_until = null,
        locked_by = null,
        last_error = null
      where id = v_event.id;

      v_succeeded := v_succeeded + 1;
    exception
      when others then
        v_failed := v_failed + 1;
        v_new_retry_count := v_event.retry_count + 1;

        v_backoff := case v_new_retry_count
          when 1 then interval '30 seconds'
          when 2 then interval '2 minutes'
          when 3 then interval '10 minutes'
          when 4 then interval '30 minutes'
          else interval '2 hours'
        end;

        if v_new_retry_count >= v_max_retries then
          update public.domain_events
          set
            retry_count = v_new_retry_count,
            dead_letter = true,
            dead_letter_at = now(),
            locked_until = null,
            locked_by = null,
            last_error = public.sanitize_job_error(sqlerrm)
          where id = v_event.id;

          v_dead_lettered := v_dead_lettered + 1;

          raise log 'cns_domain_events_dead_letter_total event_id=% event_type=% service_request_id=% retry_count=%',
            v_event.id,
            v_event.event_type,
            v_event.service_request_id,
            v_new_retry_count;
        else
          update public.domain_events
          set
            retry_count = v_new_retry_count,
            locked_until = now() + v_backoff,
            locked_by = null,
            last_error = public.sanitize_job_error(sqlerrm)
          where id = v_event.id;
        end if;

        raise log 'cns_process_domain_events row_error event_id=% sqlstate=% message=% retry_count=%',
          v_event.id,
          sqlstate,
          sqlerrm,
          v_new_retry_count;
    end;
  end loop;

  select count(*)
  into v_backlog
  from public.domain_events de
  where de.processed_at is null
    and de.dead_letter = false
    and de.event_type = any (v_cns_event_types);

  v_duration_ms := (
    extract(epoch from (clock_timestamp() - v_started_at)) * 1000
  )::int;

  if coalesce(p_record_job_run, true) then
    perform public.job_run_finish(
      v_job_run_id,
      v_started_at,
      v_processed,
      v_succeeded,
      v_failed,
      jsonb_build_object(
        'dead_lettered_count', v_dead_lettered,
        'backlog', v_backlog
      )
    );
  end if;

  return jsonb_build_object(
    'job_run_id', v_job_run_id,
    'processed_count', v_processed,
    'succeeded_count', v_succeeded,
    'failed_count', v_failed,
    'dead_lettered_count', v_dead_lettered,
    'backlog', v_backlog,
    'duration_ms', v_duration_ms
  );
end;
$$;

comment on function public.cns_process_domain_events(int, text, boolean) is
  'Admin/replay backlog drain for historical domain_events rows. No pg_cron schedule; live notifications use triggers.';

create or replace function public.cron_enqueue_proposal_expiring_soon_reminders()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_started_at timestamptz := clock_timestamp();
  v_job_run_id bigint;
  v_result jsonb;
begin
  v_job_run_id := public.job_run_begin('proposal_expiring_soon_reminders', 'v1');
  v_result := public.enqueue_proposal_expiring_soon_reminders(100);

  perform public.job_run_finish(
    v_job_run_id,
    v_started_at,
    coalesce((v_result->>'processed_count')::int, 0),
    coalesce((v_result->>'enqueued_count')::int, 0),
    coalesce((v_result->>'error_count')::int, 0),
    jsonb_build_object(
      'skipped_count', coalesce((v_result->>'skipped_count')::int, 0)
    )
  );

  return v_result || jsonb_build_object('job_run_id', v_job_run_id);
exception
  when others then
    perform public.job_run_abort_latest('proposal_expiring_soon_reminders', sqlerrm);
    raise;
end;
$$;

comment on function public.cron_enqueue_proposal_expiring_soon_reminders() is
  'pg_cron entrypoint: SLA-4h proposal.expiring_soon reminders with job_runs telemetry.';

revoke all on function public.cron_enqueue_proposal_expiring_soon_reminders() from public;
revoke all on function public.cron_enqueue_proposal_expiring_soon_reminders() from authenticated;
revoke all on function public.cron_enqueue_proposal_expiring_soon_reminders() from anon;

grant execute on function public.cron_enqueue_proposal_expiring_soon_reminders() to postgres;

drop function if exists public.cron_cns_process_domain_events();

do $cron$
declare
  v_jobid integer;
begin
  select j.jobid
  into v_jobid
  from cron.job j
  where j.jobname = 'cns_process_domain_events';

  if v_jobid is not null then
    perform cron.unschedule(v_jobid);
  end if;
end;
$cron$;

select cron.schedule(
  'proposal_expiring_soon_reminders',
  '* * * * *',
  $$select public.cron_enqueue_proposal_expiring_soon_reminders();$$
);

-- Restore statement_timeout proconfig after CREATE OR REPLACE in prior migrations.
alter function public.cns_process_domain_events(int, text, boolean)
  set statement_timeout = '120s';

alter function public.expire_pending_proposals(int)
  set statement_timeout = '120s';

alter function public.cns_evaluate_reciprocity_batch(int)
  set statement_timeout = '120s';

-- CNS Phase 5 — task 45: domain_events batch processor (design §6.2, §8.2, §8.4, Req. 27, 28).
-- Migration order: runs AFTER tasks 7, 43, 44.

create or replace function public.cns_process_domain_events(
  p_batch_size int default 100,
  p_worker_id text default 'cns_domain_events'
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

  insert into public.job_runs (job_name, started_at)
  values ('cns_process_domain_events', v_started_at)
  returning id into v_job_run_id;

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
            last_error = left(sqlerrm, 500)
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
            last_error = left(sqlerrm, 500)
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

  update public.job_runs
  set
    finished_at = now(),
    processed_count = v_processed,
    transitioned_count = v_succeeded,
    error_count = v_failed,
    duration_ms = v_duration_ms,
    metadata = jsonb_build_object(
      'dead_lettered_count', v_dead_lettered,
      'backlog', v_backlog
    )
  where id = v_job_run_id;

  raise log 'cns_domain_events_backlog=% processed=% succeeded=% failed=% dead_lettered=%',
    v_backlog,
    v_processed,
    v_succeeded,
    v_failed,
    v_dead_lettered;

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

comment on function public.cns_process_domain_events(int, text) is
  'CNS outbox consumer: claims CNS-scoped event_type rows only (excludes SLOT_RELEASED, NEGOTIATION_TERMINATED for future matching). SKIP LOCKED checkout, notifications + best-effort analytics, processed_at or retry/dead-letter (R28-AC01, R28-AC02, R28-AC04, OAC-09).';

revoke all on function public.cns_process_domain_events(int, text) from public;
revoke all on function public.cns_process_domain_events(int, text) from authenticated;
revoke all on function public.cns_process_domain_events(int, text) from anon;

grant execute on function public.cns_process_domain_events(int, text) to service_role;

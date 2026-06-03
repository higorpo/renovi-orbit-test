-- CNS Phase 5 — task 46: proposal.expiring_soon SLA reminder scan (design §4.12, Req. 9, 12).
-- Migration order: runs AFTER tasks 42, 45, 21 (MMD templates).

create or replace function public.enqueue_proposal_expiring_soon_reminders(
  p_batch_size int default 100
)
returns jsonb
language plpgsql
security definer
set search_path = public, message_dispatcher
as $$
declare
  v_sla_hours int;
  v_processed int := 0;
  v_enqueued int := 0;
  v_skipped int := 0;
  v_error_count int := 0;
  v_proposal record;
  v_chat public.chats%rowtype;
  v_sr public.service_requests%rowtype;
  v_idempotency_key text;
  v_template_variables jsonb;
  v_result jsonb;
begin
  if p_batch_size is null or p_batch_size < 1 or p_batch_size > 500 then
    raise exception 'p_batch_size must be between 1 and 500'
      using errcode = '22023';
  end if;

  v_sla_hours := public.platform_constant_int('chats.proposal_response_sla_hours', 24);

  for v_proposal in
    select pp.*
    from public.provider_proposals pp
    inner join public.service_requests sr on sr.id = pp.service_request_id
    where pp.status = 'PENDING'::public.proposal_status
      and sr.status = 'OPEN'::public.service_request_status
      and pp.chat_id is not null
      and coalesce(pp.submitted_at, pp.created_at)
        + make_interval(hours => v_sla_hours - 4) < now()
      and coalesce(pp.submitted_at, pp.created_at)
        + make_interval(hours => v_sla_hours) > now()
    order by pp.submitted_at
    limit p_batch_size
  loop
    begin
      v_processed := v_processed + 1;
      v_idempotency_key := format('proposal:%s:expiring_soon', v_proposal.id);

      if exists (
        select 1
        from message_dispatcher.message_dispatches d
        where d.idempotency_key = public.mmd_idempotency_uuid(v_idempotency_key || ':push')
           or d.idempotency_key = public.mmd_idempotency_uuid(v_idempotency_key || ':email')
      ) then
        v_skipped := v_skipped + 1;
        continue;
      end if;

      select *
      into v_chat
      from public.chats c
      where c.id = v_proposal.chat_id;

      select *
      into v_sr
      from public.service_requests sr
      where sr.id = v_proposal.service_request_id;

      v_template_variables := jsonb_build_object(
        'chat_id', v_chat.id,
        'service_request_id', v_sr.id,
        'service_request_title', coalesce(v_sr.title, 'Service request'),
        'sender_display_name', 'Renovi',
        'message_preview', 'Proposal expiring soon',
        'deep_link_path', format('/dashboard/chats/%s', v_chat.id),
        'proposal_id', v_proposal.id
      );

      v_result := public.cns_mmd_ingest(
        'PROPOSAL_EXPIRING_SOON',
        v_chat.client_id,
        v_idempotency_key,
        v_template_variables,
        jsonb_build_object(
          'proposal_id', v_proposal.id,
          'submitted_at', v_proposal.submitted_at
        )
      );

      if coalesce((v_result->>'ingested_count')::int, 0) > 0 then
        v_enqueued := v_enqueued + 1;
        raise log 'proposal_expiring_soon_reminder_total proposal_id=% chat_id=% ingested=%',
          v_proposal.id,
          v_chat.id,
          v_result->>'ingested_count';
      else
        v_skipped := v_skipped + 1;
      end if;
    exception
      when others then
        v_error_count := v_error_count + 1;
        raise log 'enqueue_proposal_expiring_soon_reminders row_error proposal_id=% sqlstate=% message=%',
          v_proposal.id,
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

comment on function public.enqueue_proposal_expiring_soon_reminders(int) is
  'Scan PENDING proposals in SLA-4h window; enqueue proposal.expiring_soon to client via cns_mmd_ingest (R9-AC07, R12-AC03).';

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
  v_reminder_result jsonb;
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

  v_reminder_result := public.enqueue_proposal_expiring_soon_reminders(p_batch_size);

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
      'backlog', v_backlog,
      'expiring_soon_reminders', v_reminder_result
    )
  where id = v_job_run_id;

  raise log 'cns_domain_events_backlog=% processed=% succeeded=% failed=% dead_lettered=% expiring_soon_enqueued=%',
    v_backlog,
    v_processed,
    v_succeeded,
    v_failed,
    v_dead_lettered,
    coalesce(v_reminder_result->>'enqueued_count', '0');

  return jsonb_build_object(
    'job_run_id', v_job_run_id,
    'processed_count', v_processed,
    'succeeded_count', v_succeeded,
    'failed_count', v_failed,
    'dead_lettered_count', v_dead_lettered,
    'backlog', v_backlog,
    'duration_ms', v_duration_ms,
    'expiring_soon_reminders', v_reminder_result
  );
end;
$$;

revoke all on function public.enqueue_proposal_expiring_soon_reminders(int) from public;
revoke all on function public.enqueue_proposal_expiring_soon_reminders(int) from authenticated;
revoke all on function public.enqueue_proposal_expiring_soon_reminders(int) from anon;

grant execute on function public.enqueue_proposal_expiring_soon_reminders(int) to service_role;

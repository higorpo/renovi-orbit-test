-- CNS Wave C — task 64: standardize cron wrappers with job_runs helpers (design §3.15).
-- Migration order: runs AFTER 20260701106100_create_job_run_helpers.sql.

drop function if exists public.cns_process_domain_events(int, text);

create or replace function public.cns_evaluate_reciprocity_batch(
  p_batch_size int default 500
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_started_at timestamptz := clock_timestamp();
  v_job_run_id bigint;
  v_window_hours int;
  v_processed int := 0;
  v_transitioned int := 0;
  v_error_count int := 0;
  v_chat record;
  v_active_count int;
  v_duration_ms int;
begin
  if p_batch_size is null or p_batch_size < 1 or p_batch_size > 500 then
    raise exception 'p_batch_size must be between 1 and 500'
      using errcode = '22023';
  end if;

  v_job_run_id := public.job_run_begin('chat_evaluate_reciprocity', 'v1');

  v_window_hours := public.platform_constant_int('chats.reciprocity_window_hours', 24);

  for v_chat in
    select c.*
    from public.chats c
    inner join public.service_requests sr on sr.id = c.service_request_id
    where c.status = 'ACTIVE'::public.cns_conversation_status
      and c.last_interaction_at < now() - (v_window_hours || ' hours')::interval
      and sr.status = 'OPEN'::public.service_request_status
    order by c.last_interaction_at
    for update of c skip locked
    limit p_batch_size
  loop
    begin
      v_processed := v_processed + 1;

      if public.cns_has_bilateral_reciprocity(v_chat.id, v_window_hours) then
        continue;
      end if;

      update public.chats
      set
        status = 'INACTIVE'::public.cns_conversation_status,
        inactivated_at = now(),
        inactivation_reason = 'NO_RECIPROCITY'::public.cns_inactivation_reason,
        updated_at = now()
      where id = v_chat.id
        and status = 'ACTIVE'::public.cns_conversation_status;

      if not found then
        continue;
      end if;

      insert into public.service_request_negotiation_stats (service_request_id)
      values (v_chat.service_request_id)
      on conflict (service_request_id) do nothing;

      update public.service_request_negotiation_stats
      set
        active_chat_count = greatest(active_chat_count - 1, 0),
        version = version + 1
      where service_request_id = v_chat.service_request_id
      returning active_chat_count into v_active_count;

      perform public.record_domain_event(
        'CONVERSATION_INACTIVATED',
        'chat',
        v_chat.id,
        v_chat.service_request_id,
        v_chat.id,
        jsonb_build_object(
          'chat_id', v_chat.id,
          'inactivation_reason', 'NO_RECIPROCITY',
          'service_request_id', v_chat.service_request_id
        )
      );

      perform public.record_domain_event(
        'SLOT_RELEASED',
        'chat',
        v_chat.id,
        v_chat.service_request_id,
        v_chat.id,
        jsonb_build_object(
          'active_chat_count', coalesce(v_active_count, 0),
          'service_request_id', v_chat.service_request_id
        )
      );

      v_transitioned := v_transitioned + 1;

      raise log 'cns_reciprocity_transitions_total chat_id=% service_request_id=%',
        v_chat.id,
        v_chat.service_request_id;
    exception
      when others then
        v_error_count := v_error_count + 1;
        raise log 'cns_evaluate_reciprocity_batch row_error chat_id=% sqlstate=% message=%',
          v_chat.id,
          sqlstate,
          sqlerrm;
    end;
  end loop;

  v_duration_ms := (
    extract(epoch from (clock_timestamp() - v_started_at)) * 1000
  )::int;

  perform public.job_run_finish(
    v_job_run_id,
    v_started_at,
    v_processed,
    v_transitioned,
    v_error_count
  );

  return jsonb_build_object(
    'job_run_id', v_job_run_id,
    'processed_count', v_processed,
    'transitioned_count', v_transitioned,
    'error_count', v_error_count,
    'duration_ms', v_duration_ms
  );
end;
$$;

create or replace function public.expire_pending_proposals(
  p_batch_size int default 500
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_started_at timestamptz := clock_timestamp();
  v_job_run_id bigint;
  v_sla_hours int;
  v_window_hours int;
  v_processed int := 0;
  v_expired_count int := 0;
  v_inactivated_count int := 0;
  v_error_count int := 0;
  v_max_lag_seconds numeric := 0;
  v_row_lag_seconds numeric;
  v_proposal record;
  v_chat public.chats%rowtype;
  v_active_count int;
  v_duration_ms int;
  v_has_recent_activity boolean;
begin
  if p_batch_size is null or p_batch_size < 1 or p_batch_size > 500 then
    raise exception 'p_batch_size must be between 1 and 500'
      using errcode = '22023';
  end if;

  v_job_run_id := public.job_run_begin('proposal_expire_pending', 'v1');

  v_sla_hours := public.platform_constant_int('chats.proposal_response_sla_hours', 24);
  v_window_hours := public.platform_constant_int('chats.reciprocity_window_hours', 24);

  for v_proposal in
    select pp.*
    from public.provider_proposals pp
    inner join public.service_requests sr on sr.id = pp.service_request_id
    where pp.status = 'PENDING'::public.proposal_status
      and coalesce(pp.submitted_at, pp.created_at)
        + make_interval(hours => v_sla_hours) < now()
      and sr.status = 'OPEN'::public.service_request_status
    order by pp.submitted_at
    for update of pp skip locked
    limit p_batch_size
  loop
    begin
      v_processed := v_processed + 1;

      v_row_lag_seconds := extract(
        epoch from (
          now() - (
            coalesce(v_proposal.submitted_at, v_proposal.created_at)
            + make_interval(hours => v_sla_hours)
          )
        )
      );

      if v_row_lag_seconds > v_max_lag_seconds then
        v_max_lag_seconds := v_row_lag_seconds;
      end if;

      update public.provider_proposals
      set
        status = 'EXPIRED'::public.proposal_status,
        expired_at = now(),
        updated_at = now()
      where id = v_proposal.id
        and status = 'PENDING'::public.proposal_status
      returning * into v_proposal;

      if not found then
        continue;
      end if;

      perform public.record_domain_event(
        'PROPOSAL_EXPIRED',
        'proposal',
        v_proposal.id,
        v_proposal.service_request_id,
        v_proposal.chat_id,
        jsonb_build_object(
          'idempotency_key',
          format('proposal:%s:expired', v_proposal.id),
          'proposal_id', v_proposal.id,
          'chat_id', v_proposal.chat_id,
          'expired_at', v_proposal.expired_at
        )
      );

      v_expired_count := v_expired_count + 1;

      if v_proposal.chat_id is null then
        continue;
      end if;

      select *
      into v_chat
      from public.chats c
      where c.id = v_proposal.chat_id;

      if v_chat.status = 'CLOSED'::public.cns_conversation_status then
        continue;
      end if;

      select exists (
        select 1
        from public.chat_messages m
        where m.chat_id = v_chat.id
          and m.message_type in (
            'TEXT'::public.cns_message_type,
            'IMAGE'::public.cns_message_type,
            'PROPOSAL'::public.cns_message_type
          )
          and m.created_at >= now() - (v_window_hours || ' hours')::interval
      )
      into v_has_recent_activity;

      if v_has_recent_activity
        or v_chat.status <> 'ACTIVE'::public.cns_conversation_status then
        continue;
      end if;

      update public.chats
      set
        status = 'INACTIVE'::public.cns_conversation_status,
        inactivated_at = now(),
        inactivation_reason = 'NO_RECIPROCITY'::public.cns_inactivation_reason,
        updated_at = now()
      where id = v_chat.id
        and status = 'ACTIVE'::public.cns_conversation_status;

      if not found then
        continue;
      end if;

      insert into public.service_request_negotiation_stats (service_request_id)
      values (v_chat.service_request_id)
      on conflict (service_request_id) do nothing;

      update public.service_request_negotiation_stats
      set
        active_chat_count = greatest(active_chat_count - 1, 0),
        version = version + 1
      where service_request_id = v_chat.service_request_id
      returning active_chat_count into v_active_count;

      perform public.record_domain_event(
        'CONVERSATION_INACTIVATED',
        'chat',
        v_chat.id,
        v_chat.service_request_id,
        v_chat.id,
        jsonb_build_object(
          'chat_id', v_chat.id,
          'inactivation_reason', 'NO_RECIPROCITY',
          'service_request_id', v_chat.service_request_id,
          'trigger', 'proposal_expiry'
        )
      );

      perform public.record_domain_event(
        'SLOT_RELEASED',
        'chat',
        v_chat.id,
        v_chat.service_request_id,
        v_chat.id,
        jsonb_build_object(
          'active_chat_count', coalesce(v_active_count, 0),
          'service_request_id', v_chat.service_request_id,
          'trigger', 'proposal_expiry'
        )
      );

      v_inactivated_count := v_inactivated_count + 1;
    exception
      when others then
        v_error_count := v_error_count + 1;
        raise log 'expire_pending_proposals row_error proposal_id=% sqlstate=% message=%',
          v_proposal.id,
          sqlstate,
          sqlerrm;
    end;
  end loop;

  v_duration_ms := (
    extract(epoch from (clock_timestamp() - v_started_at)) * 1000
  )::int;

  perform public.job_run_finish(
    v_job_run_id,
    v_started_at,
    v_processed,
    v_expired_count,
    v_error_count,
    jsonb_build_object(
      'inactivated_count', v_inactivated_count,
      'max_lag_seconds', v_max_lag_seconds
    )
  );

  raise log 'cns_proposal_expiry_lag_seconds=% processed=% expired=% inactivated=%',
    v_max_lag_seconds,
    v_processed,
    v_expired_count,
    v_inactivated_count;

  return jsonb_build_object(
    'job_run_id', v_job_run_id,
    'processed_count', v_processed,
    'expired_count', v_expired_count,
    'inactivated_count', v_inactivated_count,
    'error_count', v_error_count,
    'duration_ms', v_duration_ms,
    'max_lag_seconds', v_max_lag_seconds
  );
end;
$$;

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

  if coalesce(p_record_job_run, true) then
    v_job_run_id := public.job_run_begin('cns_process_domain_events', 'v1');
  end if;

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
            last_error = public.sanitize_job_error(sqlerrm)
          where id = v_event.id;

          v_dead_lettered := v_dead_lettered + 1;
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
        'backlog', v_backlog,
        'expiring_soon_reminders', v_reminder_result
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
    'duration_ms', v_duration_ms,
    'expiring_soon_reminders', v_reminder_result
  );
end;
$$;

revoke all on function public.cns_process_domain_events(int, text, boolean) from public;
revoke all on function public.cns_process_domain_events(int, text, boolean) from authenticated;
revoke all on function public.cns_process_domain_events(int, text, boolean) from anon;
grant execute on function public.cns_process_domain_events(int, text, boolean) to service_role;

create or replace function public.cron_chat_evaluate_reciprocity()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
  return public.cns_evaluate_reciprocity_batch(500);
exception
  when others then
    perform public.job_run_abort_latest('chat_evaluate_reciprocity', sqlerrm);
    raise;
end;
$$;

create or replace function public.cron_proposal_expire_pending()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
  return public.expire_pending_proposals(500);
exception
  when others then
    perform public.job_run_abort_latest('proposal_expire_pending', sqlerrm);
    raise;
end;
$$;

create or replace function public.cron_cns_process_domain_events()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_started_at timestamptz := clock_timestamp();
  v_job_run_id bigint;
  v_leases_released int;
  v_result jsonb;
begin
  v_job_run_id := public.job_run_begin('cns_process_domain_events', 'v1');
  v_leases_released := public.domain_events_release_stale_leases();
  v_result := public.cns_process_domain_events(100, 'cns_domain_events', false);

  perform public.job_run_finish(
    v_job_run_id,
    v_started_at,
    coalesce((v_result->>'processed_count')::int, 0),
    coalesce((v_result->>'succeeded_count')::int, 0),
    coalesce((v_result->>'failed_count')::int, 0),
    jsonb_build_object(
      'dead_lettered_count', coalesce((v_result->>'dead_lettered_count')::int, 0),
      'backlog', coalesce((v_result->>'backlog')::bigint, 0),
      'leases_released', v_leases_released,
      'expiring_soon_reminders', v_result->'expiring_soon_reminders'
    )
  );

  return v_result || jsonb_build_object(
    'job_run_id', v_job_run_id,
    'leases_released', v_leases_released
  );
exception
  when others then
    perform public.job_run_abort_latest('cns_process_domain_events', sqlerrm);
    raise;
end;
$$;

create or replace function public.cron_cns_janitor_orphan_media()
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
  v_job_run_id := public.job_run_begin('cns_janitor_orphan_media', 'v1');
  v_result := public.cns_janitor_orphan_media(500);

  perform public.job_run_finish(
    v_job_run_id,
    v_started_at,
    coalesce((v_result->>'processed_count')::int, 0),
    coalesce((v_result->>'expired_count')::int, 0),
    coalesce((v_result->>'delete_failures')::int, 0),
    jsonb_build_object(
      'bytes_deleted', coalesce((v_result->>'bytes_deleted')::bigint, 0),
      'objects_deleted', coalesce((v_result->>'objects_deleted')::int, 0)
    )
  );

  return v_result || jsonb_build_object('job_run_id', v_job_run_id);
exception
  when others then
    perform public.job_run_abort_latest('cns_janitor_orphan_media', sqlerrm);
    raise;
end;
$$;

create or replace function public.cron_cns_reconcile_pending_deliveries()
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
  v_job_run_id := public.job_run_begin('cns_reconcile_pending_deliveries', 'v1');
  v_result := public.cns_reconcile_pending_deliveries(200);

  perform public.job_run_finish(
    v_job_run_id,
    v_started_at,
    coalesce((v_result->>'processed_count')::int, 0),
    coalesce((v_result->>'reconciled_count')::int, 0),
    0,
    jsonb_build_object(
      'reconciled_count', coalesce((v_result->>'reconciled_count')::int, 0)
    )
  );

  return v_result || jsonb_build_object('job_run_id', v_job_run_id);
exception
  when others then
    perform public.job_run_abort_latest('cns_reconcile_pending_deliveries', sqlerrm);
    raise;
end;
$$;

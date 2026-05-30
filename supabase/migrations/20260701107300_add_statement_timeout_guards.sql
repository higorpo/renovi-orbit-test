-- CNS Phase 12 — task 82: SET LOCAL statement_timeout on accept + batch RPCs (Req. 22, 27, R27-AC03).
-- Accept: 5s (client idempotency replay). Batch cron RPCs: 120s.

create or replace function public.cns_set_local_statement_timeout(p_interval text)
returns void
language plpgsql
volatile
set search_path = public
as $$
begin
  perform set_config('statement_timeout', p_interval, true);
end;
$$;

comment on function public.cns_set_local_statement_timeout(text) is
  'Transaction-local statement_timeout (SET LOCAL equivalent for SECURITY DEFINER RPCs, task 82).';

create or replace function public.accept_proposal(
  p_proposal_id uuid,
  p_selected_slot jsonb,
  p_idempotency_key uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_actor uuid := auth.uid();
  v_proposal public.provider_proposals%rowtype;
  v_sr public.service_requests%rowtype;
  v_service public.services%rowtype;
  v_cached jsonb;
  v_request_hash text;
  v_sla_hours int;
  v_chat_ids jsonb;
  v_response jsonb;
begin
  if v_actor is null then
    raise exception 'Authentication required for accept_proposal'
      using errcode = '42501';
  end if;

  if p_proposal_id is null then
    raise exception 'p_proposal_id is required'
      using errcode = '22023';
  end if;

  if p_idempotency_key is null then
    raise exception 'p_idempotency_key is required'
      using errcode = '22023';
  end if;

  if p_selected_slot is null or jsonb_typeof(p_selected_slot) <> 'object' then
    raise exception 'p_selected_slot must be a JSON object'
      using errcode = '22023';
  end if;

  perform public.cns_set_local_statement_timeout('5s');

  v_request_hash := md5(
    concat_ws(
      '|',
      p_proposal_id::text,
      p_selected_slot::text
    )
  );

  v_cached := public.idempotency_begin(
    'chats.accept_proposal',
    p_idempotency_key,
    v_request_hash
  );

  if v_cached is not null then
    return v_cached->'response_body';
  end if;

  select *
  into v_proposal
  from public.provider_proposals pp
  where pp.id = p_proposal_id
  for update;

  if not found then
    raise exception 'Proposal not found: %', p_proposal_id
      using errcode = '22023';
  end if;

  select *
  into v_sr
  from public.service_requests sr
  where sr.id = v_proposal.service_request_id
  for update;

  if v_sr.status = 'COMPLETED'::public.service_request_status then
    raise exception 'SR_ALREADY_COMPLETED'
      using
        errcode = 'P0001',
        detail = jsonb_build_object('code', 'SR_ALREADY_COMPLETED')::text;
  end if;

  if v_sr.status <> 'OPEN'::public.service_request_status then
    raise exception 'SR_NOT_OPEN'
      using
        errcode = 'P0001',
        detail = jsonb_build_object('code', 'SR_NOT_OPEN')::text;
  end if;

  if v_actor <> v_sr.client_id then
    raise exception 'Only the service request client may accept a proposal'
      using errcode = '42501';
  end if;

  perform 1
  from public.provider_proposals pp
  where pp.service_request_id = v_sr.id
  for update;

  if v_proposal.status <> 'PENDING'::public.proposal_status then
    raise exception 'PROPOSAL_NOT_ACCEPTABLE'
      using
        errcode = 'P0001',
        detail = jsonb_build_object(
          'code', 'PROPOSAL_NOT_ACCEPTABLE',
          'status', v_proposal.status
        )::text;
  end if;

  v_sla_hours := public.platform_constant_int('chats.proposal_response_sla_hours', 24);

  if coalesce(v_proposal.submitted_at, v_proposal.created_at)
    + make_interval(hours => v_sla_hours) < now() then
    raise exception 'PROPOSAL_EXPIRED'
      using
        errcode = 'P0001',
        detail = jsonb_build_object('code', 'PROPOSAL_EXPIRED')::text;
  end if;

  if not exists (
    select 1
    from jsonb_array_elements(v_proposal.proposal_suggested_slots) elem
    where elem->>'start_date' = p_selected_slot->>'start_date'
      and elem->>'shift' = p_selected_slot->>'shift'
      and coalesce(elem->>'end_date', '') = coalesce(p_selected_slot->>'end_date', '')
  ) then
    raise exception 'selected_slot must match one of proposal_suggested_slots'
      using errcode = '22023';
  end if;

  update public.provider_proposals
  set
    status = 'ACCEPTED'::public.proposal_status,
    selected_slot = p_selected_slot
  where id = p_proposal_id
  returning * into v_proposal;

  update public.service_requests
  set
    status = 'COMPLETED'::public.service_request_status,
    completed_at = now()
  where id = v_sr.id
  returning * into v_sr;

  update public.provider_proposals
  set
    status = 'REJECTED_AUTOMATICALLY'::public.proposal_status,
    client_rejection_response = coalesce(
      client_rejection_response,
      'Proposta recusada automaticamente: outra proposta foi aceita neste pedido.'
    )
  where service_request_id = v_sr.id
    and id <> p_proposal_id
    and status = 'PENDING'::public.proposal_status;

  with closed as (
    update public.chats c
    set
      status = 'CLOSED'::public.cns_conversation_status,
      closure_type = 'PROPOSAL_ACCEPTED_ELSEWHERE'::public.cns_closure_type,
      closed_at = now(),
      closed_by_user_id = v_actor,
      updated_at = now()
    where c.service_request_id = v_sr.id
      and c.status <> 'CLOSED'::public.cns_conversation_status
    returning c.id
  )
  select coalesce(jsonb_agg(to_jsonb(closed.id)), '[]'::jsonb)
  into v_chat_ids
  from closed;

  update public.service_request_negotiation_stats
  set
    active_chat_count = 0,
    version = version + 1
  where service_request_id = v_sr.id;

  insert into public.services (
    service_request_id,
    accepted_proposal_id,
    client_id,
    provider_id,
    duration_unit,
    duration_value,
    scheduled_start_date,
    scheduled_end_date,
    scheduled_shift,
    agreed_slot,
    status
  )
  values (
    v_sr.id,
    v_proposal.id,
    v_sr.client_id,
    v_proposal.provider_id,
    v_proposal.proposal_duration_unit,
    v_proposal.proposal_duration_value,
    (p_selected_slot->>'start_date')::date,
    nullif(p_selected_slot->>'end_date', '')::date,
    p_selected_slot->>'shift',
    p_selected_slot,
    'PENDING_PAYMENT'::public.contracted_service_status
  )
  returning * into v_service;

  update public.service_requests
  set contracted_service_id = v_service.id
  where id = v_sr.id;

  perform public.record_domain_event(
    'PROPOSAL_ACCEPTED',
    'proposal',
    v_proposal.id,
    v_sr.id,
    v_proposal.chat_id,
    jsonb_build_object(
      'idempotency_key',
      format('proposal:%s:accepted', v_proposal.id),
      'proposal_id', v_proposal.id,
      'service_id', v_service.id,
      'selected_slot', p_selected_slot
    )
  );

  perform public.record_domain_event(
    'SERVICE_REQUEST_COMPLETED',
    'service_request',
    v_sr.id,
    v_sr.id,
    null,
    jsonb_build_object(
      'idempotency_key',
      format('service_request:%s:completed', v_sr.id),
      'service_request_id', v_sr.id,
      'contracted_service_id', v_service.id
    )
  );

  perform public.record_domain_event(
    'CHATS_CLOSED_BULK',
    'service_request',
    v_sr.id,
    v_sr.id,
    null,
    jsonb_build_object(
      'idempotency_key',
      format('service_request:%s:chats_closed_bulk', v_sr.id),
      'service_request_id', v_sr.id,
      'chat_ids', v_chat_ids,
      'closed_count', jsonb_array_length(v_chat_ids)
    )
  );

  v_response := jsonb_build_object(
    'service', jsonb_build_object(
      'id', v_service.id,
      'service_request_id', v_service.service_request_id,
      'accepted_proposal_id', v_service.accepted_proposal_id,
      'status', v_service.status,
      'scheduled_start_date', v_service.scheduled_start_date,
      'scheduled_shift', v_service.scheduled_shift,
      'agreed_slot', v_service.agreed_slot
    ),
    'proposal', jsonb_build_object(
      'id', v_proposal.id,
      'status', v_proposal.status,
      'selected_slot', v_proposal.selected_slot,
      'provider_id', v_proposal.provider_id,
      'chat_id', v_proposal.chat_id
    )
  );

  perform public.idempotency_commit(
    'chats.accept_proposal',
    p_idempotency_key,
    v_request_hash,
    200,
    v_response
  );

  raise log 'accept_proposal_total proposal_id=% service_id=% service_request_id=%',
    v_proposal.id,
    v_service.id,
    v_sr.id;

  return v_response;
exception
  when query_canceled then
    raise exception 'STATEMENT_TIMEOUT'
      using
        errcode = 'P0001',
        detail = jsonb_build_object(
          'code', 'STATEMENT_TIMEOUT',
          'operation', 'chats.accept_proposal',
          'retry', true,
          'hint', 'Retry with the same idempotency_key after timeout'
        )::text;
end;
$$;

comment on function public.accept_proposal(uuid, jsonb, uuid) is
  'Atomic accept cascade with 5s statement_timeout; idempotent replay on timeout (task 82, R27-AC03).';

-- Batch cron RPCs: 120s statement_timeout (re-applied after helper; migration 06200 runs earlier).

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

  perform public.cns_set_local_statement_timeout('120s');

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

  perform public.cns_set_local_statement_timeout('120s');

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

  perform public.cns_set_local_statement_timeout('120s');

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

-- Additional batch maintenance RPCs: 120s statement_timeout.

create or replace function public.cns_janitor_orphan_media(
  p_batch_size int default 500
)
returns jsonb
language plpgsql
security definer
set search_path = public, storage
as $$
declare
  v_started_at timestamptz := clock_timestamp();
  v_session record;
  v_processed int := 0;
  v_expired_count int := 0;
  v_bytes_deleted bigint := 0;
  v_objects_deleted int := 0;
  v_delete_failures int := 0;
  v_path_prefix text;
  v_session_bytes bigint;
  v_session_objects int;
  v_duration_ms int;
begin
  if p_batch_size is null or p_batch_size < 1 or p_batch_size > 500 then
    raise exception 'p_batch_size must be between 1 and 500'
      using errcode = '22023';
  end if;

  perform public.cns_set_local_statement_timeout('120s');

  for v_session in
    select s.*
    from public.chat_media_upload_sessions s
    where s.status = 'pending'
      and s.expires_at < now() - interval '24 hours'
    order by s.expires_at
    for update of s skip locked
    limit p_batch_size
  loop
    v_processed := v_processed + 1;
    v_path_prefix := v_session.chat_id::text || '/' || v_session.id::text || '/';

    begin
      with deleted as (
        delete from storage.objects o
        where o.bucket_id = 'chat-media'
          and o.name like v_path_prefix || '%'
        returning coalesce((o.metadata ->> 'size')::bigint, 0) as object_size
      )
      select
        coalesce(sum(object_size), 0),
        count(*)
      into v_session_bytes, v_session_objects
      from deleted;

      update public.chat_media_upload_sessions
      set status = 'expired'
      where id = v_session.id
        and status = 'pending';

      v_bytes_deleted := v_bytes_deleted + v_session_bytes;
      v_objects_deleted := v_objects_deleted + v_session_objects;
      v_expired_count := v_expired_count + 1;
    exception
      when others then
        v_delete_failures := v_delete_failures + 1;
        raise log 'cns_janitor_orphan_media delete_failed session_id=% chat_id=% sqlstate=% message=%',
          v_session.id,
          v_session.chat_id,
          sqlstate,
          sqlerrm;
    end;
  end loop;

  v_duration_ms := (
    extract(epoch from (clock_timestamp() - v_started_at)) * 1000
  )::int;

  if v_expired_count > 0 or v_delete_failures > 0 then
    raise log 'cns_orphan_media_bytes_deleted=% sessions_expired=% objects_deleted=% delete_failures=%',
      v_bytes_deleted,
      v_expired_count,
      v_objects_deleted,
      v_delete_failures;
  end if;

  return jsonb_build_object(
    'processed_count', v_processed,
    'expired_count', v_expired_count,
    'bytes_deleted', v_bytes_deleted,
    'objects_deleted', v_objects_deleted,
    'delete_failures', v_delete_failures,
    'duration_ms', v_duration_ms
  );
end;
$$;

create or replace function public.cns_reconcile_pending_deliveries(
  p_batch_size int default 200
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_started_at timestamptz := clock_timestamp();
  v_processed int := 0;
  v_reconciled int := 0;
  v_duration_ms int;
begin
  if p_batch_size is null or p_batch_size < 1 or p_batch_size > 500 then
    raise exception 'p_batch_size must be between 1 and 500'
      using errcode = '22023';
  end if;

  perform public.cns_set_local_statement_timeout('120s');

  with candidates as (
    select m.id
    from public.chat_messages m
    where m.delivery_status = 'PENDING'::public.cns_delivery_status
      and m.created_at < now() - interval '5 minutes'
    order by m.created_at
    for update of m skip locked
    limit p_batch_size
  )
  update public.chat_messages m
  set
    delivery_status = 'FAILED'::public.cns_delivery_status,
    updated_at = now()
  from candidates c
  where m.id = c.id
    and m.delivery_status = 'PENDING'::public.cns_delivery_status;

  get diagnostics v_reconciled = row_count;
  v_processed := v_reconciled;

  v_duration_ms := (
    extract(epoch from (clock_timestamp() - v_started_at)) * 1000
  )::int;

  if v_reconciled > 0 then
    raise log 'cns_delivery_reconcile_total reconciled=% processed=%',
      v_reconciled,
      v_processed;
  end if;

  return jsonb_build_object(
    'processed_count', v_processed,
    'reconciled_count', v_reconciled,
    'duration_ms', v_duration_ms
  );
end;
$$;

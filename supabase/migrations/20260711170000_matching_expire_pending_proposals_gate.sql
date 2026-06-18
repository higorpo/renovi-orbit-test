-- Matching M14e — expire_pending_proposals inline gate eval (design §15.7).

-- expire_pending_proposals (from 20260701110200_proposal_update_dependent_rpcs.sql)
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
  v_chat_id uuid;
  v_active_count int;
  v_duration_ms int;
  v_has_recent_activity boolean;
  v_gate_sr_ids uuid[] := '{}';
  v_gate_sr_id uuid;
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

      v_chat_id := public.resolve_proposal_chat_id(
        v_proposal.service_request_id,
        v_proposal.provider_id
      );
      v_expired_count := v_expired_count + 1;

      if not v_proposal.service_request_id = any(v_gate_sr_ids) then
        v_gate_sr_ids := array_append(v_gate_sr_ids, v_proposal.service_request_id);
      end if;

      if v_chat_id is null then
        continue;
      end if;

      select *
      into v_chat
      from public.chats c
      where c.id = v_chat_id;

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

  foreach v_gate_sr_id in array v_gate_sr_ids loop
    perform public.evaluate_service_request_dispatch_gates(v_gate_sr_id);
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
      'max_lag_seconds', v_max_lag_seconds,
      'gate_evaluated_sr_count', coalesce(array_length(v_gate_sr_ids, 1), 0)
    )
  );

  raise log 'cns_proposal_expiry_lag_seconds=% processed=% expired=% inactivated=% gate_sr_count=%',
    v_max_lag_seconds,
    v_processed,
    v_expired_count,
    v_inactivated_count,
    coalesce(array_length(v_gate_sr_ids, 1), 0);

  return jsonb_build_object(
    'job_run_id', v_job_run_id,
    'processed_count', v_processed,
    'expired_count', v_expired_count,
    'inactivated_count', v_inactivated_count,
    'error_count', v_error_count,
    'duration_ms', v_duration_ms,
    'max_lag_seconds', v_max_lag_seconds,
    'gate_evaluated_sr_count', coalesce(array_length(v_gate_sr_ids, 1), 0)
  );
end;
$$;


comment on function public.expire_pending_proposals(int) is
  'Expires stale PENDING proposals; re-evaluates dispatch gates once per affected SR (matching M14e).';

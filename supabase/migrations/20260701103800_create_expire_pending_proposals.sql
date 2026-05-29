-- CNS Phase 4 — task 39: proposal SLA expiry cron batch RPC (design §4.7, Req. 9, 25).
-- Migration order: runs AFTER tasks 10, 14, 28.

create index if not exists provider_proposals_pending_sla_idx
  on public.provider_proposals (status, submitted_at)
  where status = 'PENDING'::public.proposal_status;

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

  insert into public.job_runs (job_name, started_at)
  values ('proposal_expire_pending', v_started_at)
  returning id into v_job_run_id;

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

  update public.job_runs
  set
    finished_at = now(),
    processed_count = v_processed,
    transitioned_count = v_expired_count,
    error_count = v_error_count,
    duration_ms = v_duration_ms,
    metadata = jsonb_build_object(
      'inactivated_count', v_inactivated_count,
      'max_lag_seconds', v_max_lag_seconds
    )
  where id = v_job_run_id;

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

comment on function public.expire_pending_proposals(int) is
  'Cron batch: PENDING proposals past SLA → EXPIRED; optional INACTIVE when no reciprocity-window activity; PROPOSAL_EXPIRED outbox (R9-AC01, R9-AC03–05, R25-AC02).';

revoke all on function public.expire_pending_proposals(int) from public;
revoke all on function public.expire_pending_proposals(int) from authenticated;
revoke all on function public.expire_pending_proposals(int) from anon;

grant execute on function public.expire_pending_proposals(int) to service_role;

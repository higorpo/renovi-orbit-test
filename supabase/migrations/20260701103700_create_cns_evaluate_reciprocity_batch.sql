-- CNS Phase 4 — task 38: reciprocity cron batch RPC (design §4.6, Req. 4, 25).
-- Migration order: runs AFTER tasks 25, 27, 3, 12, 23.

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

  insert into public.job_runs (job_name, started_at)
  values ('chat_evaluate_reciprocity', v_started_at)
  returning id into v_job_run_id;

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

  update public.job_runs
  set
    finished_at = now(),
    processed_count = v_processed,
    transitioned_count = v_transitioned,
    error_count = v_error_count,
    duration_ms = v_duration_ms
  where id = v_job_run_id;

  return jsonb_build_object(
    'job_run_id', v_job_run_id,
    'processed_count', v_processed,
    'transitioned_count', v_transitioned,
    'error_count', v_error_count,
    'duration_ms', v_duration_ms
  );
end;
$$;

comment on function public.cns_evaluate_reciprocity_batch(int) is
  'Cron batch: ACTIVE chats past reciprocity window without bilateral exchange → INACTIVE, slot -1, outbox events (R4-AC02–04, R25-AC01, R25-AC04, R25-AC07, R14-AC04).';

revoke all on function public.cns_evaluate_reciprocity_batch(int) from public;
revoke all on function public.cns_evaluate_reciprocity_batch(int) from authenticated;
revoke all on function public.cns_evaluate_reciprocity_batch(int) from anon;

grant execute on function public.cns_evaluate_reciprocity_batch(int) to service_role;

-- Payment Task 49: payment_reset_dead_letter_event RPC (design.md §8.3, Req 19).

create or replace function public.payment_reset_dead_letter_event(
  p_event_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_event public.payment_webhook_events%rowtype;
  v_rows int;
  v_reference uuid;
  v_schedule_id uuid;
  v_service_id uuid;
  v_has_queue boolean;
begin
  if coalesce(auth.role(), '') <> 'service_role' then
    raise exception 'service_role required for payment_reset_dead_letter_event'
      using errcode = '42501';
  end if;

  if p_event_id is null then
    raise exception 'p_event_id is required'
      using errcode = '22023';
  end if;

  update public.payment_webhook_events e
  set
    state = 'RECEIVED'::public.payment_webhook_event_state,
    retry_count = 0,
    next_retry_at = now(),
    failure_reason = null,
    processed_at = null,
    updated_at = now()
  where e.id = p_event_id
    and e.state = 'DEAD_LETTER'::public.payment_webhook_event_state;

  get diagnostics v_rows = row_count;

  if v_rows = 0 then
    raise exception 'EVENT_NOT_FOUND_OR_NOT_DEAD_LETTER'
      using errcode = 'P0001';
  end if;

  select e.*
  into v_event
  from public.payment_webhook_events e
  where e.id = p_event_id;

  update public.payment_webhook_processing_queue q
  set
    state = 'PENDING'::public.payment_webhook_queue_state,
    attempt_count = 0,
    scheduled_at = now(),
    attempted_at = null,
    failure_reason = null
  where q.webhook_event_id = p_event_id;

  select exists (
    select 1
    from public.payment_webhook_processing_queue q
    where q.webhook_event_id = p_event_id
  )
  into v_has_queue;

  if not v_has_queue then
    perform public.payment_enqueue_webhook_processing(p_event_id, now());
  end if;

  v_reference := public.payment_webhook_payload_reference_code(v_event.raw_payload);

  if v_reference is not null then
    select ps.id, ps.contracted_service_id
    into v_schedule_id, v_service_id
    from public.payment_schedules ps
    where ps.contracted_service_id = v_reference
       or ps.idempotency_key = v_reference::text
    limit 1;

    if v_schedule_id is not null then
      perform public.payment_write_audit(
        p_event_type := 'WEBHOOK_DEAD_LETTER_RESET',
        p_entity_type := 'payment_schedule',
        p_entity_id := v_schedule_id,
        p_service_id := v_service_id,
        p_schedule_id := v_schedule_id,
        p_from_state := 'DEAD_LETTER',
        p_to_state := 'RECEIVED',
        p_actor := 'support'::public.payment_audit_actor,
        p_metadata := jsonb_build_object(
          'webhook_event_id', v_event.id,
          'event_type', v_event.event_type,
          'gateway_event_id', v_event.gateway_event_id,
          'gateway_slug', v_event.gateway_slug
        )
      );
    end if;
  end if;

  return jsonb_build_object(
    'event_id', v_event.id,
    'event_type', v_event.event_type,
    'gateway_event_id', v_event.gateway_event_id,
    'state', v_event.state,
    'retry_count', v_event.retry_count,
    'next_retry_at', v_event.next_retry_at
  );
end;
$$;

comment on function public.payment_reset_dead_letter_event(uuid) is
  'Operator tool: re-queue a DEAD_LETTER webhook for processing (service_role only).';

revoke all on function public.payment_reset_dead_letter_event(uuid) from public;
revoke all on function public.payment_reset_dead_letter_event(uuid) from anon;
revoke all on function public.payment_reset_dead_letter_event(uuid) from authenticated;

grant execute on function public.payment_reset_dead_letter_event(uuid) to service_role;

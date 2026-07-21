-- Payment Task 34: payment_enqueue_webhook_processing RPC (design.md §3.8, §4.7.1, Req 16 AC5).

create or replace function public.payment_enqueue_webhook_processing(
  p_webhook_event_id uuid,
  p_scheduled_at timestamptz default now()
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_event public.payment_webhook_events%rowtype;
  v_queue_id uuid;
  v_queue_state public.payment_webhook_queue_state;
  v_status text;
begin
  if coalesce(auth.role(), '') <> 'service_role' then
    raise exception 'service_role required for payment_enqueue_webhook_processing'
      using errcode = '42501';
  end if;

  if p_webhook_event_id is null then
    raise exception 'p_webhook_event_id is required'
      using errcode = '22023';
  end if;

  select e.*
  into v_event
  from public.payment_webhook_events e
  where e.id = p_webhook_event_id
  for update;

  if not found then
    raise exception 'WEBHOOK_EVENT_NOT_FOUND'
      using errcode = 'P0002';
  end if;

  if v_event.is_duplicate then
    raise exception 'WEBHOOK_EVENT_DUPLICATE'
      using errcode = 'P0001';
  end if;

  if not v_event.signature_validated then
    raise exception 'WEBHOOK_SIGNATURE_NOT_VALIDATED'
      using errcode = 'P0001';
  end if;

  if v_event.state in (
    'PROCESSED'::public.payment_webhook_event_state,
    'DUPLICATE'::public.payment_webhook_event_state,
    'DEAD_LETTER'::public.payment_webhook_event_state
  ) then
    raise exception 'WEBHOOK_EVENT_TERMINAL'
      using errcode = 'P0001';
  end if;

  insert into public.payment_webhook_processing_queue (
    webhook_event_id,
    gateway_slug,
    event_type,
    scheduled_at,
    state
  )
  values (
    v_event.id,
    v_event.gateway_slug,
    v_event.event_type,
    coalesce(p_scheduled_at, now()),
    'PENDING'::public.payment_webhook_queue_state
  )
  on conflict on constraint payment_webhook_processing_queue_event_unique do nothing
  returning id, state into v_queue_id, v_queue_state;

  if v_queue_id is not null then
    v_status := 'enqueued';
  else
    select q.id, q.state
    into v_queue_id, v_queue_state
    from public.payment_webhook_processing_queue q
    where q.webhook_event_id = v_event.id;

    if not found then
      raise exception 'WEBHOOK_QUEUE_CONFLICT_UNRESOLVED'
        using errcode = 'P0001';
    end if;

    v_status := 'already_queued';
  end if;

  update public.payment_webhook_events e
  set state = 'VALIDATING'::public.payment_webhook_event_state
  where e.id = v_event.id
    and e.state = 'RECEIVED'::public.payment_webhook_event_state;

  return jsonb_build_object(
    'status', v_status,
    'queue_id', v_queue_id,
    'webhook_event_id', v_event.id,
    'event_type', v_event.event_type,
    'gateway_event_id', v_event.gateway_event_id,
    'event_state', (
      select ev.state
      from public.payment_webhook_events ev
      where ev.id = v_event.id
    ),
    'queue_state', v_queue_state
  );
end;
$$;

comment on function public.payment_enqueue_webhook_processing(uuid, timestamptz) is
  'Enqueues heavy-path webhook processing; parent event moves to VALIDATING (service_role only).';

revoke all on function public.payment_enqueue_webhook_processing(uuid, timestamptz) from public;
revoke all on function public.payment_enqueue_webhook_processing(uuid, timestamptz) from anon;
revoke all on function public.payment_enqueue_webhook_processing(uuid, timestamptz) from authenticated;

grant execute on function public.payment_enqueue_webhook_processing(uuid, timestamptz) to service_role;

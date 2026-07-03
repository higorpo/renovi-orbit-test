-- Webhook ingress state transitions for netcred-webhook EF (design.md §4.7.1).
-- Replaces direct service_role UPDATEs on payment_webhook_events from Edge Functions.

create or replace function public.payment_update_webhook_event_state(
  p_webhook_event_id uuid,
  p_target_state public.payment_webhook_event_state,
  p_failure_reason text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_event public.payment_webhook_events%rowtype;
  v_failure_reason text;
begin
  if coalesce(auth.role(), '') <> 'service_role' then
    raise exception 'service_role required for payment_update_webhook_event_state'
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

  if v_event.state = p_target_state
    and p_target_state in (
      'PROCESSED'::public.payment_webhook_event_state,
      'DUPLICATE'::public.payment_webhook_event_state,
      'DEAD_LETTER'::public.payment_webhook_event_state,
      'FAILED'::public.payment_webhook_event_state
    ) then
    if p_target_state = 'DUPLICATE'::public.payment_webhook_event_state
       and v_event.processed_at is null then
      update public.payment_webhook_events e
      set
        processed_at = now(),
        updated_at = now()
      where e.id = p_webhook_event_id;

      return jsonb_build_object(
        'event_id', v_event.id,
        'state', v_event.state,
        'updated', true
      );
    end if;

    return jsonb_build_object(
      'event_id', v_event.id,
      'state', v_event.state,
      'updated', false
    );
  end if;

  if p_target_state = 'DUPLICATE'::public.payment_webhook_event_state then
    if v_event.state = 'DEAD_LETTER'::public.payment_webhook_event_state then
      raise exception 'WEBHOOK_EVENT_TERMINAL'
        using errcode = 'P0001';
    end if;

    update public.payment_webhook_events e
    set
      is_duplicate = true,
      state = 'DUPLICATE'::public.payment_webhook_event_state,
      processed_at = coalesce(e.processed_at, now()),
      updated_at = now()
    where e.id = p_webhook_event_id;

    return jsonb_build_object(
      'event_id', p_webhook_event_id,
      'state', 'DUPLICATE'::public.payment_webhook_event_state,
      'updated', true
    );
  end if;

  if p_target_state = 'VALIDATING'::public.payment_webhook_event_state then
    if v_event.state <> 'RECEIVED'::public.payment_webhook_event_state then
      raise exception 'WEBHOOK_INVALID_STATE_TRANSITION'
        using errcode = 'P0001';
    end if;

    update public.payment_webhook_events e
    set
      state = 'VALIDATING'::public.payment_webhook_event_state,
      updated_at = now()
    where e.id = p_webhook_event_id;

    return jsonb_build_object(
      'event_id', p_webhook_event_id,
      'state', 'VALIDATING'::public.payment_webhook_event_state,
      'updated', true
    );
  end if;

  if p_target_state = 'PROCESSING'::public.payment_webhook_event_state then
    if v_event.state not in (
      'RECEIVED'::public.payment_webhook_event_state,
      'VALIDATING'::public.payment_webhook_event_state
    ) then
      raise exception 'WEBHOOK_INVALID_STATE_TRANSITION'
        using errcode = 'P0001';
    end if;

    update public.payment_webhook_events e
    set
      state = 'PROCESSING'::public.payment_webhook_event_state,
      updated_at = now()
    where e.id = p_webhook_event_id;

    return jsonb_build_object(
      'event_id', p_webhook_event_id,
      'state', 'PROCESSING'::public.payment_webhook_event_state,
      'updated', true
    );
  end if;

  if p_target_state = 'PROCESSED'::public.payment_webhook_event_state then
    if v_event.state not in (
      'RECEIVED'::public.payment_webhook_event_state,
      'VALIDATING'::public.payment_webhook_event_state,
      'PROCESSING'::public.payment_webhook_event_state
    ) then
      raise exception 'WEBHOOK_INVALID_STATE_TRANSITION'
        using errcode = 'P0001';
    end if;

    update public.payment_webhook_events e
    set
      state = 'PROCESSED'::public.payment_webhook_event_state,
      processed_at = coalesce(e.processed_at, now()),
      updated_at = now()
    where e.id = p_webhook_event_id;

    return jsonb_build_object(
      'event_id', p_webhook_event_id,
      'state', 'PROCESSED'::public.payment_webhook_event_state,
      'updated', true
    );
  end if;

  if p_target_state = 'FAILED'::public.payment_webhook_event_state then
    if p_failure_reason is null or btrim(p_failure_reason) = '' then
      raise exception 'p_failure_reason is required for FAILED state'
        using errcode = '22023';
    end if;

    if v_event.state not in (
      'RECEIVED'::public.payment_webhook_event_state,
      'VALIDATING'::public.payment_webhook_event_state,
      'PROCESSING'::public.payment_webhook_event_state
    ) then
      raise exception 'WEBHOOK_INVALID_STATE_TRANSITION'
        using errcode = 'P0001';
    end if;

    v_failure_reason := left(btrim(p_failure_reason), 4000);

    update public.payment_webhook_events e
    set
      state = 'FAILED'::public.payment_webhook_event_state,
      failure_reason = v_failure_reason,
      updated_at = now()
    where e.id = p_webhook_event_id;

    return jsonb_build_object(
      'event_id', p_webhook_event_id,
      'state', 'FAILED'::public.payment_webhook_event_state,
      'updated', true
    );
  end if;

  raise exception 'WEBHOOK_UNSUPPORTED_TARGET_STATE'
    using errcode = '22023';
end;
$$;

comment on function public.payment_update_webhook_event_state(
  uuid,
  public.payment_webhook_event_state,
  text
) is
  'Validated payment_webhook_events state transitions for netcred-webhook EF ingress (service_role only).';

revoke all on function public.payment_update_webhook_event_state(
  uuid,
  public.payment_webhook_event_state,
  text
) from public;
revoke all on function public.payment_update_webhook_event_state(
  uuid,
  public.payment_webhook_event_state,
  text
) from anon;
revoke all on function public.payment_update_webhook_event_state(
  uuid,
  public.payment_webhook_event_state,
  text
) from authenticated;

grant execute on function public.payment_update_webhook_event_state(
  uuid,
  public.payment_webhook_event_state,
  text
) to service_role;

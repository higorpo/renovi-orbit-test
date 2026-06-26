-- Payment Task 31: payment_enqueue_notifications RPC (design.md §4.5.2, §1.7.9).

create or replace function public.payment_enqueue_notifications(
  p_schedule_id uuid,
  p_notification_event text,
  p_metadata jsonb default '{}'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public, message_dispatcher
as $$
declare
  v_schedule public.payment_schedules%rowtype;
  v_event text;
  v_dispatches jsonb := '[]'::jsonb;
  v_result jsonb;
  v_variables jsonb;
begin
  if coalesce(auth.role(), '') <> 'service_role' then
    raise exception 'service_role required for payment_enqueue_notifications'
      using errcode = '42501';
  end if;

  if p_schedule_id is null or p_notification_event is null or trim(p_notification_event) = '' then
    raise exception 'p_schedule_id and p_notification_event are required'
      using errcode = '22023';
  end if;

  select ps.*
  into v_schedule
  from public.payment_schedules ps
  where ps.id = p_schedule_id;

  if not found then
    raise exception 'SCHEDULE_NOT_FOUND'
      using errcode = 'P0002';
  end if;

  v_event := upper(trim(p_notification_event));

  if v_event not in (
    'CHARGE_SUCCEEDED',
    'CHARGE_FAILED',
    'CHARGE_FAILED_PERMANENT',
    'UPCOMING_CHARGE',
    'SERVICE_AUTO_CANCELLED'
  ) then
    raise exception 'UNSUPPORTED_NOTIFICATION_EVENT'
      using errcode = '22023';
  end if;

  v_variables := jsonb_build_object(
    'schedule_id', v_schedule.id,
    'contracted_service_id', v_schedule.contracted_service_id,
    'client_id', v_schedule.client_id,
    'provider_id', v_schedule.provider_id,
    'charge_scheduled_at', v_schedule.charge_scheduled_at,
    'paid_amount', v_schedule.paid_amount,
    'state', v_schedule.state
  ) || coalesce(p_metadata, '{}'::jsonb);

  v_result := public.mmd_ingest_event(
    v_event,
    v_schedule.client_id,
    format('payment:%s:%s:client', v_schedule.id, lower(v_event)),
    v_variables,
    jsonb_build_object('source', 'payment_enqueue_notifications', 'recipient', 'client')
  );
  v_dispatches := v_dispatches || jsonb_build_array(v_result);

  if v_event in ('CHARGE_SUCCEEDED', 'CHARGE_FAILED_PERMANENT', 'SERVICE_AUTO_CANCELLED') then
    v_result := public.mmd_ingest_event(
      v_event,
      v_schedule.provider_id,
      format('payment:%s:%s:provider', v_schedule.id, lower(v_event)),
      v_variables,
      jsonb_build_object('source', 'payment_enqueue_notifications', 'recipient', 'provider')
    );
    v_dispatches := v_dispatches || jsonb_build_array(v_result);
  end if;

  return jsonb_build_object(
    'notification_event', v_event,
    'schedule_id', v_schedule.id,
    'dispatches', v_dispatches
  );
end;
$$;

comment on function public.payment_enqueue_notifications(uuid, text, jsonb) is
  'Post-commit MMD enqueue for payment notification matrix; decoupled from state TX.';

revoke all on function public.payment_enqueue_notifications(uuid, text, jsonb) from public;
revoke all on function public.payment_enqueue_notifications(uuid, text, jsonb) from anon;
revoke all on function public.payment_enqueue_notifications(uuid, text, jsonb) from authenticated;

grant execute on function public.payment_enqueue_notifications(uuid, text, jsonb) to service_role;

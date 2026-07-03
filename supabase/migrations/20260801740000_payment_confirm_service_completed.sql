-- Payment Task 108: payment_confirm_service_completed RPC (design.md §4.13, Req 32).

create or replace function public.payment_confirm_service_completed(
  p_service_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public, auth, message_dispatcher
as $$
declare
  v_cs public.contracted_services%rowtype;
  v_schedule_id uuid;
  v_is_disputed boolean;
  v_mmd jsonb;
  v_completed_at timestamptz := now();
  v_service_request_title text;
begin
  if p_service_id is null then
    raise exception 'p_service_id is required'
      using errcode = '22023';
  end if;

  if auth.uid() is null then
    raise exception 'Authentication required for payment_confirm_service_completed'
      using errcode = '42501';
  end if;

  select cs.*
  into v_cs
  from public.contracted_services cs
  where cs.id = p_service_id
    and cs.client_id = auth.uid()
  for update;

  if not found then
    raise exception 'SERVICE_NOT_FOUND_OR_UNAUTHORIZED'
      using errcode = 'P0003';
  end if;

  if v_cs.status <> 'EXECUTED'::public.contracted_service_status then
    raise exception 'INVALID_STATUS_TRANSITION'
      using errcode = 'P0001';
  end if;

  update public.contracted_services cs
  set
    status = 'COMPLETED'::public.contracted_service_status,
    completed_at = v_completed_at,
    completed_by = 'client'
  where cs.id = p_service_id;

  select ps.id, ps.is_disputed
  into v_schedule_id, v_is_disputed
  from public.payment_schedules ps
  where ps.contracted_service_id = p_service_id;

  if v_schedule_id is not null then
    perform public.payment_write_audit(
      p_event_type := 'SERVICE_COMPLETED',
      p_entity_type := 'payment_schedule',
      p_entity_id := v_schedule_id,
      p_service_id := p_service_id,
      p_schedule_id := v_schedule_id,
      p_from_state := 'EXECUTED',
      p_to_state := 'COMPLETED',
      p_actor := 'client'::public.payment_audit_actor,
      p_actor_id := auth.uid(),
      p_metadata := jsonb_build_object(
        'completed_at', v_completed_at,
        'completed_by', 'client',
        'is_disputed', coalesce(v_is_disputed, false)
      )
    );

    perform public.payment_write_event(
      p_event_type := 'ServiceCompleted',
      p_aggregate_type := 'payment_schedule',
      p_aggregate_id := v_schedule_id,
      p_service_id := p_service_id,
      p_payload := jsonb_build_object(
        'completed_by', 'client',
        'client_id', v_cs.client_id,
        'provider_id', v_cs.provider_id,
        'is_disputed', coalesce(v_is_disputed, false)
      )
    );
  end if;

  select coalesce(nullif(trim(sr.title), ''), 'Serviço')
  into v_service_request_title
  from public.service_requests sr
  where sr.id = v_cs.service_request_id;

  v_mmd := public.mmd_ingest_event(
    'SERVICE_COMPLETED',
    v_cs.provider_id,
    format('service-completed:%s:provider', p_service_id),
    jsonb_build_object(
      'service_id', p_service_id,
      'client_id', v_cs.client_id,
      'provider_id', v_cs.provider_id,
      'completed_by', 'client',
      'service_request_title', v_service_request_title,
      'deep_link_path', format('/dashboard/services/%s', v_cs.service_request_id)
    ),
    jsonb_build_object(
      'source', 'payment_confirm_service_completed',
      'recipient', 'provider'
    )
  );

  return jsonb_build_object(
    'service_id', p_service_id,
    'status', 'COMPLETED',
    'completed_at', v_completed_at,
    'completed_by', 'client',
    'provider_id', v_cs.provider_id,
    'mmd', v_mmd
  );
end;
$$;

comment on function public.payment_confirm_service_completed(uuid) is
  'Client confirms own EXECUTED service as COMPLETED; dispute does not block (Req 32 AC4).';

revoke all on function public.payment_confirm_service_completed(uuid) from public;
revoke all on function public.payment_confirm_service_completed(uuid) from anon;
revoke all on function public.payment_confirm_service_completed(uuid) from service_role;

grant execute on function public.payment_confirm_service_completed(uuid) to authenticated;

-- Payment Task 48: payment_mark_service_executed RPC (design.md §4.13, Req 32).

create or replace function public.payment_mark_service_executed(
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
  v_mmd jsonb;
  v_service_request_title text;
begin
  if p_service_id is null then
    raise exception 'p_service_id is required'
      using errcode = '22023';
  end if;

  if auth.uid() is null then
    raise exception 'Authentication required for payment_mark_service_executed'
      using errcode = '42501';
  end if;

  select cs.*
  into v_cs
  from public.contracted_services cs
  where cs.id = p_service_id
    and cs.provider_id = auth.uid()
  for update;

  if not found then
    raise exception 'SERVICE_NOT_FOUND_OR_UNAUTHORIZED'
      using errcode = 'P0003';
  end if;

  if v_cs.status <> 'CONFIRMED'::public.contracted_service_status then
    raise exception 'INVALID_STATUS_TRANSITION'
      using errcode = 'P0001';
  end if;

  if v_cs.scheduled_start_date > (now() at time zone 'America/Sao_Paulo')::date then
    raise exception 'SERVICE_NOT_YET_DUE'
      using errcode = 'P0002';
  end if;

  update public.contracted_services cs
  set
    status = 'EXECUTED'::public.contracted_service_status,
    executed_at = now()
  where cs.id = p_service_id;

  select ps.id
  into v_schedule_id
  from public.payment_schedules ps
  where ps.contracted_service_id = p_service_id;

  if v_schedule_id is not null then
    perform public.payment_write_audit(
      p_event_type := 'SERVICE_EXECUTED',
      p_entity_type := 'payment_schedule',
      p_entity_id := v_schedule_id,
      p_service_id := p_service_id,
      p_schedule_id := v_schedule_id,
      p_from_state := v_cs.status::text,
      p_to_state := 'EXECUTED',
      p_actor := 'provider'::public.payment_audit_actor,
      p_actor_id := auth.uid(),
      p_metadata := jsonb_build_object(
        'executed_at', now(),
        'scheduled_start_date', v_cs.scheduled_start_date
      )
    );

    perform public.payment_write_event(
      p_event_type := 'ServiceExecuted',
      p_aggregate_type := 'payment_schedule',
      p_aggregate_id := v_schedule_id,
      p_service_id := p_service_id,
      p_payload := jsonb_build_object(
        'provider_id', v_cs.provider_id,
        'client_id', v_cs.client_id,
        'executed_at', now()
      )
    );
  end if;

  select coalesce(nullif(trim(sr.title), ''), 'Serviço')
  into v_service_request_title
  from public.service_requests sr
  where sr.id = v_cs.service_request_id;

  v_mmd := public.mmd_ingest_event(
    'SERVICE_EXECUTED',
    v_cs.client_id,
    format('service-executed:%s', p_service_id),
    jsonb_build_object(
      'service_id', p_service_id,
      'provider_id', v_cs.provider_id,
      'service_request_title', v_service_request_title,
      'deep_link_path', format('/dashboard/services/%s', v_cs.service_request_id)
    ),
    jsonb_build_object(
      'source', 'payment_mark_service_executed'
    )
  );

  return jsonb_build_object(
    'service_id', p_service_id,
    'status', 'EXECUTED',
    'executed_at', now(),
    'client_id', v_cs.client_id,
    'mmd', v_mmd
  );
end;
$$;

comment on function public.payment_mark_service_executed(uuid) is
  'Provider marks own CONFIRMED service as EXECUTED on or after scheduled_start_date.';

revoke all on function public.payment_mark_service_executed(uuid) from public;
revoke all on function public.payment_mark_service_executed(uuid) from anon;
revoke all on function public.payment_mark_service_executed(uuid) from service_role;

grant execute on function public.payment_mark_service_executed(uuid) to authenticated;

-- Payment Task 47: payment_auto_complete_executed_services RPC (design.md §4.13, Req 32).

create or replace function public.payment_auto_complete_executed_services()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_service record;
  v_results jsonb := '[]'::jsonb;
  v_errors int := 0;
  v_grace_hours int;
begin
  if coalesce(auth.role(), '') <> 'service_role' then
    raise exception 'service_role required for payment_auto_complete_executed_services'
      using errcode = '42501';
  end if;

  v_grace_hours := public.platform_constant_int('auto_complete_grace_hours', 24);

  for v_service in
    select
      cs.id as service_id,
      cs.client_id,
      cs.provider_id,
      cs.executed_at,
      ps.id as schedule_id
    from public.contracted_services cs
    left join public.payment_schedules ps on ps.contracted_service_id = cs.id
    where cs.status = 'EXECUTED'::public.contracted_service_status
      and cs.executed_at is not null
      and cs.executed_at + make_interval(hours => v_grace_hours) <= now()
    for update of cs skip locked
  loop
    begin
      update public.contracted_services cs
      set
        status = 'COMPLETED'::public.contracted_service_status,
        completed_at = now(),
        completed_by = 'system'
      where cs.id = v_service.service_id
        and cs.status = 'EXECUTED'::public.contracted_service_status;

      if not found then
        continue;
      end if;

      if v_service.schedule_id is not null then
        perform public.payment_write_audit(
          p_event_type := 'SERVICE_AUTO_COMPLETED',
          p_entity_type := 'payment_schedule',
          p_entity_id := v_service.schedule_id,
          p_service_id := v_service.service_id,
          p_schedule_id := v_service.schedule_id,
          p_from_state := 'EXECUTED',
          p_to_state := 'COMPLETED',
          p_actor := 'system'::public.payment_audit_actor,
          p_metadata := jsonb_build_object(
            'executed_at', v_service.executed_at,
            'completed_by', 'system'
          )
        );

        perform public.payment_write_event(
          p_event_type := 'ServiceCompleted',
          p_aggregate_type := 'payment_schedule',
          p_aggregate_id := v_service.schedule_id,
          p_service_id := v_service.service_id,
          p_payload := jsonb_build_object(
            'completed_by', 'system',
            'executed_at', v_service.executed_at
          )
        );
      end if;

      v_results := v_results || jsonb_build_array(
        jsonb_build_object(
          'service_id', v_service.service_id,
          'schedule_id', v_service.schedule_id,
          'client_id', v_service.client_id,
          'provider_id', v_service.provider_id,
          'executed_at', v_service.executed_at,
          'completed_by', 'system'
        )
      );
    exception
      when others then
        v_errors := v_errors + 1;
        raise warning
          'payment_auto_complete_executed_services row failed service_id=% sqlstate=% message=%',
          v_service.service_id,
          sqlstate,
          sqlerrm;
    end;
  end loop;

  return jsonb_build_object(
    'completed_count', jsonb_array_length(v_results),
    'completed', v_results,
    'errors_count', v_errors
  );
end;
$$;

comment on function public.payment_auto_complete_executed_services() is
  'Promotes EXECUTED services to COMPLETED after 24h; returns rows for cron MMD dispatch.';

revoke all on function public.payment_auto_complete_executed_services() from public;
revoke all on function public.payment_auto_complete_executed_services() from anon;
revoke all on function public.payment_auto_complete_executed_services() from authenticated;

grant execute on function public.payment_auto_complete_executed_services() to service_role;

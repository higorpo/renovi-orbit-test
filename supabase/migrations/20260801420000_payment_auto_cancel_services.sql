-- Payment Task 44: payment_auto_cancel_services RPC (design.md §4.12, Req 14).

create or replace function public.payment_auto_cancel_services(
  p_batch_size int default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_service record;
  v_cancel_hours int;
  v_batch_size int;
  v_reason text;
  v_results jsonb := '[]'::jsonb;
  v_errors int := 0;
begin
  if coalesce(auth.role(), '') <> 'service_role' then
    raise exception 'service_role required for payment_auto_cancel_services'
      using errcode = '42501';
  end if;

  v_cancel_hours := public.platform_constant_int('auto_cancel_hours_before_service', 12);
  v_batch_size := greatest(
    coalesce(
      p_batch_size,
      public.platform_constant_int('auto_cancel_batch_size', 100)
    ),
    1
  );

  for v_service in
    select
      cs.id as service_id,
      cs.client_id,
      cs.provider_id,
      cs.status as service_status,
      ps.id as schedule_id,
      ps.state as schedule_state,
      pga.onboarding_status
    from public.contracted_services cs
    inner join public.payment_schedules ps on ps.contracted_service_id = cs.id
    left join public.provider_gateway_accounts pga
      on pga.provider_id = ps.provider_id
      and pga.gateway_slug = ps.gateway_slug
    where cs.service_execution_at - now()
      <= make_interval(hours => v_cancel_hours)
      and cs.status not in (
        'CANCELLED'::public.contracted_service_status,
        'COMPLETED'::public.contracted_service_status
      )
      and (
        ps.state in (
          'SCHEDULED'::public.payment_schedule_state,
          'FAILED'::public.payment_schedule_state,
          'FAILED_PERMANENT'::public.payment_schedule_state
        )
        or ps.state = 'IN_ANALYSIS'::public.payment_schedule_state
      )
    order by cs.service_execution_at, cs.id
    limit v_batch_size
    for update of cs, ps skip locked
  loop
    begin
      if v_service.service_status = 'CANCELLED'::public.contracted_service_status then
        continue;
      end if;

      v_reason := case
        when v_service.onboarding_status = 'SUSPENDED'::public.payment_provider_onboarding_status
          then 'PROVIDER_SUSPENDED'
        else 'NON_PAYMENT'
      end;

      update public.contracted_services cs
      set
        status = 'CANCELLED'::public.contracted_service_status,
        cancellation_reason = v_reason
      where cs.id = v_service.service_id;

      update public.payment_schedules ps
      set
        state = 'CANCELLED'::public.payment_schedule_state,
        cancelled_at = now(),
        cancellation_reason = v_reason,
        updated_at = now()
      where ps.id = v_service.schedule_id;

      perform public.payment_write_audit(
        p_event_type := 'AUTO_CANCELLED',
        p_entity_type := 'payment_schedule',
        p_entity_id := v_service.schedule_id,
        p_service_id := v_service.service_id,
        p_schedule_id := v_service.schedule_id,
        p_from_state := v_service.schedule_state::text,
        p_to_state := 'CANCELLED',
        p_actor := 'system'::public.payment_audit_actor,
        p_metadata := jsonb_build_object(
          'cancellation_reason', v_reason,
          'service_status', v_service.service_status::text
        )
      );

      perform public.payment_write_event(
        p_event_type := 'ServiceAutoCancelled',
        p_aggregate_type := 'payment_schedule',
        p_aggregate_id := v_service.schedule_id,
        p_service_id := v_service.service_id,
        p_payload := jsonb_build_object(
          'schedule_id', v_service.schedule_id,
          'cancellation_reason', v_reason,
          'requires_gateway_reconcile',
            v_service.schedule_state = 'IN_ANALYSIS'::public.payment_schedule_state
        )
      );

      v_results := v_results || jsonb_build_array(
        jsonb_build_object(
          'service_id', v_service.service_id,
          'schedule_id', v_service.schedule_id,
          'client_id', v_service.client_id,
          'provider_id', v_service.provider_id,
          'cancellation_reason', v_reason,
          'schedule_state', v_service.schedule_state,
          'requires_gateway_reconcile',
            v_service.schedule_state = 'IN_ANALYSIS'::public.payment_schedule_state
        )
      );
    exception
      when others then
        v_errors := v_errors + 1;
        raise warning
          'payment_auto_cancel_services row failed service_id=% schedule_id=% sqlstate=% message=%',
          v_service.service_id,
          v_service.schedule_id,
          sqlstate,
          sqlerrm;
    end;
  end loop;

  return jsonb_build_object(
    'cancelled_count', jsonb_array_length(v_results),
    'cancelled', v_results,
    'errors_count', v_errors
  );
end;
$$;

comment on function public.payment_auto_cancel_services(int) is
  'T-12h auto-cancel batch for unpaid schedules; returns cancelled rows for cron notification dispatch.';

revoke all on function public.payment_auto_cancel_services(int) from public;
revoke all on function public.payment_auto_cancel_services(int) from anon;
revoke all on function public.payment_auto_cancel_services(int) from authenticated;

grant execute on function public.payment_auto_cancel_services(int) to service_role;

-- Payment Task 3: canonical service execution instant for T-2, T-12h, refund, and manual-payment gates.

create or replace function public.payment_service_execution_at(p_cs public.contracted_services)
returns timestamptz
language plpgsql
stable
set search_path = public
as $$
declare
  v_shift_time time;
begin
  v_shift_time := case p_cs.scheduled_shift
    when 'morning' then time '08:00'
    when 'afternoon' then time '13:00'
    when 'full_day' then time '08:00'
    else null
  end;

  if v_shift_time is null then
    raise exception 'UNKNOWN_SCHEDULED_SHIFT'
      using
        errcode = '22023',
        detail = jsonb_build_object(
          'code', 'UNKNOWN_SCHEDULED_SHIFT',
          'scheduled_shift', p_cs.scheduled_shift
        )::text;
  end if;

  return (
    p_cs.scheduled_start_date::timestamp + v_shift_time
  ) at time zone 'America/Sao_Paulo';
end;
$$;

comment on function public.payment_service_execution_at(public.contracted_services) is
  'Canonical payment scheduling instant from scheduled_start_date + scheduled_shift in America/Sao_Paulo. Anchor is always scheduled_start_date, never scheduled_end_date.';

create or replace function public.payment_compute_charge_scheduled_at(p_cs public.contracted_services)
returns timestamptz
language plpgsql
stable
set search_path = public
as $$
declare
  v_exec_at timestamptz;
  v_hours int;
begin
  v_exec_at := public.payment_service_execution_at(p_cs);
  v_hours := public.platform_constant_int('scheduled_charge_hours_before_service', 48);

  if v_exec_at - now() < make_interval(hours => v_hours) then
    return now();
  end if;

  return greatest(now(), v_exec_at - make_interval(hours => v_hours));
end;
$$;

comment on function public.payment_compute_charge_scheduled_at(public.contracted_services) is
  'Charge queue scheduling instant from service execution minus scheduled_charge_hours_before_service platform constant.';

revoke all on function public.payment_service_execution_at(public.contracted_services) from public;
revoke all on function public.payment_service_execution_at(public.contracted_services) from anon;
revoke all on function public.payment_service_execution_at(public.contracted_services) from authenticated;

grant execute on function public.payment_service_execution_at(public.contracted_services) to service_role;

revoke all on function public.payment_compute_charge_scheduled_at(public.contracted_services) from public;
revoke all on function public.payment_compute_charge_scheduled_at(public.contracted_services) from anon;
revoke all on function public.payment_compute_charge_scheduled_at(public.contracted_services) from authenticated;

grant execute on function public.payment_compute_charge_scheduled_at(public.contracted_services) to service_role;

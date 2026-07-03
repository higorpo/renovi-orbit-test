-- Payment Task 86: hook CNS reschedule confirm to payment_reschedule_charge_date (Req 9 AC3–AC5).

create or replace function public.cns_confirm_service_reschedule(
  p_contracted_service_id uuid,
  p_new_slot jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_cs public.contracted_services%rowtype;
  v_shift text;
  v_start_date date;
  v_end_date date;
  v_payment jsonb;
  v_actor_id uuid;
begin
  if p_contracted_service_id is null then
    raise exception 'p_contracted_service_id is required'
      using errcode = '22023';
  end if;

  if p_new_slot is null or jsonb_typeof(p_new_slot) <> 'object' then
    raise exception 'INVALID_SLOT'
      using errcode = '22023';
  end if;

  v_actor_id := auth.uid();
  if v_actor_id is null then
    raise exception 'Authentication required for cns_confirm_service_reschedule'
      using errcode = '42501';
  end if;

  v_shift := nullif(btrim(p_new_slot->>'shift'), '');
  if v_shift not in ('morning', 'afternoon', 'full_day') then
    raise exception 'INVALID_SLOT_SHIFT'
      using errcode = '22023';
  end if;

  begin
    v_start_date := (p_new_slot->>'start_date')::date;
  exception
    when others then
      raise exception 'INVALID_SLOT_START_DATE'
        using errcode = '22023';
  end;

  if v_start_date is null then
    raise exception 'INVALID_SLOT_START_DATE'
      using errcode = '22023';
  end if;

  v_end_date := nullif(btrim(p_new_slot->>'end_date'), '')::date;

  select cs.*
  into v_cs
  from public.contracted_services cs
  where cs.id = p_contracted_service_id
  for update;

  if not found then
    raise exception 'CONTRACTED_SERVICE_NOT_FOUND'
      using errcode = 'P0002';
  end if;

  if v_actor_id <> v_cs.client_id and v_actor_id <> v_cs.provider_id then
    raise exception 'FORBIDDEN'
      using errcode = '42501';
  end if;

  if v_cs.status = 'CANCELLED'::public.contracted_service_status then
    raise exception 'SERVICE_CANCELLED'
      using errcode = 'P0001';
  end if;

  if v_cs.status in (
    'EXECUTED'::public.contracted_service_status,
    'COMPLETED'::public.contracted_service_status
  ) then
    raise exception 'RESCHEDULE_NOT_ALLOWED'
      using errcode = 'P0001';
  end if;

  update public.contracted_services cs
  set
    scheduled_start_date = v_start_date,
    scheduled_end_date = v_end_date,
    scheduled_shift = v_shift,
    agreed_slot = p_new_slot,
    updated_at = now()
  where cs.id = p_contracted_service_id
  returning * into v_cs;

  perform set_config('request.jwt.claim.role', 'service_role', true);
  perform set_config(
    'request.jwt.claims',
    json_build_object('role', 'service_role')::text,
    true
  );

  v_payment := public.payment_reschedule_charge_date(p_contracted_service_id);

  raise log 'cns_confirm_service_reschedule service_id=% actor_id=% payment_outcome=%',
    p_contracted_service_id,
    v_actor_id,
    v_payment->>'outcome';

  return jsonb_build_object(
    'contracted_service_id', p_contracted_service_id,
    'scheduled_start_date', v_cs.scheduled_start_date,
    'scheduled_end_date', v_cs.scheduled_end_date,
    'scheduled_shift', v_cs.scheduled_shift,
    'agreed_slot', v_cs.agreed_slot,
    'service_status', v_cs.status,
    'payment', v_payment
  );
end;
$$;

comment on function public.cns_confirm_service_reschedule(uuid, jsonb) is
  'Confirms negotiated service reschedule, updates slot columns, and invokes payment_reschedule_charge_date.';

revoke all on function public.cns_confirm_service_reschedule(uuid, jsonb) from public;
revoke all on function public.cns_confirm_service_reschedule(uuid, jsonb) from anon;
revoke all on function public.cns_confirm_service_reschedule(uuid, jsonb) from service_role;

grant execute on function public.cns_confirm_service_reschedule(uuid, jsonb) to authenticated;

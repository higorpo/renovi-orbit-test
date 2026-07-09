-- Service reschedule: helpers and core RPCs (request → propose → accept/adjust/cancel).

create or replace function public.cns_format_reschedule_shift_pt(p_shift text)
returns text
language sql
immutable
set search_path = public
as $$
  select case p_shift
    when 'morning' then 'Manhã'
    when 'afternoon' then 'Tarde'
    when 'full_day' then 'Dia inteiro'
    else coalesce(p_shift, '')
  end;
$$;

create or replace function public.cns_format_reschedule_slot_pt(p_slot jsonb)
returns text
language plpgsql
stable
set search_path = public
as $$
declare
  v_start date;
  v_end date;
  v_shift text;
begin
  if p_slot is null or jsonb_typeof(p_slot) <> 'object' then
    return '';
  end if;

  begin
    v_start := (p_slot->>'start_date')::date;
  exception
    when others then
      return '';
  end;

  v_end := nullif(btrim(p_slot->>'end_date'), '')::date;
  v_shift := public.cns_format_reschedule_shift_pt(nullif(btrim(p_slot->>'shift'), ''));

  if v_start is null then
    return '';
  end if;

  if v_end is not null and v_end <> v_start then
    return format(
      '%s até %s (%s)',
      to_char(v_start, 'DD/MM/YYYY'),
      to_char(v_end, 'DD/MM/YYYY'),
      v_shift
    );
  end if;

  return format('%s (%s)', to_char(v_start, 'DD/MM/YYYY'), v_shift);
end;
$$;

create or replace function public.cns_build_contracted_service_slot_jsonb(p_cs public.contracted_services)
returns jsonb
language sql
immutable
set search_path = public
as $$
  select jsonb_build_object(
    'start_date', p_cs.scheduled_start_date,
    'end_date', p_cs.scheduled_end_date,
    'shift', p_cs.scheduled_shift
  );
$$;

create or replace function public.cns_resolve_contracted_service_chat_id(
  p_contracted_service_id uuid
)
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select c.id
  from public.contracted_services cs
  join public.chats c
    on c.service_request_id = cs.service_request_id
   and c.provider_id = cs.provider_id
  where cs.id = p_contracted_service_id
  order by c.last_interaction_at desc, c.id desc
  limit 1;
$$;

revoke all on function public.cns_resolve_contracted_service_chat_id(uuid) from public, anon, authenticated;
grant execute on function public.cns_resolve_contracted_service_chat_id(uuid) to service_role;

create or replace function public.cns_cancel_active_service_reschedule_requests(
  p_contracted_service_id uuid
)
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count int := 0;
begin
  update public.service_reschedule_requests srr
  set status = 'CANCELLED'::public.service_reschedule_request_status
  where srr.contracted_service_id = p_contracted_service_id
    and srr.status in (
      'REQUESTED'::public.service_reschedule_request_status,
      'PROPOSED'::public.service_reschedule_request_status,
      'ADJUSTMENT_REQUESTED'::public.service_reschedule_request_status
    );

  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

revoke all on function public.cns_cancel_active_service_reschedule_requests(uuid) from public, anon, authenticated;
grant execute on function public.cns_cancel_active_service_reschedule_requests(uuid) to service_role, postgres;

create or replace function public._cns_validate_reschedule_slot(
  p_slot jsonb,
  p_duration_unit text default null,
  p_duration_value integer default null
)
returns void
language plpgsql
stable
set search_path = public
as $$
declare
  v_shift text;
  v_start_date date;
  v_end_date date;
  v_end_raw text;
  v_duration_unit text;
  v_duration_value integer;
begin
  if p_slot is null or jsonb_typeof(p_slot) <> 'object' then
    raise exception 'INVALID_SLOT_SHAPE'
      using errcode = '22023';
  end if;

  -- Prefer duration embedded in the proposed slot; fall back to contracted baseline.
  v_duration_unit := coalesce(
    nullif(btrim(p_slot->>'duration_unit'), ''),
    nullif(btrim(p_duration_unit), '')
  );
  begin
    v_duration_value := coalesce(
      nullif(btrim(p_slot->>'duration_value'), '')::integer,
      p_duration_value
    );
  exception
    when others then
      raise exception 'INVALID_SLOT_DURATION'
        using errcode = '22023';
  end;

  if v_duration_unit not in ('hours', 'days')
    or v_duration_value is null
    or v_duration_value <= 0
  then
    raise exception 'INVALID_SLOT_DURATION'
      using errcode = '22023';
  end if;

  if v_duration_unit = 'hours' and v_duration_value > 24 then
    raise exception 'INVALID_SLOT_DURATION'
      using errcode = '22023';
  end if;

  if v_duration_unit = 'days' and v_duration_value < 2 then
    raise exception 'INVALID_SLOT_DURATION'
      using errcode = '22023';
  end if;

  if v_duration_unit = 'days' and v_duration_value > 7 then
    raise exception 'INVALID_SLOT_DURATION'
      using errcode = '22023';
  end if;

  v_shift := nullif(btrim(p_slot->>'shift'), '');
  if v_shift not in ('morning', 'afternoon', 'full_day') then
    raise exception 'INVALID_SLOT_SHIFT'
      using errcode = '22023';
  end if;

  begin
    v_start_date := (p_slot->>'start_date')::date;
  exception
    when others then
      raise exception 'INVALID_SLOT_START_DATE'
        using errcode = '22023';
  end;

  if v_start_date is null then
    raise exception 'INVALID_SLOT_START_DATE'
      using errcode = '22023';
  end if;

  perform public.cns_assert_slot_start_date_allowed(v_start_date);

  v_end_raw := nullif(btrim(p_slot->>'end_date'), '');

  if v_duration_unit = 'hours' then
    if v_end_raw is not null then
      raise exception 'INVALID_SLOT_END_DATE'
        using errcode = '22023';
    end if;
    return;
  end if;

  -- Day-based slots always require end_date (equals start for single-day).
  if v_end_raw is null then
    raise exception 'INVALID_SLOT_END_DATE'
      using errcode = '22023';
  end if;

  begin
    v_end_date := v_end_raw::date;
  exception
    when others then
      raise exception 'INVALID_SLOT_END_DATE'
        using errcode = '22023';
  end;

  if v_end_date < v_start_date then
    raise exception 'INVALID_SLOT_END_DATE'
      using errcode = '22023';
  end if;

  if (v_end_date - v_start_date + 1) <> v_duration_value
    and public.count_inclusive_working_days(v_start_date, v_end_date) <> v_duration_value
  then
    raise exception 'INVALID_SLOT_DURATION'
      using errcode = '22023';
  end if;
end;
$$;

revoke all on function public._cns_validate_reschedule_slot(jsonb, text, integer) from public, anon, authenticated;
grant execute on function public._cns_validate_reschedule_slot(jsonb, text, integer) to service_role;

drop function if exists public._cns_validate_reschedule_slot(jsonb);

create or replace function public._cns_apply_service_reschedule_slot(
  p_contracted_service_id uuid,
  p_new_slot jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_cs public.contracted_services%rowtype;
  v_shift text;
  v_start_date date;
  v_end_date date;
  v_duration_unit text;
  v_duration_value integer;
  v_payment jsonb;
begin
  select cs.*
  into v_cs
  from public.contracted_services cs
  where cs.id = p_contracted_service_id
  for update;

  if not found then
    raise exception 'CONTRACTED_SERVICE_NOT_FOUND'
      using errcode = 'P0002';
  end if;

  perform public._cns_validate_reschedule_slot(
    p_new_slot,
    v_cs.duration_unit,
    v_cs.duration_value
  );

  v_shift := nullif(btrim(p_new_slot->>'shift'), '');
  v_start_date := (p_new_slot->>'start_date')::date;
  v_end_date := nullif(btrim(p_new_slot->>'end_date'), '')::date;
  v_duration_unit := coalesce(
    nullif(btrim(p_new_slot->>'duration_unit'), ''),
    v_cs.duration_unit
  );
  v_duration_value := coalesce(
    nullif(btrim(p_new_slot->>'duration_value'), '')::integer,
    v_cs.duration_value
  );

  update public.contracted_services cs
  set
    duration_unit = v_duration_unit,
    duration_value = v_duration_value,
    scheduled_start_date = v_start_date,
    scheduled_end_date = v_end_date,
    scheduled_shift = v_shift,
    agreed_slot = p_new_slot,
    updated_at = now()
  where cs.id = p_contracted_service_id
  returning * into v_cs;

  if coalesce(auth.role(), '') <> 'service_role' then
    perform set_config('request.jwt.claim.role', 'service_role', true);
    perform set_config(
      'request.jwt.claims',
      json_build_object('role', 'service_role')::text,
      true
    );
  end if;

  v_payment := public.payment_reschedule_charge_date(p_contracted_service_id);

  return jsonb_build_object(
    'contracted_service_id', p_contracted_service_id,
    'duration_unit', v_cs.duration_unit,
    'duration_value', v_cs.duration_value,
    'scheduled_start_date', v_cs.scheduled_start_date,
    'scheduled_end_date', v_cs.scheduled_end_date,
    'scheduled_shift', v_cs.scheduled_shift,
    'agreed_slot', v_cs.agreed_slot,
    'service_status', v_cs.status,
    'payment', v_payment
  );
end;
$$;

revoke all on function public._cns_apply_service_reschedule_slot(uuid, jsonb) from public, anon, authenticated;
grant execute on function public._cns_apply_service_reschedule_slot(uuid, jsonb) to service_role;

create or replace function public.cns_get_service_reschedule_request(
  p_reschedule_request_id uuid
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, auth
as $$
declare
  v_actor uuid := auth.uid();
  v_req public.service_reschedule_requests%rowtype;
  v_cs public.contracted_services%rowtype;
begin
  if v_actor is null then
    raise exception 'Authentication required for cns_get_service_reschedule_request'
      using errcode = '42501';
  end if;

  select srr.*
  into v_req
  from public.service_reschedule_requests srr
  where srr.id = p_reschedule_request_id;

  if not found then
    raise exception 'RESCHEDULE_REQUEST_NOT_FOUND'
      using errcode = 'P0002';
  end if;

  select cs.*
  into v_cs
  from public.contracted_services cs
  where cs.id = v_req.contracted_service_id;

  if not found
    or (v_actor <> v_cs.client_id and v_actor <> v_cs.provider_id)
  then
    raise exception 'RESCHEDULE_REQUEST_NOT_FOUND'
      using errcode = 'P0002';
  end if;

  return public.cns_service_reschedule_snapshot_for_viewer(v_req.contracted_service_id, v_actor);
end;
$$;

comment on function public.cns_get_service_reschedule_request(uuid) is
  'Returns reschedule snapshot for card hydration; RPC-only access to service_reschedule_requests.';

revoke all on function public.cns_get_service_reschedule_request(uuid) from public, anon;
grant execute on function public.cns_get_service_reschedule_request(uuid) to authenticated;

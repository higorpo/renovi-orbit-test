-- Provider calendar: date-range RPC for scheduled contracted services.

create or replace function public.list_provider_scheduled_services(
  p_from_date date,
  p_to_date date
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, auth
as $$
declare
  v_provider_id uuid := auth.uid();
  v_role text;
  v_from date;
  v_to date;
  v_max_span integer := 42;
  v_items jsonb;
  v_has_more_before boolean;
  v_has_more_after boolean;
begin
  if v_provider_id is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;

  select pr.role
  into v_role
  from public.profiles pr
  where pr.id = v_provider_id;

  if v_role is distinct from 'provider' then
    raise exception 'Provider access only' using errcode = '42501';
  end if;

  if p_from_date is null or p_to_date is null then
    raise exception 'p_from_date and p_to_date are required' using errcode = '22023';
  end if;

  if p_from_date > p_to_date then
    raise exception 'p_from_date must be on or before p_to_date' using errcode = '22023';
  end if;

  if (p_to_date - p_from_date) > v_max_span then
    raise exception 'Date range exceeds maximum span of % days', v_max_span using errcode = '22023';
  end if;

  v_from := p_from_date;
  v_to := p_to_date;

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'service_request_id', row_data.service_request_id,
        'contracted_service_id', row_data.contracted_service_id,
        'title', row_data.title,
        'platform_service_title', row_data.platform_service_title,
        'platform_service_color_key', row_data.platform_service_color_key,
        'scheduled_start_date', row_data.scheduled_start_date,
        'scheduled_end_date', row_data.scheduled_end_date,
        'scheduled_shift', row_data.scheduled_shift,
        'status', row_data.status
      )
      order by row_data.scheduled_start_date asc, row_data.title asc
    ),
    '[]'::jsonb
  )
  into v_items
  from (
    select
      cs.service_request_id,
      cs.id as contracted_service_id,
      sr.title,
      ps.title as platform_service_title,
      ps.color_key as platform_service_color_key,
      cs.scheduled_start_date,
      coalesce(cs.scheduled_end_date, cs.scheduled_start_date) as scheduled_end_date,
      cs.scheduled_shift,
      cs.status
    from public.contracted_services cs
    join public.service_requests sr on sr.id = cs.service_request_id
    left join public.platform_services ps on ps.id = sr.service_id
    where cs.provider_id = v_provider_id
      and cs.status <> 'CANCELLED'::public.contracted_service_status
      and cs.scheduled_start_date <= v_to
      and coalesce(cs.scheduled_end_date, cs.scheduled_start_date) >= v_from
  ) as row_data;

  select exists (
    select 1
    from public.contracted_services cs
    where cs.provider_id = v_provider_id
      and cs.status <> 'CANCELLED'::public.contracted_service_status
      and cs.scheduled_start_date < v_from
  )
  into v_has_more_before;

  select exists (
    select 1
    from public.contracted_services cs
    where cs.provider_id = v_provider_id
      and cs.status <> 'CANCELLED'::public.contracted_service_status
      and cs.scheduled_start_date > v_to
  )
  into v_has_more_after;

  return jsonb_build_object(
    'items', v_items,
    'range_from', v_from,
    'range_to', v_to,
    'has_more_before', v_has_more_before,
    'has_more_after', v_has_more_after
  );
end;
$$;

comment on function public.list_provider_scheduled_services(date, date) is
  'Returns provider contracted services overlapping a date range for calendar views. Provider role only.';

revoke all on function public.list_provider_scheduled_services(date, date) from public;
grant execute on function public.list_provider_scheduled_services(date, date) to authenticated;

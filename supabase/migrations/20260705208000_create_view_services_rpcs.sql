-- view-services RPCs: unified get/list for client and provider (replaces PostgREST list + client_my_services_cancelled_ids).

create or replace function public.view_services_mask_client_name(p_full_name text)
returns text
language sql
immutable
set search_path = public
as $$
  select case
    when p_full_name is null or btrim(p_full_name) = '' then 'Cliente'
    when position(' ' in p_full_name) > 0 then initcap(split_part(p_full_name, ' ', 1))
    else initcap(p_full_name)
  end;
$$;

create or replace function public.service_viewer_has_access(
  p_service_request_id uuid,
  p_viewer_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    public.is_platform_admin()
    or exists (
      select 1
      from public.service_requests sr
      where sr.id = p_service_request_id
        and sr.client_id = p_viewer_id
    )
    or exists (
      select 1
      from public.provider_proposals pp
      where pp.service_request_id = p_service_request_id
        and pp.provider_id = p_viewer_id
    )
    or exists (
      select 1
      from public.contracted_services cs
      where cs.service_request_id = p_service_request_id
        and cs.provider_id = p_viewer_id
    );
$$;

create or replace function public.derive_service_list_phase(
  p_sr_status public.service_request_status,
  p_cs_status public.contracted_service_status,
  p_viewer_role text,
  p_viewer_id uuid,
  p_cs_provider_id uuid
)
returns text
language sql
stable
set search_path = public
as $$
  select case
    when p_sr_status = 'CANCELLED'::public.service_request_status then 'cancelled'
    when p_sr_status = 'COMPLETED'::public.service_request_status
      and p_cs_status = 'CANCELLED'::public.contracted_service_status then 'cancelled'
    when p_viewer_role = 'provider' then
      case
        when p_cs_provider_id = p_viewer_id
          and p_cs_status = 'COMPLETED'::public.contracted_service_status then 'completed'
        when p_cs_provider_id = p_viewer_id
          and p_cs_status is not null
          and p_cs_status <> 'CANCELLED'::public.contracted_service_status then 'in_progress'
        when p_sr_status = 'OPEN'::public.service_request_status then 'negotiation'
        else 'cancelled'
      end
    else
      case
        when p_sr_status = 'COMPLETED'::public.service_request_status
          and p_cs_status = 'COMPLETED'::public.contracted_service_status then 'completed'
        when p_sr_status = 'COMPLETED'::public.service_request_status then 'in_progress'
        else 'negotiation'
      end
  end;
$$;

create or replace function public.project_service_row(
  p_service_request_id uuid,
  p_viewer_id uuid
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_role text;
  v_sr public.service_requests%rowtype;
  v_cs public.contracted_services%rowtype;
  v_list_phase text;
  v_proposal_count int;
  v_has_pending boolean;
  v_counterparty_id uuid;
  v_counterparty_name text;
  v_contracted_provider jsonb;
begin
  select pr.role
  into v_role
  from public.profiles pr
  where pr.id = p_viewer_id;

  if v_role is null then
    return null;
  end if;

  select *
  into v_sr
  from public.service_requests sr
  where sr.id = p_service_request_id;

  if not found then
    return null;
  end if;

  select cs.*
  into v_cs
  from public.contracted_services cs
  where cs.service_request_id = p_service_request_id;

  v_list_phase := public.derive_service_list_phase(
    v_sr.status,
    case when v_cs.id is null then null else v_cs.status end,
    v_role,
    p_viewer_id,
    v_cs.provider_id
  );

  if v_role = 'client' then
    select count(*)::int,
      coalesce(bool_or(pp.status = 'PENDING'::public.proposal_status), false)
    into v_proposal_count, v_has_pending
    from public.provider_proposals pp
    where pp.service_request_id = p_service_request_id;

    if v_cs.id is not null then
      select cs.provider_id,
        coalesce(
          nullif(btrim(ppp.display_name), ''),
          nullif(btrim(prov.full_name), ''),
          'Profissional'
        )
      into v_counterparty_id, v_counterparty_name
      from public.contracted_services cs
      join public.profiles prov on prov.id = cs.provider_id
      left join public.provider_profiles_public ppp on ppp.profile_id = cs.provider_id
      where cs.id = v_cs.id;
    else
      v_counterparty_id := null;
      v_counterparty_name := null;
    end if;
  else
    select count(*)::int,
      coalesce(bool_or(pp.status = 'PENDING'::public.proposal_status), false)
    into v_proposal_count, v_has_pending
    from public.provider_proposals pp
    where pp.service_request_id = p_service_request_id
      and pp.provider_id = p_viewer_id;

    select v_sr.client_id,
      public.view_services_mask_client_name(cli.full_name)
    into v_counterparty_id, v_counterparty_name
    from public.profiles cli
    where cli.id = v_sr.client_id;
  end if;

  if v_cs.id is not null then
    select jsonb_build_object(
      'id', cs.id,
      'status', cs.status,
      'agreed_slot', cs.agreed_slot,
      'duration_unit', cs.duration_unit,
      'duration_value', cs.duration_value,
      'scheduled_start_date', cs.scheduled_start_date,
      'scheduled_end_date', cs.scheduled_end_date,
      'scheduled_shift', cs.scheduled_shift,
      'provider', jsonb_build_object(
        'id', cs.provider_id,
        'display_name', coalesce(
          nullif(btrim(ppp.display_name), ''),
          nullif(btrim(prov.full_name), ''),
          'Profissional'
        )
      )
    )
    into v_contracted_provider
    from public.contracted_services cs
    join public.profiles prov on prov.id = cs.provider_id
    left join public.provider_profiles_public ppp on ppp.profile_id = cs.provider_id
    where cs.id = v_cs.id;
  else
    v_contracted_provider := null;
  end if;

  return jsonb_build_object(
    'id', v_sr.id,
    'list_phase', v_list_phase,
    'request', jsonb_build_object(
      'title', v_sr.title,
      'description', v_sr.description,
      'form_data', v_sr.form_data,
      'form_schema', v_sr.form_schema,
      'photos', coalesce(v_sr.photos, '{}'::text[]),
      'created_at', v_sr.created_at,
      'updated_at', v_sr.updated_at,
      'urgency', v_sr.urgency,
      'tags', v_sr.tags,
      'scope_complexity', v_sr.scope_complexity,
      'estimated_duration_hint', v_sr.estimated_duration_hint,
      'missing_info_warnings', v_sr.missing_info_warnings,
      'status', v_sr.status,
      'contracted_service_id', v_sr.contracted_service_id,
      'address', (
        select jsonb_build_object(
          'street', ca.street,
          'number', ca.number,
          'complement', ca.complement,
          'neighborhood', ca.neighborhood,
          'zip_code', ca.zip_code,
          'city_name', pc.name,
          'state_abbreviation', pst.abbreviation
        )
        from public.client_addresses ca
        left join public.platform_cities pc on pc.id = ca.city_id
        left join public.platform_states pst on pst.id = ca.state_id
        where ca.id = v_sr.address_id
      ),
      'platform_service', (
        select jsonb_build_object(
          'title', ps.title,
          'slug', ps.slug,
          'icon_key', ps.icon_key,
          'color_key', ps.color_key
        )
        from public.platform_services ps
        where ps.id = v_sr.service_id
      )
    ),
    'negotiation', jsonb_build_object(
      'proposal_count', v_proposal_count,
      'has_pending_proposal', v_has_pending
    ),
    'contracted', v_contracted_provider,
    'counterparty', case
      when v_counterparty_id is null then null
      else jsonb_build_object(
        'id', v_counterparty_id,
        'display_name', v_counterparty_name
      )
    end
  );
end;
$$;

create or replace function public.get_service(p_service_request_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_viewer_id uuid := auth.uid();
  v_row jsonb;
begin
  if v_viewer_id is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;

  if p_service_request_id is null then
    raise exception 'p_service_request_id is required' using errcode = '22023';
  end if;

  if not public.service_viewer_has_access(p_service_request_id, v_viewer_id) then
    raise exception 'Service not found or access denied' using errcode = '42501';
  end if;

  v_row := public.project_service_row(p_service_request_id, v_viewer_id);

  if v_row is null then
    raise exception 'Service not found' using errcode = '22023';
  end if;

  return v_row;
end;
$$;

create or replace function public.list_services(
  p_page integer default 1,
  p_page_size integer default 20,
  p_list_phase text default null,
  p_search text default null,
  p_category_title text default null,
  p_city_name text default null,
  p_neighborhood text default null,
  p_date_from date default null,
  p_date_to date default null,
  p_has_images boolean default null,
  p_has_proposals boolean default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_viewer_id uuid := auth.uid();
  v_role text;
  v_offset integer;
  v_total bigint;
  v_items jsonb;
  v_search text;
  v_page integer := greatest(coalesce(p_page, 1), 1);
  v_page_size integer := greatest(least(coalesce(p_page_size, 20), 100), 1);
  v_body jsonb;
begin
  if v_viewer_id is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;

  select pr.role into v_role
  from public.profiles pr
  where pr.id = v_viewer_id;

  if v_role is null then
    raise exception 'Profile not found' using errcode = '42501';
  end if;

  v_offset := (v_page - 1) * v_page_size;
  v_search := nullif(trim(lower(coalesce(p_search, ''))), '');

  with scoped as (
    select
      sr.id,
      sr.status as sr_status,
      sr.title,
      sr.description,
      sr.created_at,
      sr.photos,
      cs.status as cs_status,
      cs.provider_id as cs_provider_id,
      public.derive_service_list_phase(
        sr.status,
        cs.status,
        v_role,
        v_viewer_id,
        cs.provider_id
      ) as list_phase
    from public.service_requests sr
    left join public.contracted_services cs on cs.id = sr.contracted_service_id
    left join public.client_addresses ca on ca.id = sr.address_id
    left join public.platform_cities pc on pc.id = ca.city_id
    left join public.platform_services ps on ps.id = sr.service_id
    where
      (
        v_role = 'client'
        and sr.client_id = v_viewer_id
      )
      or (
        v_role = 'provider'
        and (
          exists (
            select 1
            from public.provider_proposals pp
            where pp.service_request_id = sr.id
              and pp.provider_id = v_viewer_id
          )
          or exists (
            select 1
            from public.contracted_services cs2
            where cs2.service_request_id = sr.id
              and cs2.provider_id = v_viewer_id
          )
        )
      )
      or public.is_platform_admin()
  ),
  filtered as (
    select s.*
    from scoped s
    left join public.service_requests sr on sr.id = s.id
    left join public.client_addresses ca on ca.id = sr.address_id
    left join public.platform_cities pc on pc.id = ca.city_id
    left join public.platform_services ps on ps.id = sr.service_id
    where
      (p_list_phase is null or btrim(p_list_phase) = '' or s.list_phase = btrim(p_list_phase))
      and (
        v_search is null
        or lower(sr.title) like '%' || v_search || '%'
        or lower(coalesce(sr.description, '')) like '%' || v_search || '%'
      )
      and (p_category_title is null or btrim(p_category_title) = '' or ps.title = btrim(p_category_title))
      and (p_city_name is null or btrim(p_city_name) = '' or pc.name = btrim(p_city_name))
      and (p_neighborhood is null or btrim(p_neighborhood) = '' or ca.neighborhood = btrim(p_neighborhood))
      and (p_date_from is null or sr.created_at >= p_date_from::timestamptz)
      and (p_date_to is null or sr.created_at < (p_date_to + interval '1 day'))
      and (
        p_has_images is null
        or (
          p_has_images = true
          and sr.photos is not null
          and cardinality(sr.photos) > 0
        )
        or (
          p_has_images = false
          and (sr.photos is null or cardinality(sr.photos) = 0)
        )
      )
      and (
        p_has_proposals is null
        or (
          p_has_proposals = true
          and (
            (v_role = 'client' and exists (
              select 1 from public.provider_proposals pp
              where pp.service_request_id = sr.id
            ))
            or (v_role = 'provider' and exists (
              select 1 from public.provider_proposals pp
              where pp.service_request_id = sr.id and pp.provider_id = v_viewer_id
            ))
          )
        )
        or (
          p_has_proposals = false
          and not (
            (v_role = 'client' and exists (
              select 1 from public.provider_proposals pp
              where pp.service_request_id = sr.id
            ))
            or (v_role = 'provider' and exists (
              select 1 from public.provider_proposals pp
              where pp.service_request_id = sr.id and pp.provider_id = v_viewer_id
            ))
          )
        )
      )
  )
  select count(*) into v_total from filtered;

  select coalesce(
    jsonb_agg(public.project_service_row(f.id, v_viewer_id) order by sr.updated_at desc),
    '[]'::jsonb
  )
  into v_items
  from (
    select f.id
    from filtered f
    join public.service_requests sr on sr.id = f.id
    order by sr.updated_at desc
    limit v_page_size
    offset v_offset
  ) f;

  v_body := jsonb_build_object(
    'items', v_items,
    'total_count', v_total,
    'page', v_page,
    'page_size', v_page_size
  );

  return public.cns_assert_list_response_size(v_body);
end;
$$;

comment on function public.get_service(uuid) is
  'Returns unified service payload for client or provider viewer by service_request id.';

comment on function public.list_services(integer, integer, text, text, text, text, text, date, date, boolean, boolean) is
  'Paginated unified service list scoped by viewer role (client owns SR or provider has proposal/contract).';

revoke all on function public.get_service(uuid) from public;
grant execute on function public.get_service(uuid) to authenticated;

revoke all on function public.list_services(integer, integer, text, text, text, text, text, date, date, boolean, boolean) from public;
grant execute on function public.list_services(integer, integer, text, text, text, text, text, date, date, boolean, boolean) to authenticated;

revoke all on function public.project_service_row(uuid, uuid) from public;
revoke all on function public.service_viewer_has_access(uuid, uuid) from public;
revoke all on function public.derive_service_list_phase(public.service_request_status, public.contracted_service_status, text, uuid, uuid) from public;

drop function if exists public.client_my_services_cancelled_ids(uuid);

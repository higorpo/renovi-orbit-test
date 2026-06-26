-- Baseline dump captured at migration 20260723120000
CREATE OR REPLACE FUNCTION public.match_provider_jobs(p_provider_id uuid, p_lat double precision, p_lng double precision, p_radius_km integer DEFAULT 10, p_service_id uuid DEFAULT NULL::uuid, p_sort_mode text DEFAULT 'nearest'::text, p_page_size integer DEFAULT 20, p_page integer DEFAULT 1)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'extensions'
AS $function$
declare
  v_result jsonb;
  v_provider_point geography;
  v_offset integer;
  v_sort text;
begin
  v_sort := case
    when p_sort_mode in ('nearest', 'newest', 'least_competitive') then p_sort_mode
    else 'nearest'
  end;
  p_page := greatest(p_page, 1);
  p_page_size := least(greatest(p_page_size, 1), 50);
  p_radius_km := least(greatest(p_radius_km, 1), 100);

  v_provider_point := st_setsrid(st_makepoint(p_lng, p_lat), 4326)::geography;
  v_offset := (p_page - 1) * p_page_size;

  with offered_services as (
    select pos.service_id
    from provider_offered_services pos
    where pos.provider_id = p_provider_id
  ),
  provider_city_ids as (
    select distinct pn.city_id
    from provider_service_area_neighborhoods psan
    join platform_neighborhoods pn on pn.id = psan.neighborhood_id
    where psan.provider_id = p_provider_id
  ),
  provider_area_names as (
    select
      pn.city_id,
      lower(trim(pn.name)) as normalized_name
    from provider_service_area_neighborhoods psan
    join platform_neighborhoods pn on pn.id = psan.neighborhood_id
    where psan.provider_id = p_provider_id
  ),
  provider_proposed_ids as (
    select pp.service_request_id
    from provider_proposals pp
    where pp.provider_id = p_provider_id
      and pp.status <> 'REVISED'::public.proposal_status
  ),
  eligible_base as (
    select
      sr.id,
      sr.title,
      sr.description,
      sr.service_id,
      sr.photos,
      sr.form_data,
      sr.form_schema,
      sr.urgency,
      sr.scope_complexity,
      sr.estimated_duration_hint,
      sr.tags,
      sr.suggested_equipment,
      sr.suggested_materials,
      sr.created_at,
      ca.neighborhood as address_neighborhood,
      pc.name as city_name,
      pst.abbreviation as state_abbreviation,
      s.title as service_title,
      s.slug as service_slug,
      s.icon_key as service_icon_key,
      s.color_key as service_color_key,
      s.parent_id as service_parent_id,
      (
        split_part(p.full_name, ' ', 1) ||
        case
          when array_length(string_to_array(p.full_name, ' '), 1) > 1
          then ' ' || left(
            split_part(
              p.full_name, ' ',
              array_length(string_to_array(p.full_name, ' '), 1)
            ), 1
          ) || '.'
          else ''
        end
      ) as masked_client_name,
      round(
        (st_distance(sr.location, v_provider_point) / 1000.0)::numeric, 1
      ) as distance_km,
      exists (
        select 1
        from provider_area_names pan
        where pan.city_id = ca.city_id
          and pan.normalized_name = lower(trim(ca.neighborhood))
      ) as exact_area_match
    from service_requests sr
    join client_addresses ca on ca.id = sr.address_id
    join platform_cities pc on pc.id = ca.city_id
    join platform_states pst on pst.id = ca.state_id
    join platform_services s on s.id = sr.service_id
    join profiles p on p.id = sr.client_id
    where
      sr.status = 'OPEN'::public.service_request_status
      and sr.location is not null
      and st_dwithin(sr.location, v_provider_point, p_radius_km * 1000)
      and (p_service_id is null or sr.service_id = p_service_id)
      and (
        sr.service_id in (select os.service_id from offered_services os)
        or s.parent_id in (select os.service_id from offered_services os)
      )
      and ca.city_id in (select pci.city_id from provider_city_ids pci)
      and not exists (
        select 1
        from provider_proposed_ids ppi
        where ppi.service_request_id = sr.id
      )
  ),
  proposal_counts as (
    select
      pp.service_request_id,
      count(*)::integer as active_count
    from provider_proposals pp
    join eligible_base eb on eb.id = pp.service_request_id
    where pp.status in (
      'PENDING'::public.proposal_status,
      'REVISION_REQUESTED'::public.proposal_status
    )
    group by pp.service_request_id
  ),
  eligible as (
    select
      eb.*,
      coalesce(pc_agg.active_count, 0)::integer as proposal_count,
      pp_latest.id as provider_proposal_id,
      pp_latest.proposed_amount as provider_proposed_amount,
      pp_latest.tax_rate as provider_tax_rate,
      pp_latest.tax_amount as provider_tax_amount,
      pp_latest.final_amount as provider_final_amount,
      pp_latest.proposal_description as provider_proposal_description,
      pp_latest.proposal_duration_value as provider_proposal_duration_value,
      pp_latest.proposal_duration_unit as provider_proposal_duration_unit,
      pp_latest.proposal_suggested_slots as provider_proposal_suggested_slots,
      pp_latest.photos as provider_proposal_photos,
      pp_latest.status as provider_proposal_status,
      pp_latest.client_rejection_response as provider_proposal_client_rejection_response
    from eligible_base eb
    left join proposal_counts pc_agg on pc_agg.service_request_id = eb.id
    left join lateral (
      select
        pp.id,
        pp.proposed_amount,
        pp.tax_rate,
        pp.tax_amount,
        pp.final_amount,
        pp.proposal_description,
        pp.proposal_duration_value,
        pp.proposal_duration_unit,
        pp.proposal_suggested_slots,
        pp.photos,
        pp.status,
        pp.client_rejection_response
      from provider_proposals pp
      where pp.service_request_id = eb.id
        and pp.provider_id = p_provider_id
      order by pp.updated_at desc, pp.created_at desc
      limit 1
    ) pp_latest on true
  ),
  total as (
    select count(*)::integer as cnt from eligible
  ),
  sorted as (
    select *
    from eligible
    order by
      case when v_sort = 'nearest' then distance_km end asc nulls last,
      case when v_sort = 'least_competitive' then proposal_count end asc nulls last,
      case when v_sort = 'newest' then extract(epoch from created_at) end desc nulls last,
      created_at desc,
      distance_km asc nulls last
    limit p_page_size
    offset v_offset
  )
  select jsonb_build_object(
    'items', coalesce(
      (select jsonb_agg(
        jsonb_build_object(
          'id', s.id,
          'title', s.title,
          'description', s.description,
          'service_id', s.service_id,
          'service_title', s.service_title,
          'service_slug', s.service_slug,
          'service_icon_key', s.service_icon_key,
          'service_color_key', s.service_color_key,
          'service_parent_id', s.service_parent_id,
          'photos', s.photos,
          'form_data', s.form_data,
          'form_schema', s.form_schema,
          'urgency', s.urgency,
          'scope_complexity', s.scope_complexity,
          'estimated_duration_hint', s.estimated_duration_hint,
          'tags', s.tags,
          'suggested_equipment', s.suggested_equipment,
          'suggested_materials', s.suggested_materials,
          'masked_client_name', s.masked_client_name,
          'neighborhood', s.address_neighborhood,
          'city', s.city_name,
          'state', s.state_abbreviation,
          'distance_km', s.distance_km,
          'proposal_count', s.proposal_count,
          'provider_proposal_id', s.provider_proposal_id,
          'provider_proposed_amount', s.provider_proposed_amount,
          'provider_tax_rate', s.provider_tax_rate,
          'provider_tax_amount', s.provider_tax_amount,
          'provider_final_amount', s.provider_final_amount,
          'provider_proposal_description', s.provider_proposal_description,
          'provider_proposal_duration_value', s.provider_proposal_duration_value,
          'provider_proposal_duration_unit', s.provider_proposal_duration_unit,
          'provider_proposal_suggested_slots', s.provider_proposal_suggested_slots,
          'provider_proposal_photos', s.provider_proposal_photos,
          'provider_proposal_status', s.provider_proposal_status,
          'provider_proposal_client_rejection_response', s.provider_proposal_client_rejection_response,
          'is_latest_provider_proposal', case when s.provider_proposal_id is not null then true else null end,
          'exact_area_match', s.exact_area_match,
          'created_at', s.created_at
        )
      ) from sorted s),
      '[]'::jsonb
    ),
    'total_count', (select cnt from total),
    'page', p_page,
    'page_size', p_page_size
  ) into v_result;

  return v_result;
end;
$function$

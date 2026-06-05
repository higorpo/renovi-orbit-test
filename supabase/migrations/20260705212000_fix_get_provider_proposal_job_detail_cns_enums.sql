-- Align get_provider_proposal_job_detail with CNS proposal_status and service_request_status enums.
-- Legacy lowercase values (withdrawn, rejected, open) cause 22P02 invalid enum input errors.

create or replace function public.get_provider_proposal_job_detail(
  p_proposal_id uuid default null,
  p_service_request_id uuid default null,
  p_lat double precision default null,
  p_lng double precision default null,
  p_radius_km integer default 10
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, extensions
as $$
declare
  v_provider_id uuid;
  v_sr_id uuid;
  v_point geography;
  v_radius integer;
  v_pp_id uuid;
  v_result jsonb;
begin
  v_provider_id := (select auth.uid());

  if v_provider_id is null then
    raise exception 'Authentication required' using errcode = '28000';
  end if;

  if not exists (
    select 1 from public.profiles pr
    where pr.id = v_provider_id and pr.role = 'provider'
  ) then
    raise exception 'Only providers can load this resource' using errcode = '42501';
  end if;

  if p_proposal_id is null and p_service_request_id is null then
    raise exception 'Either p_proposal_id or p_service_request_id must be provided' using errcode = '22000';
  end if;

  v_radius := least(greatest(coalesce(p_radius_km, 10), 1), 100);

  if p_lat is not null and p_lng is not null then
    v_point := st_setsrid(st_makepoint(p_lng, p_lat), 4326)::geography;
  else
    v_point := null;
  end if;

  -- Resolve target service request and optional proposal row id
  if p_proposal_id is not null then
    select pp.service_request_id, pp.id
    into v_sr_id, v_pp_id
    from public.provider_proposals pp
    where pp.id = p_proposal_id and pp.provider_id = v_provider_id;
    if v_sr_id is null then
      return null;
    end if;
  else
    v_sr_id := p_service_request_id;
    select pp.id
    into v_pp_id
    from public.provider_proposals pp
    where pp.provider_id = v_provider_id and pp.service_request_id = v_sr_id
    order by pp.updated_at desc, pp.created_at desc
    limit 1;
  end if;

  -- Case A: provider has a proposal row — return without match filters
  if v_pp_id is not null then
    select
      jsonb_build_object(
        'id', sr.id,
        'title', sr.title,
        'description', sr.description,
        'service_id', sr.service_id,
        'service_title', s.title,
        'service_slug', s.slug,
        'service_icon_key', s.icon_key,
        'service_color_key', s.color_key,
        'service_parent_id', s.parent_id,
        'photos', sr.photos,
        'form_data', sr.form_data,
        'form_schema', sr.form_schema,
        'urgency', sr.urgency,
        'scope_complexity', sr.scope_complexity,
        'estimated_duration_hint', sr.estimated_duration_hint,
        'tags', to_jsonb(sr.tags),
        'suggested_equipment', to_jsonb(sr.suggested_equipment),
        'suggested_materials', to_jsonb(sr.suggested_materials),
        'masked_client_name', (
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
        ),
        'neighborhood', coalesce(ca.neighborhood, ''),
        'city', coalesce(pc.name, ''),
        'state', coalesce(pst.abbreviation::text, ''),
        'distance_km', case
          when sr.location is not null and v_point is not null then
            round((st_distance(sr.location, v_point) / 1000.0)::numeric, 1)
          else 0
        end,
        'proposal_count', (
          select count(*)::integer
          from public.provider_proposals pp2
          where pp2.service_request_id = sr.id
            and pp2.status in (
              'PENDING'::public.proposal_status,
              'REVISION_REQUESTED'::public.proposal_status
            )
        ),
        'provider_proposal_id', pp.id,
        'provider_proposed_amount', pp.proposed_amount,
        'provider_tax_rate', pp.tax_rate,
        'provider_tax_amount', pp.tax_amount,
        'provider_final_amount', pp.final_amount,
        'provider_proposal_description', pp.proposal_description,
        'provider_proposal_duration_value', pp.proposal_duration_value,
        'provider_proposal_duration_unit', pp.proposal_duration_unit,
        'provider_proposal_suggested_slots', pp.proposal_suggested_slots,
        'provider_proposal_photos', to_jsonb(pp.photos),
        'provider_proposal_status', pp.status,
        'provider_proposal_client_rejection_response', pp.client_rejection_response,
        'provider_proposal_revision_reason', pp.revision_reason,
        'provider_proposal_revision_notes', pp.revision_notes,
        'is_latest_provider_proposal', (
          pp.id = (
            select pp_max.id
            from public.provider_proposals pp_max
            where pp_max.provider_id = v_provider_id
              and pp_max.service_request_id = sr.id
            order by pp_max.updated_at desc, pp_max.created_at desc
            limit 1
          )
        ),
        'exact_area_match', exists (
          select 1
          from public.provider_service_area_neighborhoods psan
          join public.platform_neighborhoods pn on pn.id = psan.neighborhood_id
          where psan.provider_id = v_provider_id
            and ca.id is not null
            and pn.city_id = ca.city_id
            and lower(trim(pn.name)) = lower(trim(ca.neighborhood))
        ),
        'created_at', sr.created_at
      )
    into v_result
    from public.provider_proposals pp
    inner join public.service_requests sr on sr.id = pp.service_request_id
    inner join public.platform_services s on s.id = sr.service_id
    inner join public.profiles p on p.id = sr.client_id
    left join public.client_addresses ca on ca.id = sr.address_id
    left join public.platform_cities pc on pc.id = ca.city_id
    left join public.platform_states pst on pst.id = ca.state_id
    where pp.id = v_pp_id and pp.provider_id = v_provider_id;

    return v_result;
  end if;

  -- Case B: no proposal — same eligibility as match feed (single-row lookup)
  select
    jsonb_build_object(
      'id', sr.id,
      'title', sr.title,
      'description', sr.description,
      'service_id', sr.service_id,
      'service_title', s.title,
      'service_slug', s.slug,
      'service_icon_key', s.icon_key,
      'service_color_key', s.color_key,
      'service_parent_id', s.parent_id,
      'photos', sr.photos,
      'form_data', sr.form_data,
      'form_schema', sr.form_schema,
      'urgency', sr.urgency,
      'scope_complexity', sr.scope_complexity,
      'estimated_duration_hint', sr.estimated_duration_hint,
      'tags', to_jsonb(sr.tags),
      'suggested_equipment', to_jsonb(sr.suggested_equipment),
      'suggested_materials', to_jsonb(sr.suggested_materials),
      'masked_client_name', (
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
      ),
      'neighborhood', coalesce(ca.neighborhood, ''),
      'city', coalesce(pc.name, ''),
      'state', coalesce(pst.abbreviation::text, ''),
      'distance_km', round((st_distance(sr.location, v_point) / 1000.0)::numeric, 1),
      'proposal_count', coalesce(pc_agg.active_count, 0),
      'provider_proposal_id', null,
      'provider_proposed_amount', null,
      'provider_tax_rate', null,
      'provider_tax_amount', null,
      'provider_final_amount', null,
      'provider_proposal_description', null,
      'provider_proposal_duration_value', null,
      'provider_proposal_duration_unit', null,
      'provider_proposal_suggested_slots', null,
      'provider_proposal_photos', null,
      'provider_proposal_status', null,
      'provider_proposal_client_rejection_response', null,
      'provider_proposal_revision_reason', null,
      'provider_proposal_revision_notes', null,
      'is_latest_provider_proposal', null,
      'exact_area_match', exists (
        select 1
        from public.provider_service_area_neighborhoods psan
        join public.platform_neighborhoods pn on pn.id = psan.neighborhood_id
        where psan.provider_id = v_provider_id
          and pn.city_id = ca.city_id
          and lower(trim(pn.name)) = lower(trim(ca.neighborhood))
      ),
      'created_at', sr.created_at
    )
  into v_result
  from public.service_requests sr
  inner join public.client_addresses ca on ca.id = sr.address_id
  inner join public.platform_cities pc on pc.id = ca.city_id
  inner join public.platform_states pst on pst.id = ca.state_id
  inner join public.platform_services s on s.id = sr.service_id
  inner join public.profiles p on p.id = sr.client_id
  cross join lateral (
    select count(*)::integer as active_count
    from public.provider_proposals pp2
    where pp2.service_request_id = sr.id
      and pp2.status in (
        'PENDING'::public.proposal_status,
        'REVISION_REQUESTED'::public.proposal_status
      )
  ) pc_agg
  where sr.id = v_sr_id
    and sr.status = 'OPEN'::public.service_request_status
    and sr.location is not null
    and v_point is not null
    and st_dwithin(sr.location, v_point, v_radius * 1000)
    and (
      sr.service_id in (select pos.service_id from public.provider_offered_services pos where pos.provider_id = v_provider_id)
      or s.parent_id in (select pos.service_id from public.provider_offered_services pos where pos.provider_id = v_provider_id)
    )
    and ca.city_id in (
      select distinct pn.city_id
      from public.provider_service_area_neighborhoods psan
      join public.platform_neighborhoods pn on pn.id = psan.neighborhood_id
      where psan.provider_id = v_provider_id
    )
    and not exists (
      select 1
      from public.provider_proposals ppi
      where ppi.service_request_id = sr.id
        and ppi.provider_id = v_provider_id
        and ppi.status <> 'REVISED'::public.proposal_status
    );

  return v_result;
end;
$$;

comment on function public.get_provider_proposal_job_detail(uuid, uuid, double precision, double precision, integer) is
  'Provider job detail: own proposal (any status) or eligible open request without proposal. Used instead of match_provider_jobs single-id lookup.';

revoke all on function public.get_provider_proposal_job_detail(uuid, uuid, double precision, double precision, integer) from public;
revoke all on function public.get_provider_proposal_job_detail(uuid, uuid, double precision, double precision, integer) from anon;
grant execute on function public.get_provider_proposal_job_detail(uuid, uuid, double precision, double precision, integer) to authenticated;

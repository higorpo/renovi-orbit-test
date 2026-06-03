-- Remove provider service request questions feature and related storage/RPCs.

-- Drop question-specific RPCs (must run before dropping the table).
drop function if exists public.list_provider_service_request_questions(uuid);
drop function if exists public.create_provider_service_request_question(uuid, text);
drop function if exists public.can_provider_ask_question(uuid, uuid);
drop function if exists public.list_client_budget_questions(integer, integer, text, text);
drop function if exists public.respond_client_budget_question(uuid, text, text[]);
drop function if exists public.list_provider_own_questions(integer, integer, text, text);

-- Drop storage policies and bucket for client question response images.
drop policy if exists "Clients can insert own question response images" on storage.objects;
drop policy if exists "Clients can update own question response images" on storage.objects;
drop policy if exists "Clients can delete own question response images" on storage.objects;
drop policy if exists "Clients providers and admins can read question response images" on storage.objects;

delete from storage.objects where bucket_id = 'client-question-responses';
delete from storage.buckets where id = 'client-question-responses';

-- Drop table (cascades trigger, indexes, RLS policies).
drop table if exists public.provider_service_request_questions cascade;

-- Drop AI-suggested questions column (no longer used without the questions flow).
alter table public.service_requests drop column if exists suggested_questions;

-- Recreate budget detail RPC without questions payload.
create or replace function public.get_client_budget_service_request_detail(
  p_service_request_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_client_id uuid;
  v_result jsonb;
begin
  v_client_id := (select auth.uid());
  if v_client_id is null then
    raise exception 'Autenticação necessária' using errcode = '28000';
  end if;

  if not exists (
    select 1 from public.service_requests sr
    where sr.id = p_service_request_id and sr.client_id = v_client_id
  ) then
    raise exception 'Forbidden' using errcode = '42501';
  end if;

  with sr as (
    select
      sr.id,
      sr.title,
      sr.description,
      sr.status,
      sr.created_at,
      ps.title as service_title,
      ps.slug as service_slug,
      ps.icon_key as service_icon_key,
      ps.color_key as service_color_key,
      ca.neighborhood,
      pc.name as city,
      pst.abbreviation::text as state_abbr
    from public.service_requests sr
    join public.platform_services ps on ps.id = sr.service_id
    left join public.client_addresses ca on ca.id = sr.address_id
    left join public.platform_cities pc on pc.id = ca.city_id
    left join public.platform_states pst on pst.id = ca.state_id
    where sr.id = p_service_request_id
  ),
  budgets as (
    select
      pp.id,
      pp.provider_id,
      coalesce(ppub.display_name, p.full_name, 'Prestador') as provider_name,
      ppub.slug as provider_slug,
      p.profile_image_path as provider_profile_image_path,
      pp.proposed_amount,
      pp.status,
      pp.created_at,
      pp.proposal_description,
      pp.photos,
      pp.client_response_deadline_at
    from public.provider_proposals pp
    join public.profiles p on p.id = pp.provider_id
    left join public.provider_profiles_public ppub on ppub.provider_id = pp.provider_id
    where pp.service_request_id = p_service_request_id
    order by pp.created_at desc
  )
  select jsonb_build_object(
    'service_request', (select to_jsonb(sr.*) from sr),
    'budgets', coalesce((select jsonb_agg(to_jsonb(budgets.*)) from budgets), '[]'::jsonb)
  )
  into v_result;

  return v_result;
end;
$$;

create or replace function public.match_provider_jobs(
  p_provider_id uuid,
  p_lat double precision,
  p_lng double precision,
  p_radius_km integer default 10,
  p_service_id uuid default null,
  p_sort_mode text default 'nearest',
  p_page_size integer default 20,
  p_page integer default 1
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, extensions
as $$
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
$$;

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
            and pp2.status not in ('withdrawn', 'rejected')
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
      and pp2.status not in ('withdrawn', 'rejected')
  ) pc_agg
  where sr.id = v_sr_id
    and sr.status = 'open'
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
        and ppi.status <> 'withdrawn'
    );

  return v_result;
end;
$$;

comment on function public.get_provider_proposal_job_detail(uuid, uuid, double precision, double precision, integer) is
  'Provider job detail: own proposal (any status) or eligible open request without proposal. Used instead of match_provider_jobs single-id lookup.';

revoke all on function public.get_provider_proposal_job_detail(uuid, uuid, double precision, double precision, integer) from public;
revoke all on function public.get_provider_proposal_job_detail(uuid, uuid, double precision, double precision, integer) from anon;
grant execute on function public.get_provider_proposal_job_detail(uuid, uuid, double precision, double precision, integer) to authenticated;

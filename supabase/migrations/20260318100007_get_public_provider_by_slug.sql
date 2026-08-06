-- RPC to fetch public provider profile by slug (respects visibility).
-- Returns a single JSONB with base profile, offered services, public portfolio items,
-- and rating aggregates (via SECURITY DEFINER; no client SELECT on provider_rating_stats).
-- Used by the public profile page; no direct read of profiles table for other users.

create or replace function public.get_public_provider_by_slug(slug_param text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  pub public.provider_profiles_public%rowtype;
  visible boolean;
  result jsonb;
  profile_row record;
  service_area_cities text[];
  service_area_regions text[];
  service_area_neighborhoods text[];
  services_json jsonb;
  portfolio_json jsonb;
  v_rating_count int := 0;
  v_rating_avg numeric(4, 2) := null;
  v_completed_services_count int := 0;
begin
  select * into pub from public.provider_profiles_public p where p.slug = slug_param limit 1;
  if not found then
    return null;
  end if;

  visible := pub.profile_visibility = 'public'
    or (pub.profile_visibility = 'restricted' and auth.role() = 'authenticated');
  if not visible then
    return null;
  end if;

  select full_name, profile_image_path, created_at into profile_row
  from public.profiles where id = pub.provider_id limit 1;
  if not found then
    return null;
  end if;

  select
    array_agg(distinct c.name order by c.name),
    array_agg(distinct st.abbreviation order by st.abbreviation),
    array_agg(distinct n.name order by n.name)
  into service_area_cities, service_area_regions, service_area_neighborhoods
  from public.provider_service_area_neighborhoods psn
  join public.platform_neighborhoods n on n.id = psn.neighborhood_id
  join public.platform_cities c on c.id = n.city_id
  join public.platform_states st on st.id = c.state_id
  where psn.provider_id = pub.provider_id;

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'service_id', s.id,
        'title', s.title,
        'icon_key', s.icon_key,
        'color_key', s.color_key
      )
      order by pos.sort_order
    ),
    '[]'::jsonb
  ) into services_json
  from public.provider_offered_services pos
  join public.platform_services s on s.id = pos.service_id and s.active = true
  where pos.provider_id = pub.provider_id;

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'id', pi.id,
        'title', pi.title,
        'description', pi.description,
        'service_id', pi.service_id,
        'execution_date', pi.execution_date,
        'image_paths', pi.image_paths,
        'city_region', pi.city_region,
        'sort_order', pi.sort_order
      ) order by pi.sort_order, pi.created_at
    ),
    '[]'::jsonb
  ) into portfolio_json
  from public.provider_portfolio_items pi
  where pi.provider_id = pub.provider_id and pi.visibility = 'public';

  select
    coalesce(prs.rating_count, 0),
    case
      when coalesce(prs.rating_count, 0) > 0 then prs.overall_avg
      else null
    end
  into v_rating_count, v_rating_avg
  from public.provider_rating_stats prs
  where prs.provider_id = pub.provider_id;

  select count(*)::int
  into v_completed_services_count
  from public.contracted_services cs
  where cs.provider_id = pub.provider_id
    and cs.status = 'COMPLETED'::public.contracted_service_status;

  result := jsonb_build_object(
    'provider_id', pub.provider_id,
    'slug', pub.slug,
    'display_name', pub.display_name,
    'bio', pub.bio,
    'profile_visibility', pub.profile_visibility,
    'service_area_cities', service_area_cities,
    'service_area_regions', service_area_regions,
    'service_area_neighborhoods', service_area_neighborhoods,
    'full_name', profile_row.full_name,
    'profile_image_path', profile_row.profile_image_path,
    'created_at', profile_row.created_at,
    'offered_services', services_json,
    'portfolio_items', portfolio_json,
    'rating_avg', v_rating_avg,
    'rating_count', v_rating_count,
    'completed_services_count', v_completed_services_count
  );
  return result;
end;
$$;

comment on function public.get_public_provider_by_slug(text) is
  'Returns public provider profile by slug when visible (incl. rating_avg/count and completed_services_count); null if not found or restricted for current user.';

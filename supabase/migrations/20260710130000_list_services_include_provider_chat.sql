-- Include provider chats (without proposal) in list_services scope for Meus Serviços pipeline.

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
set statement_timeout = '30s'
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
          or exists (
            select 1
            from public.chats c
            where c.service_request_id = sr.id
              and c.provider_id = v_viewer_id
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
  ),
  page_ids as (
    select f.id
    from filtered f
    order by public.service_row_last_activity_at(f.id, v_viewer_id, v_role) desc nulls last, f.id desc
    limit v_page_size
    offset v_offset
  )
  select
    (select count(*) from filtered),
    coalesce(
      (
        select jsonb_agg(
          public.project_service_row(p.id, v_viewer_id)
          order by public.service_row_last_activity_at(p.id, v_viewer_id, v_role) desc nulls last, p.id desc
        )
        from page_ids p
      ),
      '[]'::jsonb
    )
  into v_total, v_items;

  v_body := jsonb_build_object(
    'items', v_items,
    'total_count', v_total,
    'page', v_page,
    'page_size', v_page_size
  );

  return public.cns_assert_list_response_size(v_body);
end;
$$;

comment on function public.list_services(integer, integer, text, text, text, text, text, date, date, boolean, boolean) is
  'Paginated unified service list scoped by viewer role. Provider scope: proposal, contract, or chat on the service request.';

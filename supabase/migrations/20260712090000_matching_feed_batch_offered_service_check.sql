-- Batch feed arm: require current provider_offered_services (fix stale jobs after service removal).

create or replace function public.matching_provider_has_opportunity_access(
  p_provider_id uuid,
  p_service_request_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    exists (
      select 1
      from public.service_request_provider_visibility v
      join public.service_requests sr on sr.id = v.service_request_id
      join public.service_request_dispatches d on d.service_request_id = sr.id
      join public.provider_offered_services pos
        on pos.provider_id = p_provider_id
        and pos.service_id = sr.service_id
      where v.provider_id = p_provider_id
        and v.service_request_id = p_service_request_id
        and v.source = 'batch'
        and v.revoked_at is null
        and v.dismissed_at is null
        and sr.status = 'OPEN'::public.service_request_status
        and d.status not in (
          'DISPATCH_MATCHED'::public.service_request_dispatch_status,
          'DISPATCH_CANCELLED'::public.service_request_dispatch_status
        )
    )
    or exists (
      select 1
      from public.service_request_dispatches d
      join public.service_requests sr on sr.id = d.service_request_id
      join public.client_addresses ca on ca.id = sr.address_id
      join public.platform_neighborhoods pn
        on pn.city_id = ca.city_id
        and lower(trim(pn.name)) = lower(trim(ca.neighborhood))
      join public.provider_service_area_neighborhoods psan
        on psan.neighborhood_id = pn.id
        and psan.provider_id = p_provider_id
      join public.provider_offered_services pos
        on pos.provider_id = p_provider_id
        and pos.service_id = sr.service_id
      where d.service_request_id = p_service_request_id
        and d.fallback_opened_at is not null
        and d.status <> 'DISPATCH_EXPIRED'::public.service_request_dispatch_status
        and d.status not in (
          'DISPATCH_MATCHED'::public.service_request_dispatch_status,
          'DISPATCH_CANCELLED'::public.service_request_dispatch_status
        )
        and sr.status = 'OPEN'::public.service_request_status
        and not exists (
          select 1
          from public.service_request_provider_visibility vis
          where vis.provider_id = p_provider_id
            and vis.service_request_id = sr.id
            and vis.source = 'batch'
            and vis.revoked_at is null
        )
        and not exists (
          select 1
          from public.service_request_provider_visibility vis
          where vis.provider_id = p_provider_id
            and vis.service_request_id = sr.id
            and vis.source = 'fallback_dismiss'
        )
    );
$$;

create or replace function public.list_provider_opportunities(
  p_provider_id uuid,
  p_lat double precision default null,
  p_lng double precision default null,
  p_sort_mode text default 'newest',
  p_cursor text default null,
  p_limit int default 20
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = public, extensions
as $$
declare
  v_role text := coalesce(auth.role(), '');
  v_provider_point geography;
  v_chat_window_hours int;
  v_limit int;
  v_sort text;
  v_cursor jsonb;
  v_items jsonb;
  v_has_more boolean;
  v_last record;
  v_next_cursor text;
begin
  if p_provider_id is null then
    return jsonb_build_object('items', '[]'::jsonb, 'next_cursor', null, 'has_more', false);
  end if;

  if v_role <> 'service_role' and (select auth.uid()) is distinct from p_provider_id then
    raise exception 'not authorized to list opportunities for this provider'
      using errcode = '42501';
  end if;

  if exists (
    select 1
    from public.profiles p
    where p.id = p_provider_id
      and p.operational_status = 'suspended'::public.provider_operational_status
  ) then
    return jsonb_build_object('items', '[]'::jsonb, 'next_cursor', null, 'has_more', false);
  end if;

  v_limit := least(
    greatest(coalesce(p_limit, 20), 1),
    public.platform_constant_int('matching.feed_page_max', 50)
  );
  v_chat_window_hours := public.platform_constant_int('matching.dispatch_active_chat_window_hours', 24);
  v_sort := case
    when p_sort_mode in ('newest', 'nearest', 'least_competitive') then p_sort_mode
    else 'newest'
  end;

  if v_sort = 'nearest' and (p_lat is null or p_lng is null) then
    raise exception 'nearest sort requires p_lat and p_lng'
      using errcode = '22023';
  end if;

  if p_lat is not null and p_lng is not null then
    v_provider_point := st_setsrid(st_makepoint(p_lng, p_lat), 4326)::geography;
  end if;

  if nullif(btrim(p_cursor), '') is not null then
    v_cursor := public.matching_decode_feed_cursor(p_cursor);
    if v_cursor->>'sort' is distinct from v_sort then
      raise exception 'invalid feed cursor'
        using errcode = '22023';
    end if;
  end if;

  create temp table if not exists _matching_feed_page (
    service_request_id uuid,
    title text,
    description text,
    service_name text,
    service_icon_key text,
    service_color_key text,
    neighborhood text,
    urgency text,
    granted_at timestamptz,
    distance_km numeric,
    active_chat_count_24h int,
    source text
  ) on commit drop;

  truncate _matching_feed_page;

  insert into _matching_feed_page
  with chat_counts as (
    select
      c.service_request_id,
      count(*)::int as active_chat_count_24h
    from public.chats c
    where c.status = 'ACTIVE'::public.cns_conversation_status
      and c.last_interaction_at >= now() - (v_chat_window_hours || ' hours')::interval
      and exists (
        select 1
        from public.chat_messages m
        where m.chat_id = c.id
      )
    group by c.service_request_id
  ),
  feed_candidates as (
    select
      sr.id as service_request_id,
      sr.title,
      nullif(btrim(sr.description), '') as description,
      ps.title as service_name,
      ps.icon_key as service_icon_key,
      ps.color_key as service_color_key,
      coalesce(nullif(btrim(ca.neighborhood), ''), '—') as neighborhood,
      sr.urgency::text as urgency,
      v.granted_at,
      case
        when v_provider_point is not null and sr.location is not null then
          round((st_distance(sr.location, v_provider_point) / 1000.0)::numeric, 1)
        else null
      end as distance_km,
      coalesce(cc.active_chat_count_24h, 0) as active_chat_count_24h,
      'batch'::text as source
    from public.service_request_provider_visibility v
    join public.service_requests sr on sr.id = v.service_request_id
    join public.service_request_dispatches d on d.service_request_id = sr.id
    join public.platform_services ps on ps.id = sr.service_id
    join public.client_addresses ca on ca.id = sr.address_id
    join public.provider_offered_services pos
      on pos.provider_id = p_provider_id
      and pos.service_id = sr.service_id
    left join chat_counts cc on cc.service_request_id = sr.id
    where v.provider_id = p_provider_id
      and v.source = 'batch'
      and v.revoked_at is null
      and v.dismissed_at is null
      and sr.status = 'OPEN'::public.service_request_status
      and d.status not in (
        'DISPATCH_MATCHED'::public.service_request_dispatch_status,
        'DISPATCH_CANCELLED'::public.service_request_dispatch_status
      )
      and not exists (
        select 1
        from public.provider_proposals pp
        where pp.provider_id = p_provider_id
          and pp.service_request_id = sr.id
          and pp.status in (
            'PENDING'::public.proposal_status,
            'REVISION_REQUESTED'::public.proposal_status
          )
      )
      and not exists (
        select 1
        from public.chats c
        where c.service_request_id = sr.id
          and c.provider_id = p_provider_id
          and c.status = 'ACTIVE'::public.cns_conversation_status
          and c.last_interaction_at >= now() - (v_chat_window_hours || ' hours')::interval
          and exists (
            select 1
            from public.chat_messages m
            where m.chat_id = c.id
          )
      )
      and not exists (
        select 1
        from public.provider_proposals pp
        where pp.provider_id = p_provider_id
          and pp.service_request_id = sr.id
          and pp.status <> 'REVISED'::public.proposal_status
      )
    union all
    select
      sr.id as service_request_id,
      sr.title,
      nullif(btrim(sr.description), '') as description,
      ps.title as service_name,
      ps.icon_key as service_icon_key,
      ps.color_key as service_color_key,
      coalesce(nullif(btrim(ca.neighborhood), ''), '—') as neighborhood,
      sr.urgency::text as urgency,
      d.fallback_opened_at as granted_at,
      case
        when v_provider_point is not null and sr.location is not null then
          round((st_distance(sr.location, v_provider_point) / 1000.0)::numeric, 1)
        else null
      end as distance_km,
      coalesce(cc.active_chat_count_24h, 0) as active_chat_count_24h,
      'fallback'::text as source
    from public.service_request_dispatches d
    join public.service_requests sr on sr.id = d.service_request_id
    join public.platform_services ps on ps.id = sr.service_id
    join public.client_addresses ca on ca.id = sr.address_id
    left join chat_counts cc on cc.service_request_id = sr.id
    join public.platform_neighborhoods pn
      on pn.city_id = ca.city_id
      and lower(trim(pn.name)) = lower(trim(ca.neighborhood))
    join public.provider_service_area_neighborhoods psan
      on psan.neighborhood_id = pn.id
      and psan.provider_id = p_provider_id
    join public.provider_offered_services pos
      on pos.provider_id = p_provider_id
      and pos.service_id = sr.service_id
    where d.fallback_opened_at is not null
      and d.status <> 'DISPATCH_EXPIRED'::public.service_request_dispatch_status
      and d.status not in (
        'DISPATCH_MATCHED'::public.service_request_dispatch_status,
        'DISPATCH_CANCELLED'::public.service_request_dispatch_status
      )
      and sr.status = 'OPEN'::public.service_request_status
      and not exists (
        select 1
        from public.service_request_provider_visibility vis
        where vis.provider_id = p_provider_id
          and vis.service_request_id = sr.id
          and vis.source = 'batch'
          and vis.revoked_at is null
      )
      and not exists (
        select 1
        from public.service_request_provider_visibility vis
        where vis.provider_id = p_provider_id
          and vis.service_request_id = sr.id
          and vis.source = 'fallback_dismiss'
      )
      and not exists (
        select 1
        from public.provider_proposals pp
        where pp.provider_id = p_provider_id
          and pp.service_request_id = sr.id
          and pp.status in (
            'PENDING'::public.proposal_status,
            'REVISION_REQUESTED'::public.proposal_status
          )
      )
      and not exists (
        select 1
        from public.chats c
        where c.service_request_id = sr.id
          and c.provider_id = p_provider_id
          and c.status = 'ACTIVE'::public.cns_conversation_status
          and c.last_interaction_at >= now() - (v_chat_window_hours || ' hours')::interval
          and exists (
            select 1
            from public.chat_messages m
            where m.chat_id = c.id
          )
      )
      and not exists (
        select 1
        from public.provider_proposals pp
        where pp.provider_id = p_provider_id
          and pp.service_request_id = sr.id
          and pp.status <> 'REVISED'::public.proposal_status
      )
  ),
  filtered as (
    select fc.*
    from feed_candidates fc
    where v_cursor is null
      or (
        v_sort = 'newest'
        and (
          fc.granted_at < (v_cursor->>'k1')::timestamptz
          or (
            fc.granted_at = (v_cursor->>'k1')::timestamptz
            and fc.service_request_id > (v_cursor->>'sr_id')::uuid
          )
        )
      )
      or (
        v_sort = 'nearest'
        and (
          coalesce(fc.distance_km, 999999999::numeric) > (v_cursor->>'k1')::numeric
          or (
            coalesce(fc.distance_km, 999999999::numeric) = (v_cursor->>'k1')::numeric
            and fc.service_request_id > (v_cursor->>'sr_id')::uuid
          )
        )
      )
      or (
        v_sort = 'least_competitive'
        and (
          fc.active_chat_count_24h > (v_cursor->>'k1')::int
          or (
            fc.active_chat_count_24h = (v_cursor->>'k1')::int
            and fc.service_request_id > (v_cursor->>'sr_id')::uuid
          )
        )
      )
  ),
  ranked as (
    select *
    from filtered
    order by
      case when v_sort = 'newest' then granted_at end desc,
      case when v_sort = 'nearest' then coalesce(distance_km, 999999999::numeric) end asc,
      case when v_sort = 'least_competitive' then active_chat_count_24h end asc,
      service_request_id asc
    limit v_limit + 1
  )
  select
    service_request_id,
    title,
    description,
    service_name,
    service_icon_key,
    service_color_key,
    neighborhood,
    urgency,
    granted_at,
    distance_km,
    active_chat_count_24h,
    source
  from ranked;

  select count(*) > v_limit into v_has_more from _matching_feed_page;

  select coalesce(
    (
      select jsonb_agg(
        jsonb_build_object(
          'service_request_id', p.service_request_id,
          'title', p.title,
          'description', p.description,
          'service_name', p.service_name,
          'service_icon_key', p.service_icon_key,
          'service_color_key', p.service_color_key,
          'neighborhood', p.neighborhood,
          'urgency', p.urgency,
          'granted_at', p.granted_at,
          'distance_km', p.distance_km,
          'active_chat_count_24h', p.active_chat_count_24h,
          'source', p.source
        )
        order by
          case when v_sort = 'newest' then p.granted_at end desc,
          case when v_sort = 'nearest' then coalesce(p.distance_km, 999999999::numeric) end asc,
          case when v_sort = 'least_competitive' then p.active_chat_count_24h end asc,
          p.service_request_id asc
      )
      from (
        select *
        from _matching_feed_page
        limit v_limit
      ) p
    ),
    '[]'::jsonb
  )
  into v_items;

  if coalesce(v_has_more, false) then
    select *
    into v_last
    from _matching_feed_page
    order by
      case when v_sort = 'newest' then granted_at end desc,
      case when v_sort = 'nearest' then coalesce(distance_km, 999999999::numeric) end asc,
      case when v_sort = 'least_competitive' then active_chat_count_24h end asc,
      service_request_id asc
    offset v_limit - 1
    limit 1;

    v_next_cursor := public.matching_encode_feed_cursor(
      jsonb_build_object(
        'sort', v_sort,
        'k1', case v_sort
          when 'newest' then to_jsonb(v_last.granted_at)
          when 'nearest' then to_jsonb(coalesce(v_last.distance_km, 999999999::numeric))
          when 'least_competitive' then to_jsonb(v_last.active_chat_count_24h)
        end,
        'sr_id', v_last.service_request_id
      )
    );
  end if;

  return jsonb_build_object(
    'items', coalesce(v_items, '[]'::jsonb),
    'next_cursor', v_next_cursor,
    'has_more', coalesce(v_has_more, false)
  );
end;
$$;

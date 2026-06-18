-- Matching M12a–c — list_provider_opportunities feed RPC (design §15.3).

create or replace function public.matching_encode_feed_cursor(p_payload jsonb)
returns text
language sql
immutable
strict
set search_path = public
as $$
  select rtrim(
    replace(
      replace(
        replace(
          replace(
            replace(encode(convert_to(p_payload::text, 'UTF8'), 'base64'), E'\n', ''),
            E'\r',
            ''
          ),
          '+',
          '-'
        ),
        '/',
        '_'
      ),
      '=',
      ''
    ),
    '='
  );
$$;

comment on function public.matching_encode_feed_cursor(jsonb) is
  'Base64url-encodes opaque provider feed cursor payload.';

create or replace function public.matching_decode_feed_cursor(p_cursor text)
returns jsonb
language plpgsql
stable
set search_path = public
as $$
declare
  v_normalized text;
  v_json text;
  v_payload jsonb;
begin
  if nullif(btrim(p_cursor), '') is null then
    return null;
  end if;

  v_normalized := replace(replace(p_cursor, '-', '+'), '_', '/');
  v_normalized := v_normalized || repeat('=', (4 - length(v_normalized) % 4) % 4);

  begin
    v_json := convert_from(decode(v_normalized, 'base64'), 'UTF8');
    v_payload := v_json::jsonb;
  exception
    when others then
      raise exception 'invalid feed cursor'
        using errcode = '22023';
  end;

  if v_payload->>'sort' not in ('newest', 'nearest', 'least_competitive') then
    raise exception 'invalid feed cursor'
      using errcode = '22023';
  end if;

  if nullif(btrim(v_payload->>'sr_id'), '') is null then
    raise exception 'invalid feed cursor'
      using errcode = '22023';
  end if;

  if v_payload->'k1' is null then
    raise exception 'invalid feed cursor'
      using errcode = '22023';
  end if;

  return v_payload;
end;
$$;

comment on function public.matching_decode_feed_cursor(text) is
  'Decodes provider feed cursor; raises 22023 when malformed.';

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

comment on function public.matching_provider_has_opportunity_access(uuid, uuid) is
  'True when provider would see the SR in list_provider_opportunities (batch or fallback arm).';

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

comment on function public.list_provider_opportunities(
  uuid,
  double precision,
  double precision,
  text,
  text,
  int
) is
  'Provider opportunities feed with batch/fallback union, sort modes, and keyset cursor pagination.';

revoke all on function public.matching_encode_feed_cursor(jsonb)
  from public, anon, authenticated;
revoke all on function public.matching_decode_feed_cursor(text)
  from public, anon, authenticated;
revoke all on function public.matching_provider_has_opportunity_access(uuid, uuid)
  from public, anon, authenticated;
revoke all on function public.list_provider_opportunities(
  uuid,
  double precision,
  double precision,
  text,
  text,
  int
) from public, anon, authenticated;
grant execute on function public.matching_encode_feed_cursor(jsonb) to service_role;
grant execute on function public.matching_decode_feed_cursor(text) to service_role;
grant execute on function public.matching_provider_has_opportunity_access(uuid, uuid) to service_role;
grant execute on function public.list_provider_opportunities(
  uuid,
  double precision,
  double precision,
  text,
  text,
  int
) to service_role;

-- Matching M12d — record_provider_opportunity_view audit RPC (design §15.4).

create or replace function public.record_provider_opportunity_view(
  p_service_request_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_provider_id uuid := auth.uid();
  v_dispatch_id uuid;
begin
  if v_provider_id is null then
    raise exception 'Authentication required'
      using errcode = '28000';
  end if;

  if not exists (
    select 1
    from public.profiles p
    where p.id = v_provider_id
      and p.role = 'provider'
  ) then
    raise exception 'Only providers may record opportunity views'
      using errcode = '42501';
  end if;

  if p_service_request_id is null then
    return jsonb_build_object('success', true);
  end if;

  select d.id
  into v_dispatch_id
  from public.service_request_dispatches d
  where d.service_request_id = p_service_request_id;

  if v_dispatch_id is null then
    return jsonb_build_object('success', true);
  end if;

  insert into public.service_request_dispatch_events (
    dispatch_id,
    service_request_id,
    provider_id,
    event_type,
    payload
  )
  values (
    v_dispatch_id,
    p_service_request_id,
    v_provider_id,
    'provider_viewed',
    '{}'::jsonb
  )
  on conflict (service_request_id, provider_id)
    where event_type = 'provider_viewed'
  do nothing;

  return jsonb_build_object('success', true);
end;
$$;

comment on function public.record_provider_opportunity_view(uuid) is
  'Idempotent provider_viewed audit when opening opportunity detail; get_service has no side effects.';

revoke all on function public.record_provider_opportunity_view(uuid) from public;
grant execute on function public.record_provider_opportunity_view(uuid) to authenticated;

-- Matching M12e — dismiss_provider_opportunity feed RPC (design §15.4).

create or replace function public.dismiss_provider_opportunity(
  p_service_request_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_provider_id uuid := auth.uid();
  v_visibility_id uuid;
  v_dispatch_id uuid;
  v_fallback_eligible boolean;
  v_dismissed boolean := false;
begin
  if v_provider_id is null then
    raise exception 'Authentication required'
      using errcode = '28000';
  end if;

  if not exists (
    select 1
    from public.profiles p
    where p.id = v_provider_id
      and p.role = 'provider'
  ) then
    raise exception 'Only providers may dismiss opportunities'
      using errcode = '42501';
  end if;

  if p_service_request_id is null then
    return jsonb_build_object('success', true);
  end if;

  select v.id
  into v_visibility_id
  from public.service_request_provider_visibility v
  where v.service_request_id = p_service_request_id
    and v.provider_id = v_provider_id
    and v.source = 'batch'
    and v.revoked_at is null
  for update;

  if found then
    update public.service_request_provider_visibility
    set dismissed_at = coalesce(dismissed_at, now())
    where id = v_visibility_id;
    v_dismissed := true;
  else
    select exists (
      select 1
      from public.service_request_dispatches d
      join public.service_requests sr on sr.id = d.service_request_id
      join public.client_addresses ca on ca.id = sr.address_id
      join public.platform_neighborhoods pn
        on pn.city_id = ca.city_id
        and lower(trim(pn.name)) = lower(trim(ca.neighborhood))
      join public.provider_service_area_neighborhoods psan
        on psan.neighborhood_id = pn.id
        and psan.provider_id = v_provider_id
      join public.provider_offered_services pos
        on pos.provider_id = v_provider_id
        and pos.service_id = sr.service_id
      where d.service_request_id = p_service_request_id
        and d.fallback_opened_at is not null
        and d.status <> 'DISPATCH_EXPIRED'::public.service_request_dispatch_status
        and d.status not in (
          'DISPATCH_MATCHED'::public.service_request_dispatch_status,
          'DISPATCH_CANCELLED'::public.service_request_dispatch_status
        )
        and sr.status = 'OPEN'::public.service_request_status
    )
    into v_fallback_eligible;

    if v_fallback_eligible
      and not exists (
        select 1
        from public.service_request_provider_visibility vis
        where vis.provider_id = v_provider_id
          and vis.service_request_id = p_service_request_id
          and vis.source = 'fallback_dismiss'
      )
    then
      insert into public.service_request_provider_visibility (
        service_request_id,
        provider_id,
        source,
        dismissed_at
      )
      values (
        p_service_request_id,
        v_provider_id,
        'fallback_dismiss',
        now()
      );
      v_dismissed := true;
    end if;
  end if;

  if not v_dismissed then
    return jsonb_build_object('success', true);
  end if;

  select d.id
  into v_dispatch_id
  from public.service_request_dispatches d
  where d.service_request_id = p_service_request_id;

  if v_dispatch_id is not null then
    insert into public.service_request_dispatch_events (
      dispatch_id,
      service_request_id,
      provider_id,
      event_type,
      payload
    )
    values (
      v_dispatch_id,
      p_service_request_id,
      v_provider_id,
      'provider_declined',
      '{}'::jsonb
    )
    on conflict (service_request_id, provider_id)
      where event_type = 'provider_declined'
    do nothing;
  end if;

  return jsonb_build_object('success', true);
end;
$$;

comment on function public.dismiss_provider_opportunity(uuid) is
  'Feed-only dismiss: batch visibility dismissed_at or fallback_dismiss marker; idempotent.';

revoke all on function public.dismiss_provider_opportunity(uuid) from public;
grant execute on function public.dismiss_provider_opportunity(uuid) to authenticated;

-- Enrich view-services list payload: provider proposal/chat summary + last_activity ordering.

create or replace function public.service_row_last_activity_at(
  p_service_request_id uuid,
  p_viewer_id uuid,
  p_viewer_role text
)
returns timestamptz
language sql
stable
security definer
set search_path = public
as $$
  select greatest(
    sr.updated_at,
    coalesce(
      case
        when p_viewer_role = 'client' then (
          select max(pp.updated_at)
          from public.provider_proposals pp
          where pp.service_request_id = p_service_request_id
        )
        when p_viewer_role = 'provider' then (
          select max(pp.updated_at)
          from public.provider_proposals pp
          where pp.service_request_id = p_service_request_id
            and pp.provider_id = p_viewer_id
        )
        else null
      end,
      sr.updated_at
    ),
    coalesce(
      case
        when p_viewer_role = 'client' then (
          select max(c.last_interaction_at)
          from public.chats c
          where c.service_request_id = p_service_request_id
            and c.client_id = p_viewer_id
        )
        when p_viewer_role = 'provider' then (
          select max(c.last_interaction_at)
          from public.chats c
          where c.service_request_id = p_service_request_id
            and c.provider_id = p_viewer_id
        )
        else null
      end,
      sr.updated_at
    )
  )
  from public.service_requests sr
  where sr.id = p_service_request_id;
$$;

comment on function public.service_row_last_activity_at(uuid, uuid, text) is
  'Latest activity timestamp for a service row scoped by viewer role (proposals, chat, request update).';

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
  v_provider_sees_full_address boolean := true;
  v_last_activity_at timestamptz;
  v_negotiation jsonb;
  v_my_proposal jsonb := null;
  v_chat jsonb := null;
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

  if v_role = 'provider' then
    v_provider_sees_full_address := v_cs.id is not null and v_cs.provider_id = p_viewer_id;
  end if;

  v_list_phase := public.derive_service_list_phase(
    v_sr.status,
    case when v_cs.id is null then null else v_cs.status end,
    v_role,
    p_viewer_id,
    v_cs.provider_id
  );

  v_last_activity_at := public.service_row_last_activity_at(
    p_service_request_id,
    p_viewer_id,
    v_role
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

    select jsonb_build_object(
      'id', pp.id,
      'status', pp.status,
      'final_amount', pp.final_amount,
      'updated_at', pp.updated_at,
      'expired_at', pp.expired_at
    )
    into v_my_proposal
    from public.provider_proposals pp
    where pp.service_request_id = p_service_request_id
      and pp.provider_id = p_viewer_id
    order by pp.updated_at desc
    limit 1;

    select jsonb_build_object(
      'id', chat_row.id,
      'is_unread', chat_row.is_unread,
      'last_interaction_at', chat_row.last_interaction_at
    )
    into v_chat
    from (
      select
        c.id,
        c.last_interaction_at,
        coalesce(
          last_msg.created_at is not null
          and (
            rr.last_read_at is null
            or last_msg.created_at > rr.last_read_at
          ),
          false
        ) as is_unread
      from public.chats c
      left join public.chat_read_receipts rr
        on rr.chat_id = c.id
        and rr.user_id = p_viewer_id
      left join lateral (
        select m.created_at
        from public.chat_messages m
        where m.chat_id = c.id
        order by m.created_at desc, m.id desc
        limit 1
      ) last_msg on true
      where c.service_request_id = p_service_request_id
        and c.provider_id = p_viewer_id
      order by c.last_interaction_at desc, c.id desc
      limit 1
    ) chat_row;
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
      'updated_at', cs.updated_at,
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

  v_negotiation := jsonb_build_object(
    'proposal_count', v_proposal_count,
    'has_pending_proposal', v_has_pending,
    'last_activity_at', v_last_activity_at
  );

  if v_role = 'provider' then
    v_negotiation := v_negotiation
      || jsonb_build_object(
        'my_proposal', v_my_proposal,
        'chat', v_chat
      );
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
      'cancelled_at', v_sr.cancelled_at,
      'completed_at', v_sr.completed_at,
      'urgency', v_sr.urgency,
      'tags', v_sr.tags,
      'scope_complexity', v_sr.scope_complexity,
      'estimated_duration_hint', v_sr.estimated_duration_hint,
      'missing_info_warnings', v_sr.missing_info_warnings,
      'status', v_sr.status,
      'contracted_service_id', v_sr.contracted_service_id,
      'address', (
        select case
          when v_role = 'provider' and not v_provider_sees_full_address then
            jsonb_build_object(
              'neighborhood', ca.neighborhood,
              'city_name', pc.name,
              'state_abbreviation', pst.abbreviation
            )
          else
            jsonb_build_object(
              'street', ca.street,
              'number', ca.number,
              'complement', ca.complement,
              'neighborhood', ca.neighborhood,
              'zip_code', ca.zip_code,
              'city_name', pc.name,
              'state_abbreviation', pst.abbreviation
            )
        end
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
    'negotiation', v_negotiation,
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

comment on function public.project_service_row(uuid, uuid) is
  'Builds unified service JSON. Provider viewers see masked address until contracted; negotiation includes my_proposal and chat when provider.';

revoke all on function public.service_row_last_activity_at(uuid, uuid, text) from public;
revoke all on function public.service_row_last_activity_at(uuid, uuid, text) from anon, authenticated;

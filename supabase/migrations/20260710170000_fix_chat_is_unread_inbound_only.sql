-- Fix chat is_unread: only inbound messages (not own sends) after read cursor count as unread.

create or replace function public.cns_chat_is_unread_for_user(
  p_chat_id uuid,
  p_user_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    exists (
      select 1
      from public.chat_messages inbound
      left join public.chat_read_receipts rr
        on rr.chat_id = p_chat_id
        and rr.user_id = p_user_id
      left join public.chat_messages read_anchor
        on read_anchor.id = rr.last_read_message_id
      where inbound.chat_id = p_chat_id
        and inbound.sender_user_id is distinct from p_user_id
        and (
          rr.chat_id is null
          or (
            rr.last_read_message_id is not null
            and read_anchor.id is not null
            and (inbound.created_at, inbound.id) > (read_anchor.created_at, read_anchor.id)
          )
          or (
            rr.last_read_message_id is null
            and (rr.last_read_at is null or inbound.created_at > rr.last_read_at)
          )
        )
    ),
    false
  );
$$;

comment on function public.cns_chat_is_unread_for_user(uuid, uuid) is
  'True when the viewer has unread inbound chat messages (excludes own sends; uses read receipt cursor).';

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
  v_counterparty_image_path text;
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
        ),
        prov.profile_image_path
      into v_counterparty_id, v_counterparty_name, v_counterparty_image_path
      from public.contracted_services cs
      join public.profiles prov on prov.id = cs.provider_id
      left join public.provider_profiles_public ppp on ppp.provider_id = cs.provider_id
      where cs.id = v_cs.id;
    else
      v_counterparty_id := null;
      v_counterparty_name := null;
      v_counterparty_image_path := null;
    end if;
  else
    select count(*)::int,
      coalesce(bool_or(pp.status = 'PENDING'::public.proposal_status), false)
    into v_proposal_count, v_has_pending
    from public.provider_proposals pp
    where pp.service_request_id = p_service_request_id
      and pp.provider_id = p_viewer_id;

    select v_sr.client_id,
      coalesce(nullif(btrim(cli.full_name), ''), 'Cliente'),
      cli.profile_image_path
    into v_counterparty_id, v_counterparty_name, v_counterparty_image_path
    from public.profiles cli
    where cli.id = v_sr.client_id;

    select jsonb_build_object(
      'id', pp.id,
      'status', pp.status,
      'final_amount', pp.final_amount,
      'updated_at', pp.updated_at,
      'expired_at', pp.expired_at,
      'submitted_at', pp.submitted_at,
      'revision_reason', pp.revision_reason,
      'revision_notes', pp.revision_notes,
      'client_rejection_response', pp.client_rejection_response
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
      'last_interaction_at', chat_row.last_interaction_at,
      'last_message_preview', chat_row.last_message_preview
    )
    into v_chat
    from (
      select
        c.id,
        c.last_interaction_at,
        public.cns_chat_is_unread_for_user(c.id, p_viewer_id) as is_unread,
        case
          when last_inbound.created_at is not null then
            public.cns_message_preview_text(last_inbound.message_type, last_inbound.payload)
          else null
        end as last_message_preview
      from public.chats c
      left join lateral (
        select m.created_at, m.message_type, m.payload
        from public.chat_messages m
        where m.chat_id = c.id
          and m.sender_user_id is distinct from p_viewer_id
        order by m.created_at desc, m.id desc
        limit 1
      ) last_inbound on true
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
    left join public.provider_profiles_public ppp on ppp.provider_id = cs.provider_id
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
      'urgency', v_sr.urgency,
      'tags', v_sr.tags,
      'scope_complexity', v_sr.scope_complexity,
      'estimated_duration_hint', v_sr.estimated_duration_hint,
      'missing_info_warnings', v_sr.missing_info_warnings,
      'status', v_sr.status,
      'cancelled_at', v_sr.cancelled_at,
      'completed_at', v_sr.completed_at,
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
        'display_name', v_counterparty_name,
        'profile_image_path', v_counterparty_image_path
      )
    end
  );
end;
$$;

create or replace function public.list_conversations(
  p_page_size integer default 20,
  p_cursor_last_interaction_at timestamptz default null,
  p_cursor_id uuid default null
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, auth
as $$
declare
  v_actor uuid := auth.uid();
  v_limit integer;
  v_items jsonb;
  v_has_more boolean := false;
  v_next_cursor jsonb;
  v_result jsonb;
begin
  if v_actor is null then
    raise exception 'Authentication required for list_conversations'
      using errcode = '42501';
  end if;

  v_limit := least(greatest(coalesce(p_page_size, 20), 1), 100);

  if p_cursor_last_interaction_at is not null and p_cursor_id is null then
    raise exception 'p_cursor_id is required when p_cursor_last_interaction_at is set'
      using errcode = '22023';
  end if;

  with filtered as (
    select
      c.id,
      c.service_request_id,
      c.client_id,
      c.provider_id,
      c.status,
      c.last_interaction_at,
      c.activated_at,
      c.inactivated_at,
      c.closed_at,
      c.created_at,
      c.updated_at,
      case
        when v_actor = c.client_id then c.provider_id
        else c.client_id
      end as counterparty_id,
      sr.title as service_request_title,
      ps.id as service_id,
      ps.title as service_title,
      ps.slug as service_slug,
      ps.icon_key as service_icon_key,
      ps.color_key as service_color_key,
      ps.image_url as service_image_url,
      last_msg.id as last_message_id,
      last_msg.message_type as last_message_type,
      last_msg.created_at as last_message_at,
      last_msg.linked_entity_type as last_message_linked_entity_type,
      last_msg.linked_entity_id as last_message_linked_entity_id,
      public.cns_message_preview_text(last_msg.message_type, last_msg.payload) as last_message_preview,
      public.cns_chat_is_unread_for_user(c.id, v_actor) as is_unread,
      rr.last_read_at
    from public.chats c
    inner join public.service_requests sr on sr.id = c.service_request_id
    inner join public.platform_services ps on ps.id = sr.service_id
    left join public.chat_read_receipts rr
      on rr.chat_id = c.id
      and rr.user_id = v_actor
    left join lateral (
      select
        m.id,
        m.message_type,
        m.created_at,
        m.payload,
        m.linked_entity_type,
        m.linked_entity_id
      from public.chat_messages m
      where m.chat_id = c.id
      order by m.created_at desc, m.id desc
      limit 1
    ) last_msg on true
    where v_actor in (c.client_id, c.provider_id)
      and (
        p_cursor_last_interaction_at is null
        or (c.last_interaction_at, c.id) < (p_cursor_last_interaction_at, p_cursor_id)
      )
    order by c.last_interaction_at desc, c.id desc
    limit v_limit + 1
  ),
  page_rows as (
    select *
    from filtered
    limit v_limit
  ),
  page_count as (
    select count(*)::integer as cnt from filtered
  )
  select
    coalesce(
      (
        select jsonb_agg(
          jsonb_build_object(
            'id', r.id,
            'service_request_id', r.service_request_id,
            'client_id', r.client_id,
            'provider_id', r.provider_id,
            'status', r.status,
            'last_interaction_at', r.last_interaction_at,
            'activated_at', r.activated_at,
            'inactivated_at', r.inactivated_at,
            'closed_at', r.closed_at,
            'created_at', r.created_at,
            'updated_at', r.updated_at,
            'counterparty', jsonb_build_object(
              'id', cp.id,
              'full_name', cp.full_name,
              'profile_image_path', cp.profile_image_path,
              'role', cp.role
            ),
            'service_request_title', r.service_request_title,
            'service', jsonb_build_object(
              'id', r.service_id,
              'title', r.service_title,
              'slug', r.service_slug,
              'icon_key', r.service_icon_key,
              'color_key', r.service_color_key,
              'image_url', r.service_image_url
            ),
            'last_message', case
              when r.last_message_id is null then null
              else jsonb_build_object(
                'id', r.last_message_id,
                'message_type', r.last_message_type,
                'created_at', r.last_message_at,
                'preview_text', r.last_message_preview,
                'linked_entity_type', r.last_message_linked_entity_type,
                'linked_entity_id', r.last_message_linked_entity_id
              )
            end,
            'is_unread', r.is_unread,
            'last_read_at', r.last_read_at
          )
          order by r.last_interaction_at desc, r.id desc
        )
        from page_rows r
        inner join public.profiles cp on cp.id = r.counterparty_id
      ),
      '[]'::jsonb
    ),
    (select cnt > v_limit from page_count),
    case
      when (select cnt > v_limit from page_count) then (
        select jsonb_build_object(
          'last_interaction_at', pr.last_interaction_at,
          'id', pr.id
        )
        from page_rows pr
        order by pr.last_interaction_at asc, pr.id asc
        limit 1
      )
      else null
    end
  into v_items, v_has_more, v_next_cursor;

  v_result := jsonb_build_object(
    'items', v_items,
    'has_more', v_has_more,
    'next_cursor', v_next_cursor
  );

  return public.cns_assert_list_response_size(v_result);
end;
$$;

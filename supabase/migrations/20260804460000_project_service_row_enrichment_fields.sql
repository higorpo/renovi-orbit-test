-- Service completion Task 46: lightweight enrichment_status / enrichment_ready
-- on project_service_row (get_service + list_services). No checklist_schema in list payloads.

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
  v_pending_proposal_count int := 0;
  v_chat_count int := 0;
  v_unread_chat_count int := 0;
  v_counterparty_id uuid;
  v_counterparty_name text;
  v_counterparty_image_path text;
  v_contracted_provider jsonb;
  v_provider_sees_full_address boolean := true;
  v_show_contracted boolean := false;
  v_last_activity_at timestamptz;
  v_negotiation jsonb;
  v_my_proposal jsonb := null;
  v_chat jsonb := null;
  v_enrichment_status text := null;
  v_enrichment_ready boolean := false;
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

  select e.status::text
  into v_enrichment_status
  from public.service_request_enrichments e
  where e.service_request_id = p_service_request_id;

  v_enrichment_ready := (v_enrichment_status = 'READY');

  if v_role = 'provider' then
    v_provider_sees_full_address := public.provider_sees_full_service_address(
      p_service_request_id,
      p_viewer_id
    );
  end if;

  v_show_contracted := v_role = 'client' or v_provider_sees_full_address;

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
      coalesce(bool_or(pp.status = 'PENDING'::public.proposal_status), false),
      count(*) filter (where pp.status = 'PENDING'::public.proposal_status)::int
    into v_proposal_count, v_has_pending, v_pending_proposal_count
    from public.provider_proposals pp
    where pp.service_request_id = p_service_request_id;

    select
      coalesce(count(*)::int, 0),
      coalesce(count(*) filter (where chat_row.is_unread)::int, 0)
    into v_chat_count, v_unread_chat_count
    from (
      select
        c.id,
        public.cns_chat_is_unread_for_user(c.id, p_viewer_id) as is_unread
      from public.chats c
      where c.service_request_id = p_service_request_id
        and c.client_id = p_viewer_id
    ) chat_row;

    select jsonb_build_object(
      'id', chat_row.id,
      'is_unread', chat_row.is_unread,
      'last_interaction_at', chat_row.last_interaction_at,
      'last_message_preview', chat_row.last_message_preview,
      'provider_display_name', chat_row.provider_display_name
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
        end as last_message_preview,
        coalesce(
          nullif(btrim(ppp.display_name), ''),
          nullif(btrim(prov.full_name), ''),
          'Profissional'
        ) as provider_display_name
      from public.chats c
      join public.profiles prov on prov.id = c.provider_id
      left join public.provider_profiles_public ppp on ppp.provider_id = c.provider_id
      left join lateral (
        select m.created_at, m.message_type, m.payload
        from public.chat_messages m
        where m.chat_id = c.id
          and m.sender_user_id is distinct from p_viewer_id
        order by m.created_at desc, m.id desc
        limit 1
      ) last_inbound on true
      where c.service_request_id = p_service_request_id
        and c.client_id = p_viewer_id
      order by is_unread desc, last_inbound.created_at desc nulls last, c.last_interaction_at desc, c.id desc
      limit 1
    ) chat_row;

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
    select coalesce(bool_or(pp.status = 'PENDING'::public.proposal_status), false)
    into v_has_pending
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
      and pp.status <> 'REVISED'::public.proposal_status
    order by pp.version desc, pp.created_at desc, pp.id desc
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

  if v_cs.id is not null and v_show_contracted then
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
      'payment_schedule_state', (
        select ps.state
        from public.payment_schedules ps
        where ps.contracted_service_id = cs.id
          and not public.payment_schedule_state_is_terminal(ps.state)
        order by ps.created_at desc
        limit 1
      ),
      'far_recapture_pending', (
        exists (
          select 1
          from public.payment_schedules ps
          where ps.contracted_service_id = cs.id
            and ps.state = 'PAID'::public.payment_schedule_state
            and ps.far_recapture_pending_at is not null
        )
      ),
      'chat_id', (
        select c.id
        from public.chats c
        where c.service_request_id = p_service_request_id
          and c.provider_id = cs.provider_id
        order by c.last_interaction_at desc, c.id desc
        limit 1
      ),
      'final_amount', (
        select pp.final_amount
        from public.provider_proposals pp
        where pp.id = cs.accepted_proposal_id
      ),
      'provider', jsonb_build_object(
        'id', cs.provider_id,
        'display_name', coalesce(
          nullif(btrim(ppp.display_name), ''),
          nullif(btrim(prov.full_name), ''),
          'Profissional'
        ),
        'profile_image_path', prov.profile_image_path,
        'slug', ppp.slug
      ),
      'reschedule', public.cns_service_reschedule_snapshot_for_viewer(cs.id, p_viewer_id),
      'client_rating_overall_score', (
        select sr.overall_score
        from public.service_ratings sr
        where sr.contracted_service_id = cs.id
      ),
      'client_rating_submitted_at', (
        select sr.submitted_at
        from public.service_ratings sr
        where sr.contracted_service_id = cs.id
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

  if v_role = 'client' then
    v_negotiation := jsonb_build_object(
      'proposal_count', v_proposal_count,
      'has_pending_proposal', v_has_pending,
      'last_activity_at', v_last_activity_at,
      'pending_proposal_count', v_pending_proposal_count,
      'chat_count', v_chat_count,
      'unread_chat_count', v_unread_chat_count,
      'chat', v_chat
    );
  elsif v_role = 'provider' then
    v_negotiation := jsonb_build_object(
      'has_pending_proposal', v_has_pending,
      'last_activity_at', v_last_activity_at,
      'my_proposal', v_my_proposal,
      'chat', v_chat
    );
  else
    v_negotiation := jsonb_build_object(
      'proposal_count', v_proposal_count,
      'has_pending_proposal', v_has_pending,
      'last_activity_at', v_last_activity_at
    );
  end if;

  return jsonb_build_object(
    'id', v_sr.id,
    'list_phase', v_list_phase,
    'enrichment_status', v_enrichment_status,
    'enrichment_ready', v_enrichment_ready,
    'request', jsonb_build_object(
      'title', v_sr.title,
      'description', v_sr.description,
      'form_data', v_sr.form_data,
      'form_schema', v_sr.form_schema,
      'photos', coalesce(v_sr.photos, '{}'::text[]),
      'created_at', v_sr.created_at,
      'updated_at', v_sr.updated_at,
      'urgency', v_sr.urgency,
      'scope_complexity', v_sr.scope_complexity,
      'estimated_duration_hint', v_sr.estimated_duration_hint,
      'missing_info_warnings', v_sr.missing_info_warnings,
      'status', v_sr.status,
      'cancelled_at', v_sr.cancelled_at,
      'completed_at', v_sr.completed_at,
      'contracted_service_id', case
        when v_show_contracted then v_sr.contracted_service_id
        else null
      end,
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
              'state_abbreviation', pst.abbreviation,
              'latitude', ca.latitude,
              'longitude', ca.longitude
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

comment on function public.project_service_row(uuid, uuid) is
  'Builds unified service JSON with enrichment fields, contracted final_amount, provider image/slug, and client_rating_* when present.';

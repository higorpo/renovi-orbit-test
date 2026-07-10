-- After reschedule accept, contracted_services.agreed_slot is the operational schedule.
-- Proposal selected_slot remains the initial accept snapshot; chat surfaces must show
-- the effective slot (agreed_slot when a contracted service exists).

create or replace function public._cns_effective_selected_slot_for_proposal(
  p_proposal_id uuid
)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(cs.agreed_slot, pp.selected_slot)
  from public.provider_proposals pp
  left join public.contracted_services cs
    on cs.accepted_proposal_id = pp.id
  where pp.id = p_proposal_id;
$$;

comment on function public._cns_effective_selected_slot_for_proposal(uuid) is
  'Returns agreed_slot from contracted_services when present, else proposal selected_slot.';

revoke all on function public._cns_effective_selected_slot_for_proposal(uuid)
  from public, anon, authenticated;
grant execute on function public._cns_effective_selected_slot_for_proposal(uuid)
  to service_role;

create or replace function public.get_conversation_detail(p_chat_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, auth
as $$
declare
  v_actor uuid := auth.uid();
  v_detail jsonb;
begin
  if v_actor is null then
    raise exception 'Authentication required for get_conversation_detail'
      using errcode = '42501';
  end if;

  if p_chat_id is null then
    raise exception 'p_chat_id is required'
      using errcode = '22023';
  end if;

  select jsonb_build_object(
    'conversation', jsonb_build_object(
      'id', c.id,
      'service_request_id', c.service_request_id,
      'client_id', c.client_id,
      'provider_id', c.provider_id,
      'status', c.status,
      'last_interaction_at', c.last_interaction_at,
      'activated_at', c.activated_at,
      'inactivated_at', c.inactivated_at,
      'inactivation_reason', c.inactivation_reason,
      'closed_at', c.closed_at,
      'closure_type', c.closure_type,
      'created_at', c.created_at,
      'updated_at', c.updated_at
    ),
    'counterparty', jsonb_build_object(
      'id', cp.id,
      'full_name', cp.full_name,
      'profile_image_path', cp.profile_image_path,
      'role', cp.role
    ),
    'service_request', jsonb_build_object(
      'id', sr.id,
      'title', sr.title
    ),
    'service', jsonb_build_object(
      'id', ps.id,
      'title', ps.title,
      'slug', ps.slug,
      'icon_key', ps.icon_key,
      'color_key', ps.color_key,
      'image_url', ps.image_url
    ),
    'category', case
      when parent_ps.id is null then null
      else jsonb_build_object(
        'id', parent_ps.id,
        'title', parent_ps.title,
        'slug', parent_ps.slug,
        'icon_key', parent_ps.icon_key,
        'color_key', parent_ps.color_key
      )
    end,
    'counterparty_read_receipt', case
      when crr.chat_id is not null then jsonb_build_object(
        'last_read_at', crr.last_read_at,
        'last_read_message_id', crr.last_read_message_id
      )
      else null
    end,
    'accepted_proposal', (
      select jsonb_strip_nulls(
        jsonb_build_object(
          'id', pp.id,
          'proposed_amount', pp.proposed_amount,
          'final_amount',
            case
              when v_actor = c.provider_id or (select public.is_platform_admin()) then pp.final_amount
            end,
          'selected_slot', public._cns_effective_selected_slot_for_proposal(pp.id)
        )
      )
      from public.provider_proposals pp
      where pp.service_request_id = c.service_request_id
        and pp.provider_id = c.provider_id
        and pp.status = 'ACCEPTED'
      limit 1
    )
  )
  into v_detail
  from public.chats c
  inner join public.service_requests sr on sr.id = c.service_request_id
  inner join public.platform_services ps on ps.id = sr.service_id
  left join public.platform_services parent_ps on parent_ps.id = ps.parent_id
  inner join public.profiles cp on cp.id = case
    when v_actor = c.client_id then c.provider_id
    else c.client_id
  end
  left join public.chat_read_receipts crr
    on crr.chat_id = c.id
    and crr.user_id = cp.id
  where c.id = p_chat_id
    and v_actor in (c.client_id, c.provider_id);

  if v_detail is null then
    raise exception 'CONVERSATION_NOT_FOUND'
      using
        errcode = 'P0001',
        detail = jsonb_build_object('code', 'CONVERSATION_NOT_FOUND')::text;
  end if;

  return v_detail;
end;
$$;

comment on function public.get_conversation_detail(uuid) is
  'Participant header snapshot: counterparty, service/category, minimal SR id+title, optional accepted proposal with effective slot (R5-AC02).';

create or replace function public.get_proposal_detail_for_provider(p_proposal_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, auth
as $$
declare
  v_actor uuid := auth.uid();
  v_pp public.provider_proposals%rowtype;
  v_sla_hours int;
  v_anchor timestamptz;
  v_expires_at timestamptz;
begin
  if v_actor is null then
    raise exception 'Authentication required for get_proposal_detail_for_provider'
      using errcode = '42501';
  end if;

  if p_proposal_id is null then
    raise exception 'p_proposal_id is required'
      using errcode = '22023';
  end if;

  select *
  into v_pp
  from public.provider_proposals pp
  where pp.id = p_proposal_id;

  if not found then
    return null;
  end if;

  if not (
    (select public.is_platform_admin())
    or v_pp.provider_id = v_actor
  ) then
    raise exception 'PROPOSAL_NOT_FOUND'
      using
        errcode = 'P0001',
        detail = jsonb_build_object('code', 'PROPOSAL_NOT_FOUND')::text;
  end if;

  v_sla_hours := public.platform_constant_int('chats.proposal_response_sla_hours', 24);
  v_anchor := coalesce(v_pp.submitted_at, v_pp.created_at);
  v_expires_at := case
    when v_anchor is null then null
    else v_anchor + make_interval(hours => v_sla_hours)
  end;

  return jsonb_build_object(
    'id', v_pp.id,
    'service_request_id', v_pp.service_request_id,
    'provider_id', v_pp.provider_id,
    'status', v_pp.status,
    'version', v_pp.version,
    'revision_count', v_pp.revision_count,
    'revision_reason', v_pp.revision_reason,
    'revision_notes', v_pp.revision_notes,
    'submitted_at', v_pp.submitted_at,
    'expired_at', v_pp.expired_at,
    'expires_at', v_expires_at,
    'proposed_amount', v_pp.proposed_amount,
    'tax_rate', v_pp.tax_rate,
    'tax_amount', v_pp.tax_amount,
    'final_amount', v_pp.final_amount,
    'proposal_description', v_pp.proposal_description,
    'proposal_duration_unit', v_pp.proposal_duration_unit,
    'proposal_duration_value', v_pp.proposal_duration_value,
    'proposal_suggested_slots', v_pp.proposal_suggested_slots,
    'selected_slot', public._cns_effective_selected_slot_for_proposal(v_pp.id),
    'photos', coalesce(to_jsonb(v_pp.photos), '[]'::jsonb),
    'client_rejection_response', v_pp.client_rejection_response,
    'created_at', v_pp.created_at,
    'updated_at', v_pp.updated_at
  );
end;
$$;

comment on function public.get_proposal_detail_for_provider(uuid) is
  'Full provider proposal detail including pricing, client-response expires_at, and effective selected slot (agreed_slot when rescheduled).';

create or replace function public.get_proposal_detail_for_participant(p_proposal_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, auth
as $$
declare
  v_actor uuid := auth.uid();
  v_pp public.provider_proposals%rowtype;
  v_sr public.service_requests%rowtype;
  v_sla_hours int;
  v_anchor timestamptz;
  v_expires_at timestamptz;
begin
  if v_actor is null then
    raise exception 'Authentication required for get_proposal_detail_for_participant'
      using errcode = '42501';
  end if;

  if p_proposal_id is null then
    raise exception 'p_proposal_id is required'
      using errcode = '22023';
  end if;

  select *
  into v_pp
  from public.provider_proposals pp
  where pp.id = p_proposal_id;

  if not found then
    return null;
  end if;

  select *
  into v_sr
  from public.service_requests sr
  where sr.id = v_pp.service_request_id;

  if not found then
    return null;
  end if;

  if not (
    (select public.is_platform_admin())
    or v_pp.provider_id = v_actor
    or v_sr.client_id = v_actor
  ) then
    raise exception 'PROPOSAL_NOT_FOUND'
      using
        errcode = 'P0001',
        detail = jsonb_build_object('code', 'PROPOSAL_NOT_FOUND')::text;
  end if;

  v_sla_hours := public.platform_constant_int('chats.proposal_response_sla_hours', 24);
  v_anchor := coalesce(v_pp.submitted_at, v_pp.created_at);
  v_expires_at := case
    when v_anchor is null then null
    else v_anchor + make_interval(hours => v_sla_hours)
  end;

  return jsonb_build_object(
    'id', v_pp.id,
    'service_request_id', v_pp.service_request_id,
    'provider_id', v_pp.provider_id,
    'status', v_pp.status,
    'version', v_pp.version,
    'revision_count', v_pp.revision_count,
    'revision_reason', v_pp.revision_reason,
    'revision_notes', v_pp.revision_notes,
    'submitted_at', v_pp.submitted_at,
    'expired_at', v_pp.expired_at,
    'expires_at', v_expires_at,
    'proposed_amount', v_pp.proposed_amount,
    'proposal_description', v_pp.proposal_description,
    'proposal_duration_unit', v_pp.proposal_duration_unit,
    'proposal_duration_value', v_pp.proposal_duration_value,
    'proposal_suggested_slots', v_pp.proposal_suggested_slots,
    'selected_slot', public._cns_effective_selected_slot_for_proposal(v_pp.id),
    'photos', coalesce(to_jsonb(v_pp.photos), '[]'::jsonb),
    'client_rejection_response', v_pp.client_rejection_response,
    'created_at', v_pp.created_at,
    'updated_at', v_pp.updated_at
  );
end;
$$;

comment on function public.get_proposal_detail_for_participant(uuid) is
  'Client-safe proposal detail for chat participants with client-response expires_at and effective selected slot (agreed_slot when rescheduled).';

revoke all on function public.get_proposal_detail_for_participant(uuid) from public, anon;
grant execute on function public.get_proposal_detail_for_participant(uuid) to authenticated;

-- Platform constant helpers are server-side only (RPCs / service_role). Clients must not
-- read arbitrary keys; UI SLA comes from get_proposal_detail_* expires_at instead.
revoke all on function public.platform_constant_int(text, int) from public, anon, authenticated;
grant execute on function public.platform_constant_int(text, int) to service_role;

revoke all on function public.platform_constant_bool(text, boolean) from public, anon, authenticated;
grant execute on function public.platform_constant_bool(text, boolean) to service_role;

revoke all on function public.platform_constant_numeric(text, numeric) from public, anon, authenticated;
grant execute on function public.platform_constant_numeric(text, numeric) to service_role;

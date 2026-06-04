-- Remove legacy client_response_deadline_at (48h column + triggers dropped in 20260701101900).
-- SLA is enforced via submitted_at + chats.proposal_response_sla_hours (expire_pending_proposals, accept_proposal).

create or replace function public.reject_client_budget_proposal(
  p_proposal_id uuid,
  p_reason text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_client_id uuid;
  v_sr_id uuid;
  v_status public.proposal_status;
  v_submitted_at timestamptz;
  v_created_at timestamptz;
  v_sla_hours integer;
begin
  v_client_id := (select auth.uid());
  if v_client_id is null then
    raise exception 'Autenticação necessária' using errcode = '28000';
  end if;
  if not exists (select 1 from public.profiles p where p.id = v_client_id and p.role = 'client') then
    raise exception 'Apenas clientes podem recusar orçamentos' using errcode = '42501';
  end if;
  if p_proposal_id is null then
    raise exception 'Orçamento é obrigatório';
  end if;
  if p_reason is null or char_length(trim(p_reason)) = 0 then
    raise exception 'Motivo da recusa é obrigatório';
  end if;
  if char_length(trim(p_reason)) > 2000 then
    raise exception 'Motivo deve ter no máximo 2000 caracteres';
  end if;

  select
    pp.service_request_id,
    pp.status,
    pp.submitted_at,
    pp.created_at
  into v_sr_id, v_status, v_submitted_at, v_created_at
  from public.provider_proposals pp
  join public.service_requests sr on sr.id = pp.service_request_id
  where pp.id = p_proposal_id
    and sr.client_id = v_client_id
    and sr.status = 'OPEN'::public.service_request_status;

  if v_sr_id is null then
    raise exception 'Orçamento não encontrado para este pedido' using errcode = '42501';
  end if;

  if v_status <> 'PENDING'::public.proposal_status then
    raise exception 'Apenas orçamentos aguardando avaliação podem ser recusados';
  end if;

  v_sla_hours := public.platform_constant_int('chats.proposal_response_sla_hours', 24);

  if coalesce(v_submitted_at, v_created_at)
    + make_interval(hours => v_sla_hours) < now() then
    raise exception 'Prazo para responder este orçamento expirou';
  end if;

  update public.provider_proposals pp
  set
    status = 'REJECTED'::public.proposal_status,
    client_rejection_response = trim(p_reason),
    updated_at = now()
  where pp.id = p_proposal_id;

  return jsonb_build_object(
    'proposal_id', p_proposal_id,
    'service_request_id', v_sr_id,
    'status', 'REJECTED'
  );
end;
$$;

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
      pp.submitted_at,
      pp.created_at,
      pp.proposal_description,
      pp.photos
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
    'proposed_amount', v_pp.proposed_amount,
    'tax_rate', v_pp.tax_rate,
    'tax_amount', v_pp.tax_amount,
    'final_amount', v_pp.final_amount,
    'proposal_description', v_pp.proposal_description,
    'proposal_duration_unit', v_pp.proposal_duration_unit,
    'proposal_duration_value', v_pp.proposal_duration_value,
    'proposal_suggested_slots', v_pp.proposal_suggested_slots,
    'selected_slot', v_pp.selected_slot,
    'photos', coalesce(to_jsonb(v_pp.photos), '[]'::jsonb),
    'client_rejection_response', v_pp.client_rejection_response,
    'created_at', v_pp.created_at,
    'updated_at', v_pp.updated_at
  );
end;
$$;

create or replace function public.list_proposal_versions(p_chat_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, auth
as $$
declare
  v_actor uuid := auth.uid();
  v_is_provider boolean := false;
  v_items jsonb;
begin
  if v_actor is null then
    raise exception 'Authentication required for list_proposal_versions'
      using errcode = '42501';
  end if;

  if p_chat_id is null then
    raise exception 'p_chat_id is required'
      using errcode = '22023';
  end if;

  if not public.is_chat_participant(p_chat_id) then
    raise exception 'CONVERSATION_NOT_FOUND'
      using
        errcode = 'P0001',
        detail = jsonb_build_object('code', 'CONVERSATION_NOT_FOUND')::text;
  end if;

  select c.provider_id = v_actor
  into v_is_provider
  from public.chats c
  where c.id = p_chat_id;

  if v_is_provider or (select public.is_platform_admin()) then
    select coalesce(
      jsonb_agg(
        jsonb_build_object(
          'id', pp.id,
          'chat_id', p_chat_id,
          'service_request_id', pp.service_request_id,
          'provider_id', pp.provider_id,
          'status', pp.status,
          'version', pp.version,
          'revision_count', pp.revision_count,
          'revision_reason', pp.revision_reason,
          'revision_notes', pp.revision_notes,
          'submitted_at', pp.submitted_at,
          'expired_at', pp.expired_at,
          'selected_slot', pp.selected_slot,
          'proposed_amount', pp.proposed_amount,
          'tax_rate', pp.tax_rate,
          'tax_amount', pp.tax_amount,
          'final_amount', pp.final_amount,
          'proposal_description', pp.proposal_description,
          'proposal_duration_unit', pp.proposal_duration_unit,
          'proposal_duration_value', pp.proposal_duration_value,
          'proposal_suggested_slots', pp.proposal_suggested_slots,
          'photos', coalesce(to_jsonb(pp.photos), '[]'::jsonb),
          'client_rejection_response', pp.client_rejection_response,
          'created_at', pp.created_at,
          'updated_at', pp.updated_at
        )
        order by pp.version asc, pp.created_at asc
      ),
      '[]'::jsonb
    )
    into v_items
    from public.provider_proposals pp
    inner join public.chats c
      on c.id = p_chat_id
     and pp.service_request_id = c.service_request_id
     and pp.provider_id = c.provider_id;
  else
    select coalesce(
      jsonb_agg(
        jsonb_build_object(
          'id', pp.id,
          'chat_id', p_chat_id,
          'service_request_id', pp.service_request_id,
          'provider_id', pp.provider_id,
          'status', pp.status,
          'version', pp.version,
          'revision_count', pp.revision_count,
          'revision_reason', pp.revision_reason,
          'revision_notes', pp.revision_notes,
          'submitted_at', pp.submitted_at,
          'expired_at', pp.expired_at,
          'selected_slot', pp.selected_slot,
          'proposed_amount', pp.proposed_amount,
          'proposal_description', pp.proposal_description,
          'proposal_duration_unit', pp.proposal_duration_unit,
          'proposal_duration_value', pp.proposal_duration_value,
          'proposal_suggested_slots', pp.proposal_suggested_slots,
          'photos', coalesce(to_jsonb(pp.photos), '[]'::jsonb),
          'client_rejection_response', pp.client_rejection_response,
          'created_at', pp.created_at,
          'updated_at', pp.updated_at
        )
        order by pp.version asc, pp.created_at asc
      ),
      '[]'::jsonb
    )
    into v_items
    from public.provider_proposals pp
    inner join public.chats c
      on c.id = p_chat_id
     and pp.service_request_id = c.service_request_id
     and pp.provider_id = c.provider_id;
  end if;

  return jsonb_build_object('items', v_items);
end;
$$;

alter table public.provider_proposals
  drop column if exists client_response_deadline_at;

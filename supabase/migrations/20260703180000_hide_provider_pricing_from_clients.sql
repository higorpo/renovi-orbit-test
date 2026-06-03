-- Restrict provider pricing columns from direct PostgREST reads by authenticated users.
-- Clients read non-pricing columns via RLS; providers use security definer RPCs.

revoke select (tax_rate, tax_amount, final_amount, pricing_signature)
  on public.provider_proposals
  from authenticated;

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
    'photos', coalesce(to_jsonb(v_pp.photos), '[]'::jsonb),
    'client_rejection_response', v_pp.client_rejection_response,
    'client_response_deadline_at', v_pp.client_response_deadline_at,
    'created_at', v_pp.created_at,
    'updated_at', v_pp.updated_at
  );
end;
$$;

comment on function public.get_proposal_detail_for_provider(uuid) is
  'Full provider proposal detail including pricing; callable only by owning provider or platform admin.';

revoke all on function public.get_proposal_detail_for_provider(uuid) from public;
revoke all on function public.get_proposal_detail_for_provider(uuid) from anon;
grant execute on function public.get_proposal_detail_for_provider(uuid) to authenticated;

create or replace function public.list_provider_proposal_history(p_service_request_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, auth
as $$
declare
  v_actor uuid := auth.uid();
  v_items jsonb;
begin
  if v_actor is null then
    raise exception 'Authentication required for list_provider_proposal_history'
      using errcode = '42501';
  end if;

  if p_service_request_id is null then
    raise exception 'p_service_request_id is required'
      using errcode = '22023';
  end if;

  if not (
    (select public.is_platform_admin())
    or exists (
      select 1
      from public.provider_proposals pp
      where pp.service_request_id = p_service_request_id
        and pp.provider_id = v_actor
    )
  ) then
    raise exception 'PROPOSAL_NOT_FOUND'
      using
        errcode = 'P0001',
        detail = jsonb_build_object('code', 'PROPOSAL_NOT_FOUND')::text;
  end if;

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'id', pp.id,
        'proposed_amount', pp.proposed_amount,
        'proposal_description', pp.proposal_description,
        'proposal_duration_value', pp.proposal_duration_value,
        'proposal_duration_unit', pp.proposal_duration_unit,
        'proposal_suggested_slots', pp.proposal_suggested_slots,
        'status', pp.status,
        'tax_rate', pp.tax_rate,
        'tax_amount', pp.tax_amount,
        'final_amount', pp.final_amount,
        'photos', coalesce(to_jsonb(pp.photos), '[]'::jsonb),
        'created_at', pp.created_at,
        'updated_at', pp.updated_at,
        'client_rejection_response', pp.client_rejection_response
      )
      order by pp.updated_at desc
    ),
    '[]'::jsonb
  )
  into v_items
  from public.provider_proposals pp
  where pp.service_request_id = p_service_request_id
    and pp.provider_id = v_actor;

  return jsonb_build_object('items', v_items);
end;
$$;

comment on function public.list_provider_proposal_history(uuid) is
  'Provider proposal history for a service request, including pricing fields.';

revoke all on function public.list_provider_proposal_history(uuid) from public;
revoke all on function public.list_provider_proposal_history(uuid) from anon;
grant execute on function public.list_provider_proposal_history(uuid) to authenticated;

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
          'client_response_deadline_at', pp.client_response_deadline_at,
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
          'client_response_deadline_at', pp.client_response_deadline_at,
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

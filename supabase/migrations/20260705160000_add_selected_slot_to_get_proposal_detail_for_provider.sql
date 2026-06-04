-- Expose selected_slot in provider proposal detail RPC (timeline cards, dialogs).

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
    'client_response_deadline_at', v_pp.client_response_deadline_at,
    'created_at', v_pp.created_at,
    'updated_at', v_pp.updated_at
  );
end;
$$;

comment on function public.get_proposal_detail_for_provider(uuid) is
  'Full provider proposal detail including pricing and client selected_slot at accept; callable only by owning provider or platform admin.';

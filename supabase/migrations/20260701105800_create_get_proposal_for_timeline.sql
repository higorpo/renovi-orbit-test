-- CNS Wave C — task 61: timeline proposal hydration RPC (design §5.1; Req. 16, 22).
-- Depends on provider_proposals CNS evolution (task 14).

create or replace function public.get_proposal_for_timeline(
  p_chat_id uuid,
  p_proposal_id uuid
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, auth
as $$
declare
  v_actor uuid := auth.uid();
  v_result jsonb;
begin
  if v_actor is null then
    raise exception 'Authentication required for get_proposal_for_timeline'
      using errcode = '42501';
  end if;

  if p_chat_id is null or p_proposal_id is null then
    raise exception 'p_chat_id and p_proposal_id are required'
      using errcode = '22023';
  end if;

  if not public.is_chat_participant(p_chat_id) then
    raise exception 'PROPOSAL_NOT_FOUND'
      using
        errcode = 'P0001',
        detail = jsonb_build_object('code', 'PROPOSAL_NOT_FOUND')::text;
  end if;

  select jsonb_build_object(
    'proposal', jsonb_build_object(
      'id', pp.id,
      'chat_id', pp.chat_id,
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
  )
  into v_result
  from public.provider_proposals pp
  where pp.id = p_proposal_id
    and pp.chat_id = p_chat_id;

  if v_result is null then
    raise exception 'PROPOSAL_NOT_FOUND'
      using
        errcode = 'P0001',
        detail = jsonb_build_object('code', 'PROPOSAL_NOT_FOUND')::text;
  end if;

  return v_result;
end;
$$;

comment on function public.get_proposal_for_timeline(uuid, uuid) is
  'Full proposal projection for DynamicProposalCard lazy hydration via linked_entity_id (R16-AC01, R22-AC05).';

revoke all on function public.get_proposal_for_timeline(uuid, uuid) from public;
revoke all on function public.get_proposal_for_timeline(uuid, uuid) from anon;
grant execute on function public.get_proposal_for_timeline(uuid, uuid) to authenticated;

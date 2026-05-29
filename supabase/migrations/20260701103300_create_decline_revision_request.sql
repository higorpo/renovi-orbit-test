-- CNS Wave B — task 34: provider decline revision request RPC (design §4.5, Req. 10, 34).
-- Migration order: runs AFTER tasks 14, 25.

create or replace function public.decline_revision_request(
  p_proposal_id uuid,
  p_idempotency_key uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_actor uuid := auth.uid();
  v_proposal public.provider_proposals%rowtype;
  v_sr public.service_requests%rowtype;
  v_cached jsonb;
  v_request_hash text;
  v_response jsonb;
begin
  if v_actor is null then
    raise exception 'Authentication required for decline_revision_request'
      using errcode = '42501';
  end if;

  if p_proposal_id is null then
    raise exception 'p_proposal_id is required'
      using errcode = '22023';
  end if;

  if p_idempotency_key is null then
    raise exception 'p_idempotency_key is required'
      using errcode = '22023';
  end if;

  v_request_hash := md5(p_proposal_id::text);

  v_cached := public.idempotency_begin(
    'chats.decline_revision_request',
    p_idempotency_key,
    v_request_hash
  );

  if v_cached is not null then
    return v_cached->'response_body';
  end if;

  select *
  into v_proposal
  from public.provider_proposals pp
  where pp.id = p_proposal_id
  for update;

  if not found then
    raise exception 'Proposal not found: %', p_proposal_id
      using errcode = '22023';
  end if;

  if v_actor <> v_proposal.provider_id then
    raise exception 'Only the proposal provider may decline a revision request'
      using errcode = '42501';
  end if;

  select *
  into v_sr
  from public.service_requests sr
  where sr.id = v_proposal.service_request_id
  for update;

  if v_sr.status <> 'OPEN'::public.service_request_status then
    raise exception 'SR_NOT_OPEN'
      using
        errcode = 'P0001',
        detail = jsonb_build_object('code', 'SR_NOT_OPEN')::text;
  end if;

  update public.provider_proposals
  set
    status = 'PENDING'::public.proposal_status,
    updated_at = now()
  where id = p_proposal_id
    and status = 'REVISION_REQUESTED'::public.proposal_status
  returning * into v_proposal;

  if not found then
    raise exception 'PROPOSAL_NOT_ACCEPTABLE'
      using
        errcode = 'P0001',
        detail = jsonb_build_object(
          'code', 'PROPOSAL_NOT_ACCEPTABLE',
          'expected_status', 'REVISION_REQUESTED'
        )::text;
  end if;

  v_response := jsonb_build_object(
    'proposal', jsonb_build_object(
      'id', v_proposal.id,
      'status', v_proposal.status,
      'revision_count', v_proposal.revision_count,
      'revision_reason', v_proposal.revision_reason,
      'revision_notes', v_proposal.revision_notes,
      'chat_id', v_proposal.chat_id,
      'service_request_id', v_proposal.service_request_id
    )
  );

  perform public.idempotency_commit(
    'chats.decline_revision_request',
    p_idempotency_key,
    v_request_hash,
    200,
    v_response
  );

  raise log 'decline_revision_request_total proposal_id=% chat_id=%',
    v_proposal.id,
    v_proposal.chat_id;

  return v_response;
end;
$$;

comment on function public.decline_revision_request(uuid, uuid) is
  'Provider declines revision: REVISION_REQUESTED → PENDING; free messaging stays disabled (R10-AC04, R34-AC07).';

grant execute on function public.decline_revision_request(uuid, uuid) to authenticated;

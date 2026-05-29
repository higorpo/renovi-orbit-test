-- CNS Wave B — task 33: client revision request RPC (design §4.5, Req. 10, 34).
-- Migration order: runs AFTER tasks 14, 23, 25.

create or replace function public.request_proposal_revision(
  p_proposal_id uuid,
  p_idempotency_key uuid,
  p_revision_reason public.proposal_revision_reason,
  p_revision_notes text default null
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
    raise exception 'Authentication required for request_proposal_revision'
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

  if p_revision_reason is null then
    raise exception 'p_revision_reason is required'
      using errcode = '22023';
  end if;

  if p_revision_notes is not null
    and char_length(trim(p_revision_notes)) > 2000 then
    raise exception 'p_revision_notes must be at most 2000 characters'
      using errcode = '22023';
  end if;

  v_request_hash := md5(
    concat_ws(
      '|',
      p_proposal_id::text,
      p_revision_reason::text,
      coalesce(trim(p_revision_notes), '')
    )
  );

  v_cached := public.idempotency_begin(
    'chats.request_proposal_revision',
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

  select *
  into v_sr
  from public.service_requests sr
  where sr.id = v_proposal.service_request_id
  for update;

  if v_actor <> v_sr.client_id then
    raise exception 'Only the service request client may request a proposal revision'
      using errcode = '42501';
  end if;

  if v_sr.status <> 'OPEN'::public.service_request_status then
    raise exception 'SR_NOT_OPEN'
      using
        errcode = 'P0001',
        detail = jsonb_build_object('code', 'SR_NOT_OPEN')::text;
  end if;

  if v_proposal.revision_count >= 2 then
    raise exception 'REVISION_LIMIT_EXCEEDED'
      using
        errcode = 'P0001',
        detail = jsonb_build_object('code', 'REVISION_LIMIT_EXCEEDED')::text;
  end if;

  update public.provider_proposals
  set
    status = 'REVISION_REQUESTED'::public.proposal_status,
    revision_reason = p_revision_reason,
    revision_notes = nullif(trim(p_revision_notes), ''),
    updated_at = now()
  where id = p_proposal_id
    and status = 'PENDING'::public.proposal_status
  returning * into v_proposal;

  if not found then
    raise exception 'PROPOSAL_NOT_ACCEPTABLE'
      using
        errcode = 'P0001',
        detail = jsonb_build_object('code', 'PROPOSAL_NOT_ACCEPTABLE')::text;
  end if;

  perform public.record_domain_event(
    'PROPOSAL_REVISION_REQUESTED',
    'proposal',
    v_proposal.id,
    v_sr.id,
    v_proposal.chat_id,
    jsonb_build_object(
      'idempotency_key',
      format('proposal:%s:revision_requested', v_proposal.id),
      'proposal_id', v_proposal.id,
      'revision_reason', p_revision_reason,
      'revision_notes', v_proposal.revision_notes
    )
  );

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
    'chats.request_proposal_revision',
    p_idempotency_key,
    v_request_hash,
    200,
    v_response
  );

  raise log 'request_proposal_revision_total proposal_id=% revision_reason=%',
    v_proposal.id,
    p_revision_reason;

  return v_response;
end;
$$;

comment on function public.request_proposal_revision(
  uuid,
  uuid,
  public.proposal_revision_reason,
  text
) is
  'Client requests revision: PENDING → REVISION_REQUESTED; free messaging re-enabled (no PENDING row) (R10-AC01, R34-AC04).';

grant execute on function public.request_proposal_revision(
  uuid,
  uuid,
  public.proposal_revision_reason,
  text
) to authenticated;

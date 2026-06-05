-- Align SR cancel proposal rejection: shared helper for cancel_service_request RPC and DB trigger.
-- Replaces legacy trigger logic (REJECTED + PENDING only) with CNS semantics (REJECTED_AUTOMATICALLY + REVISION_REQUESTED).

create or replace function public.reject_non_terminal_proposals_on_sr_cancel(
  p_service_request_id uuid,
  p_client_rejection_response text default 'Proposta recusada automaticamente: pedido cancelado pelo cliente.'
)
returns bigint
language plpgsql
security definer
set search_path = public
as $$
declare
  v_updated bigint;
begin
  if p_service_request_id is null then
    return 0;
  end if;

  update public.provider_proposals
  set
    status = 'REJECTED_AUTOMATICALLY'::public.proposal_status,
    client_rejection_response = coalesce(
      client_rejection_response,
      p_client_rejection_response
    )
  where service_request_id = p_service_request_id
    and status in (
      'PENDING'::public.proposal_status,
      'REVISION_REQUESTED'::public.proposal_status
    );

  get diagnostics v_updated = row_count;
  return coalesce(v_updated, 0);
end;
$$;

comment on function public.reject_non_terminal_proposals_on_sr_cancel(uuid, text) is
  'Marks non-terminal proposals REJECTED_AUTOMATICALLY when a service request is cancelled; shared by cancel_service_request and the SR cancel trigger.';

revoke all on function public.reject_non_terminal_proposals_on_sr_cancel(uuid, text) from public, anon, authenticated;
grant execute on function public.reject_non_terminal_proposals_on_sr_cancel(uuid, text) to service_role;

create or replace function public.reject_submitted_proposals_on_service_request_cancel()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if old.status is distinct from new.status
    and new.status = 'CANCELLED'::public.service_request_status
  then
    perform public.reject_non_terminal_proposals_on_sr_cancel(new.id);
  end if;

  return new;
end;
$$;

comment on function public.reject_submitted_proposals_on_service_request_cancel() is
  'Safety net when service_requests.status becomes CANCELLED outside cancel_service_request; delegates to reject_non_terminal_proposals_on_sr_cancel.';

create or replace function public.cancel_service_request(
  p_service_request_id uuid,
  p_idempotency_key uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_actor uuid := auth.uid();
  v_sr public.service_requests%rowtype;
  v_cached jsonb;
  v_request_hash text;
  v_chat_ids jsonb;
  v_response jsonb;
begin
  if v_actor is null then
    raise exception 'Authentication required for cancel_service_request'
      using errcode = '42501';
  end if;

  if p_service_request_id is null then
    raise exception 'p_service_request_id is required'
      using errcode = '22023';
  end if;

  if p_idempotency_key is null then
    raise exception 'p_idempotency_key is required'
      using errcode = '22023';
  end if;

  v_request_hash := md5(p_service_request_id::text);

  v_cached := public.idempotency_begin(
    'chats.cancel_service_request',
    p_idempotency_key,
    v_request_hash
  );

  if v_cached is not null then
    return v_cached->'response_body';
  end if;

  select *
  into v_sr
  from public.service_requests sr
  where sr.id = p_service_request_id
  for update;

  if not found then
    raise exception 'Service request not found: %', p_service_request_id
      using errcode = '22023';
  end if;

  if v_actor <> v_sr.client_id then
    raise exception 'Only the service request client may cancel'
      using errcode = '42501';
  end if;

  if v_sr.status = 'COMPLETED'::public.service_request_status then
    raise exception 'SR_ALREADY_COMPLETED'
      using
        errcode = 'P0001',
        detail = jsonb_build_object('code', 'SR_ALREADY_COMPLETED')::text;
  end if;

  if v_sr.status <> 'OPEN'::public.service_request_status then
    raise exception 'SR_NOT_OPEN'
      using
        errcode = 'P0001',
        detail = jsonb_build_object('code', 'SR_NOT_OPEN')::text;
  end if;

  perform 1
  from public.provider_proposals pp
  where pp.service_request_id = v_sr.id
  for update;

  perform public.reject_non_terminal_proposals_on_sr_cancel(v_sr.id);

  update public.service_requests
  set
    status = 'CANCELLED'::public.service_request_status,
    cancelled_at = now(),
    updated_at = now()
  where id = v_sr.id
  returning * into v_sr;

  with closed as (
    update public.chats c
    set
      status = 'CLOSED'::public.cns_conversation_status,
      closure_type = 'SERVICE_REQUEST_CANCELLED'::public.cns_closure_type,
      closed_at = now(),
      closed_by_user_id = v_actor,
      updated_at = now()
    where c.service_request_id = v_sr.id
      and c.status <> 'CLOSED'::public.cns_conversation_status
    returning c.id
  )
  select coalesce(jsonb_agg(to_jsonb(closed.id)), '[]'::jsonb)
  into v_chat_ids
  from closed;

  update public.service_request_negotiation_stats
  set
    active_chat_count = 0,
    version = version + 1
  where service_request_id = v_sr.id;

  perform public.record_domain_event(
    'SERVICE_REQUEST_CANCELLED',
    'service_request',
    v_sr.id,
    v_sr.id,
    null,
    jsonb_build_object(
      'idempotency_key',
      format('service_request:%s:cancelled', v_sr.id),
      'service_request_id', v_sr.id,
      'cancelled_by_user_id', v_actor
    )
  );

  perform public.record_domain_event(
    'CHATS_CLOSED_BULK',
    'service_request',
    v_sr.id,
    v_sr.id,
    null,
    jsonb_build_object(
      'idempotency_key',
      format('service_request:%s:chats_closed_bulk_cancel', v_sr.id),
      'service_request_id', v_sr.id,
      'chat_ids', v_chat_ids,
      'closed_count', jsonb_array_length(v_chat_ids),
      'reason', 'SERVICE_REQUEST_CANCELLED'
    )
  );

  perform public.record_domain_event(
    'NEGOTIATION_TERMINATED',
    'service_request',
    v_sr.id,
    v_sr.id,
    null,
    jsonb_build_object(
      'idempotency_key',
      format('service_request:%s:negotiation_terminated', v_sr.id),
      'service_request_id', v_sr.id,
      'termination_reason', 'SERVICE_REQUEST_CANCELLED'
    )
  );

  v_response := jsonb_build_object(
    'service_request', jsonb_build_object(
      'id', v_sr.id,
      'client_id', v_sr.client_id,
      'status', v_sr.status,
      'cancelled_at', v_sr.cancelled_at
    )
  );

  perform public.idempotency_commit(
    'chats.cancel_service_request',
    p_idempotency_key,
    v_request_hash,
    200,
    v_response
  );

  raise log 'cancel_service_request_total service_request_id=% closed_chats=%',
    v_sr.id,
    jsonb_array_length(v_chat_ids);

  return v_response;
end;
$$;

comment on function public.cancel_service_request(uuid, uuid) is
  'Atomic client cancel: SR CANCELLED, bulk chat close, non-terminal proposals REJECTED_AUTOMATICALLY via reject_non_terminal_proposals_on_sr_cancel (R2-AC05, R2-AC06, OAC-11).';

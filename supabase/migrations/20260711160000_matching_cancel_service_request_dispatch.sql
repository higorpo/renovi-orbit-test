-- Matching M14d — cancel_service_request DISPATCH_CANCELLED terminal (design §4.4, §15.7).

-- cancel_service_request (from 20260706040000_align_sr_cancel_proposal_rejection.sql)
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
  v_dispatch public.service_request_dispatches%rowtype;
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

  select *
  into v_dispatch
  from public.service_request_dispatches d
  where d.service_request_id = v_sr.id
  for update;

  if found
    and v_dispatch.status not in (
      'DISPATCH_MATCHED'::public.service_request_dispatch_status,
      'DISPATCH_CANCELLED'::public.service_request_dispatch_status,
      'DISPATCH_EXPIRED'::public.service_request_dispatch_status
    )
  then
    insert into public.service_request_dispatch_events (
      dispatch_id,
      service_request_id,
      event_type,
      payload
    )
    values (
      v_dispatch.id,
      v_sr.id,
      'state_transition',
      jsonb_build_object('from', v_dispatch.status, 'to', 'DISPATCH_CANCELLED')
    );

    update public.service_request_dispatches
    set
      status = 'DISPATCH_CANCELLED'::public.service_request_dispatch_status,
      next_batch_at = null,
      updated_at = now()
    where id = v_dispatch.id;
  end if;

  update public.service_request_provider_visibility v
  set revoked_at = now()
  where v.service_request_id = v_sr.id
    and v.revoked_at is null;

  perform public.matching_cancel_pending_mmd_for_service_request(v_sr.id);

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
  'Client cancels service request; sets DISPATCH_CANCELLED, revokes feed visibility, cancels matching MMD (M14d).';

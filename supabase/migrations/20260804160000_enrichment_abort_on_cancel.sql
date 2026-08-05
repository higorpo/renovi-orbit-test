-- Service completion Task 16: enrichment_append_event + enrichment_abort_for_service_request
-- wired into cancel paths (design §4.1.2). pgTAP cancel race: Task 68.
--
-- Intentionally NO auth.role() = service_role gate on append/abort: both are nested from
-- cancel_service_request (authenticated DEFINER keeps invoker JWT) and enqueue paths.
-- Privilege relies on REVOKE EXECUTE from authenticated + postgres/service_role grants.

create or replace function public.enrichment_append_event(
  p_enrichment_id uuid,
  p_event_type text,
  p_actor text,
  p_to_status public.enrichment_status,
  p_from_status public.enrichment_status default null,
  p_correlation_id uuid default null,
  p_payload jsonb default '{}'::jsonb
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row public.service_request_enrichments%rowtype;
begin
  if p_enrichment_id is null then
    raise exception 'p_enrichment_id is required'
      using errcode = '22023';
  end if;

  if nullif(btrim(p_event_type), '') is null then
    raise exception 'p_event_type is required'
      using errcode = '22023';
  end if;

  if nullif(btrim(p_actor), '') is null then
    raise exception 'p_actor is required'
      using errcode = '22023';
  end if;

  if p_to_status is null then
    raise exception 'p_to_status is required'
      using errcode = '22023';
  end if;

  select *
  into v_row
  from public.service_request_enrichments e
  where e.id = p_enrichment_id;

  if not found then
    raise exception 'enrichment not found: %', p_enrichment_id
      using errcode = 'P0002';
  end if;

  insert into public.service_request_enrichment_events (
    enrichment_id,
    service_request_id,
    from_status,
    to_status,
    actor,
    event_type,
    lease_generation,
    correlation_id,
    payload
  )
  values (
    v_row.id,
    v_row.service_request_id,
    coalesce(p_from_status, v_row.status),
    p_to_status,
    btrim(p_actor),
    btrim(p_event_type),
    v_row.lease_generation,
    coalesce(p_correlation_id, v_row.correlation_id),
    coalesce(p_payload, '{}'::jsonb)
  );
end;
$$;

comment on function public.enrichment_append_event(
  uuid, text, text, public.enrichment_status, public.enrichment_status, uuid, jsonb
) is
  'Append-only enrichment FSM audit insert; used by claim/finalize/abort helpers.';

revoke all on function public.enrichment_append_event(
  uuid, text, text, public.enrichment_status, public.enrichment_status, uuid, jsonb
) from public, anon, authenticated;
grant execute on function public.enrichment_append_event(
  uuid, text, text, public.enrichment_status, public.enrichment_status, uuid, jsonb
) to service_role;
grant execute on function public.enrichment_append_event(
  uuid, text, text, public.enrichment_status, public.enrichment_status, uuid, jsonb
) to postgres;

create or replace function public.enrichment_abort_for_service_request(
  p_service_request_id uuid,
  p_actor text default 'cancel_service_request',
  p_correlation_id uuid default null,
  p_payload jsonb default '{}'::jsonb
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row public.service_request_enrichments%rowtype;
  v_from public.enrichment_status;
begin
  if p_service_request_id is null then
    raise exception 'p_service_request_id is required'
      using errcode = '22023';
  end if;

  select *
  into v_row
  from public.service_request_enrichments e
  where e.service_request_id = p_service_request_id
  for update;

  if not found then
    return;
  end if;

  -- Already READY: leave alone (published-request cancel / dispatch cancel is separate).
  if v_row.status = 'READY'::public.enrichment_status then
    return;
  end if;

  -- Idempotent if already ABORTED.
  if v_row.status = 'ABORTED'::public.enrichment_status then
    return;
  end if;

  if v_row.status not in (
    'PENDING'::public.enrichment_status,
    'RUNNING'::public.enrichment_status
  ) then
    return;
  end if;

  v_from := v_row.status;

  update public.service_request_enrichments
  set
    status = 'ABORTED'::public.enrichment_status,
    next_attempt_at = null,
    lease_owner = null,
    locked_until = null,
    checklist_schema = null,
    source = null,
    materialized_at = null,
    updated_at = now()
  where id = v_row.id
    and status in (
      'PENDING'::public.enrichment_status,
      'RUNNING'::public.enrichment_status
    );

  if found then
    perform public.enrichment_append_event(
      v_row.id,
      'ABORTED',
      coalesce(nullif(btrim(p_actor), ''), 'cancel_service_request'),
      'ABORTED'::public.enrichment_status,
      v_from,
      p_correlation_id,
      coalesce(p_payload, '{}'::jsonb) || jsonb_build_object('reason', 'service_request_cancelled')
    );
  end if;
end;
$$;

comment on function public.enrichment_abort_for_service_request(uuid, text, uuid, jsonb) is
  'Abort PENDING/RUNNING enrichment on cancel (same TX). READY left unchanged. Appends ABORTED event.';

revoke all on function public.enrichment_abort_for_service_request(uuid, text, uuid, jsonb)
  from public, anon, authenticated;
grant execute on function public.enrichment_abort_for_service_request(uuid, text, uuid, jsonb)
  to service_role;
grant execute on function public.enrichment_abort_for_service_request(uuid, text, uuid, jsonb)
  to postgres;


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

  perform public.enrichment_abort_for_service_request(
    v_sr.id,
    'cancel_service_request',
    p_idempotency_key,
    jsonb_build_object('cancelled_by', v_actor)
  );

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
  'Client cancels OPEN service request; aborts PENDING/RUNNING enrichment; sets DISPATCH_CANCELLED; revokes feed visibility; cancels matching MMD.';

create or replace function public.system_cancel_service_request_no_proposals(
  p_service_request_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_sr public.service_requests%rowtype;
  v_dispatch public.service_request_dispatches%rowtype;
  v_chat_ids jsonb;
begin
  if p_service_request_id is null then
    raise exception 'p_service_request_id is required'
      using errcode = '22023';
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

  if v_sr.status <> 'OPEN'::public.service_request_status then
    return jsonb_build_object(
      'cancelled', false,
      'reason', 'not_open',
      'service_request_id', v_sr.id
    );
  end if;

  if exists (
    select 1
    from public.provider_proposals pp
    where pp.service_request_id = v_sr.id
  ) then
    return jsonb_build_object(
      'cancelled', false,
      'reason', 'has_proposals',
      'service_request_id', v_sr.id
    );
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
      jsonb_build_object(
        'from', v_dispatch.status,
        'to', 'DISPATCH_CANCELLED',
        'reason', 'no_proposal_auto_cancel'
      )
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

  perform public.enrichment_abort_for_service_request(
    v_sr.id,
    'system_cancel_service_request_no_proposals',
    null,
    jsonb_build_object('reason', 'no_proposal_lifecycle')
  );

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
      closed_by_user_id = null,
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

  raise log 'system_cancel_service_request_no_proposals service_request_id=% closed_chats=%',
    v_sr.id,
    jsonb_array_length(v_chat_ids);

  return jsonb_build_object(
    'cancelled', true,
    'service_request', jsonb_build_object(
      'id', v_sr.id,
      'client_id', v_sr.client_id,
      'status', v_sr.status,
      'cancelled_at', v_sr.cancelled_at
    )
  );
end;
$$;

comment on function public.system_cancel_service_request_no_proposals(uuid) is
  'System cancels OPEN SR with no proposals after matching.no_proposal_auto_cancel_hours; aborts PENDING/RUNNING enrichment; DISPATCH_CANCELLED + MMD cancel.';

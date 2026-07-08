-- Service reschedule: snapshot builder and mutation RPCs.

create or replace function public.cns_service_reschedule_snapshot_for_viewer(
  p_contracted_service_id uuid,
  p_viewer_id uuid
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  v_cs public.contracted_services%rowtype;
  v_role text;
  v_active public.service_reschedule_requests%rowtype;
  v_exec_at timestamptz;
  v_client_window_hours int := public.platform_constant_int('service_reschedule.client_request_window_hours', 48);
  v_can_client_request boolean := false;
  v_can_provider_request boolean := false;
  v_can_propose boolean := false;
  v_can_accept boolean := false;
  v_can_request_adjustment boolean := false;
  v_can_cancel boolean := false;
  v_display_status text := null;
  v_active_json jsonb := null;
begin
  select pr.role
  into v_role
  from public.profiles pr
  where pr.id = p_viewer_id;

  select cs.*
  into v_cs
  from public.contracted_services cs
  where cs.id = p_contracted_service_id;

  if not found or v_role is null then
    return null;
  end if;

  if p_viewer_id <> v_cs.client_id and p_viewer_id <> v_cs.provider_id then
    return null;
  end if;

  select srr.*
  into v_active
  from public.service_reschedule_requests srr
  where srr.contracted_service_id = p_contracted_service_id
    and srr.status in (
      'REQUESTED'::public.service_reschedule_request_status,
      'PROPOSED'::public.service_reschedule_request_status,
      'ADJUSTMENT_REQUESTED'::public.service_reschedule_request_status
    )
  order by srr.created_at desc, srr.id desc
  limit 1;

  v_exec_at := public.payment_service_execution_at(v_cs);

  if v_active.id is null then
    if v_role = 'client'
      and v_cs.status in (
        'PENDING_PAYMENT'::public.contracted_service_status,
        'CONFIRMED'::public.contracted_service_status
      )
      and now() < v_exec_at - make_interval(hours => v_client_window_hours)
    then
      v_can_client_request := true;
    end if;

    if v_role = 'provider'
      and v_cs.status = 'CONFIRMED'::public.contracted_service_status
    then
      v_can_provider_request := true;
    end if;
  else
    v_active_json := jsonb_build_object(
      'id', v_active.id,
      'status', v_active.status,
      'requested_by_role', v_active.requested_by_role,
      'requested_by_profile_id', v_active.requested_by_profile_id,
      'request_note', v_active.request_note,
      'original_slot', v_active.original_slot,
      'original_service_execution_at', v_active.original_service_execution_at,
      'proposed_slot', v_active.proposed_slot,
      'proposed_at', v_active.proposed_at,
      'adjustment_count', v_active.adjustment_count,
      'is_last_minute', v_active.is_last_minute,
      'chat_id', v_active.chat_id
    );

    if v_active.status = 'PROPOSED'::public.service_reschedule_request_status then
      v_display_status := 'Nova data proposta';
    elsif v_active.requested_by_role = 'provider'::public.service_reschedule_requested_by_role then
      v_display_status := 'Reagendamento solicitado pelo prestador';
    else
      v_display_status := 'Reagendamento solicitado pelo cliente';
    end if;

    if v_role = 'provider' then
      if v_active.status in (
        'REQUESTED'::public.service_reschedule_request_status,
        'ADJUSTMENT_REQUESTED'::public.service_reschedule_request_status
      )
      and (
        v_cs.status = 'CONFIRMED'::public.contracted_service_status
        or (
          v_cs.status = 'PENDING_PAYMENT'::public.contracted_service_status
          and v_active.requested_by_role = 'client'::public.service_reschedule_requested_by_role
        )
      )
      then
        v_can_propose := true;
      end if;

      if v_active.status in (
        'REQUESTED'::public.service_reschedule_request_status,
        'ADJUSTMENT_REQUESTED'::public.service_reschedule_request_status
      ) then
        v_can_cancel := true;
      end if;
    end if;

    if v_role = 'client' then
      if v_active.status = 'PROPOSED'::public.service_reschedule_request_status then
        v_can_accept := true;
        v_can_request_adjustment := true;
        v_can_cancel := true;
      elsif v_active.status in (
        'REQUESTED'::public.service_reschedule_request_status,
        'ADJUSTMENT_REQUESTED'::public.service_reschedule_request_status
      ) then
        v_can_cancel := true;
      end if;
    end if;
  end if;

  return jsonb_build_object(
    'contracted_service_id', p_contracted_service_id,
    'active_request', v_active_json,
    'display_status', v_display_status,
    'can_client_request_reschedule', v_can_client_request,
    'can_provider_request_reschedule', v_can_provider_request,
    'can_propose_reschedule', v_can_propose,
    'can_accept_reschedule', v_can_accept,
    'can_request_adjustment', v_can_request_adjustment,
    'can_cancel_reschedule', v_can_cancel
  );
end;
$$;

revoke all on function public.cns_service_reschedule_snapshot_for_viewer(uuid, uuid) from public, anon, authenticated;
grant execute on function public.cns_service_reschedule_snapshot_for_viewer(uuid, uuid) to service_role;

create or replace function public.cns_request_service_reschedule(
  p_contracted_service_id uuid,
  p_idempotency_key uuid,
  p_request_note text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_actor uuid := auth.uid();
  v_role text;
  v_cs public.contracted_services%rowtype;
  v_chat_id uuid;
  v_chat public.chats%rowtype;
  v_sr public.service_requests%rowtype;
  v_cached jsonb;
  v_request_hash text;
  v_response jsonb;
  v_req public.service_reschedule_requests%rowtype;
  v_exec_at timestamptz;
  v_requester_name text;
  v_system_text text;
  v_note text;
  v_recipient uuid;
  v_is_last_minute boolean := false;
  v_client_window_hours int := public.platform_constant_int('service_reschedule.client_request_window_hours', 48);
  v_last_minute_hours int := public.platform_constant_int('service_reschedule.last_minute_hours', 24);
begin
  if v_actor is null then
    raise exception 'Authentication required for cns_request_service_reschedule'
      using errcode = '42501';
  end if;

  if p_contracted_service_id is null or p_idempotency_key is null then
    raise exception 'p_contracted_service_id and p_idempotency_key are required'
      using errcode = '22023';
  end if;

  v_request_hash := md5(concat_ws(
    '|',
    p_contracted_service_id::text,
    coalesce(nullif(btrim(p_request_note), ''), '')
  ));

  v_cached := public.idempotency_begin(
    'service_reschedule.request',
    p_idempotency_key,
    v_request_hash
  );
  if v_cached is not null then
    return v_cached->'response_body';
  end if;

  select pr.role, coalesce(nullif(btrim(pr.full_name), ''), 'Usuário')
  into v_role, v_requester_name
  from public.profiles pr
  where pr.id = v_actor;

  select cs.*
  into v_cs
  from public.contracted_services cs
  where cs.id = p_contracted_service_id
  for update;

  if not found then
    raise exception 'CONTRACTED_SERVICE_NOT_FOUND'
      using errcode = 'P0002';
  end if;

  if v_role = 'client' and v_cs.client_id <> v_actor then
    raise exception 'FORBIDDEN' using errcode = '42501';
  end if;

  if v_role = 'provider' and v_cs.provider_id <> v_actor then
    raise exception 'FORBIDDEN' using errcode = '42501';
  end if;

  if v_cs.status in (
    'CANCELLED'::public.contracted_service_status,
    'EXECUTED'::public.contracted_service_status,
    'COMPLETED'::public.contracted_service_status
  ) then
    raise exception 'RESCHEDULE_NOT_ALLOWED'
      using errcode = 'P0001';
  end if;

  v_exec_at := public.payment_service_execution_at(v_cs);

  if v_role = 'client' then
    if v_cs.status not in (
      'PENDING_PAYMENT'::public.contracted_service_status,
      'CONFIRMED'::public.contracted_service_status
    ) then
      raise exception 'RESCHEDULE_NOT_ALLOWED'
        using errcode = 'P0001';
    end if;

    if now() >= v_exec_at - make_interval(hours => v_client_window_hours) then
      raise exception 'CLIENT_RESCHEDULE_WINDOW_CLOSED'
        using errcode = 'P0001';
    end if;
  elsif v_role = 'provider' then
    if v_cs.status <> 'CONFIRMED'::public.contracted_service_status then
      raise exception 'PROVIDER_RESCHEDULE_REQUIRES_CONFIRMED'
        using errcode = 'P0001';
    end if;

    if v_exec_at - now() < make_interval(hours => v_last_minute_hours) then
      v_is_last_minute := true;
    end if;
  else
    raise exception 'FORBIDDEN' using errcode = '42501';
  end if;

  if exists (
    select 1
    from public.service_reschedule_requests srr
    where srr.contracted_service_id = p_contracted_service_id
      and srr.status in (
        'REQUESTED'::public.service_reschedule_request_status,
        'PROPOSED'::public.service_reschedule_request_status,
        'ADJUSTMENT_REQUESTED'::public.service_reschedule_request_status
      )
  ) then
    raise exception 'ACTIVE_RESCHEDULE_EXISTS'
      using errcode = 'P0001';
  end if;

  v_chat_id := public.cns_resolve_contracted_service_chat_id(p_contracted_service_id);
  if v_chat_id is null then
    raise exception 'CHAT_NOT_FOUND'
      using errcode = 'P0002';
  end if;

  select c.*
  into v_chat
  from public.chats c
  where c.id = v_chat_id;

  if v_chat.status <> 'ACTIVE'::public.cns_conversation_status then
    raise exception 'CHAT_NOT_ACTIVE'
      using errcode = 'P0001';
  end if;

  v_note := nullif(left(btrim(coalesce(p_request_note, '')), 500), '');

  begin
    insert into public.service_reschedule_requests (
      contracted_service_id,
      chat_id,
      status,
      requested_by_role,
      requested_by_profile_id,
      request_note,
      original_slot,
      original_service_execution_at,
      is_last_minute,
      idempotency_key
    )
    values (
      p_contracted_service_id,
      v_chat_id,
      'REQUESTED'::public.service_reschedule_request_status,
      v_role::public.service_reschedule_requested_by_role,
      v_actor,
      v_note,
      public.cns_build_contracted_service_slot_jsonb(v_cs),
      v_exec_at,
      v_is_last_minute,
      p_idempotency_key
    )
    returning * into v_req;
  exception
    when unique_violation then
      raise exception 'ACTIVE_RESCHEDULE_EXISTS'
        using errcode = 'P0001';
  end;

  if v_role = 'client' then
    v_system_text := format(
      '%s solicitou o reagendamento do serviço agendado para %s.',
      v_requester_name,
      public.cns_format_reschedule_slot_pt(v_req.original_slot)
    );
    v_recipient := v_cs.provider_id;
  else
    v_system_text := format(
      '%s solicitou o reagendamento deste serviço. Converse pelo chat para definir uma nova data.',
      v_requester_name
    );
    v_recipient := v_cs.client_id;
  end if;

  if v_note is not null then
    v_system_text := v_system_text || ' ' || v_note;
  end if;

  insert into public.chat_messages (
    chat_id,
    sender_user_id,
    message_type,
    payload,
    linked_entity_type,
    linked_entity_id,
    idempotency_key
  )
  values (
    v_chat_id,
    null,
    'SYSTEM'::public.cns_message_type,
    jsonb_build_object('text', v_system_text),
    'workflow',
    v_req.id,
    p_idempotency_key
  )
  on conflict (chat_id, sender_user_id, idempotency_key) do nothing;

  select sr.*
  into v_sr
  from public.service_requests sr
  where sr.id = v_cs.service_request_id;

  perform public.mmd_ingest_event(
    'SERVICE_RESCHEDULE_REQUESTED',
    v_recipient,
    format('service_reschedule:%s:requested:%s', v_req.id, v_recipient),
    jsonb_build_object(
      'contracted_service_id', v_cs.id,
      'service_request_id', v_cs.service_request_id,
      'service_request_title', coalesce(v_sr.title, 'Serviço'),
      'requester_name', v_requester_name,
      'current_execution_formatted', public.cns_format_reschedule_slot_pt(v_req.original_slot),
      'deep_link_path', format('/dashboard/chats/%s', v_chat_id)
    ),
    jsonb_build_object(
      'reschedule_request_id', v_req.id,
      'requested_by_role', v_role
    )
  );

  v_response := jsonb_build_object(
    'reschedule_request_id', v_req.id,
    'chat_id', v_chat_id,
    'deep_link_path', format('/dashboard/chats/%s', v_chat_id),
    'reschedule', public.cns_service_reschedule_snapshot_for_viewer(p_contracted_service_id, v_actor)
  );

  perform public.idempotency_commit(
    'service_reschedule.request',
    p_idempotency_key,
    v_request_hash,
    200,
    v_response
  );

  return v_response;
end;
$$;

comment on function public.cns_request_service_reschedule(uuid, uuid, text) is
  'Opens formal reschedule negotiation; does not change official slot or charge schedule.';

revoke all on function public.cns_request_service_reschedule(uuid, uuid, text) from public, anon;
grant execute on function public.cns_request_service_reschedule(uuid, uuid, text) to authenticated;

create or replace function public.cns_propose_service_reschedule(
  p_reschedule_request_id uuid,
  p_new_slot jsonb,
  p_idempotency_key uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_actor uuid := auth.uid();
  v_req public.service_reschedule_requests%rowtype;
  v_cs public.contracted_services%rowtype;
  v_sr public.service_requests%rowtype;
  v_cached jsonb;
  v_request_hash text;
  v_response jsonb;
  v_system_text text;
begin
  if v_actor is null then
    raise exception 'Authentication required for cns_propose_service_reschedule'
      using errcode = '42501';
  end if;

  if p_reschedule_request_id is null or p_idempotency_key is null or p_new_slot is null then
    raise exception 'p_reschedule_request_id, p_new_slot and p_idempotency_key are required'
      using errcode = '22023';
  end if;

  v_request_hash := md5(concat_ws('|', p_reschedule_request_id::text, p_new_slot::text));

  v_cached := public.idempotency_begin(
    'service_reschedule.propose',
    p_idempotency_key,
    v_request_hash
  );
  if v_cached is not null then
    return v_cached->'response_body';
  end if;

  select srr.contracted_service_id
  into v_req.contracted_service_id
  from public.service_reschedule_requests srr
  where srr.id = p_reschedule_request_id;

  if not found then
    raise exception 'RESCHEDULE_REQUEST_NOT_FOUND'
      using errcode = 'P0002';
  end if;

  select cs.*
  into v_cs
  from public.contracted_services cs
  where cs.id = v_req.contracted_service_id
  for update;

  if not found then
    raise exception 'CONTRACTED_SERVICE_NOT_FOUND'
      using errcode = 'P0002';
  end if;

  select srr.*
  into v_req
  from public.service_reschedule_requests srr
  where srr.id = p_reschedule_request_id
  for update;

  if not found then
    raise exception 'RESCHEDULE_REQUEST_NOT_FOUND'
      using errcode = 'P0002';
  end if;

  if v_cs.provider_id <> v_actor then
    raise exception 'FORBIDDEN'
      using errcode = '42501';
  end if;

  if v_cs.status not in (
    'PENDING_PAYMENT'::public.contracted_service_status,
    'CONFIRMED'::public.contracted_service_status
  ) then
    raise exception 'RESCHEDULE_NOT_ALLOWED'
      using errcode = 'P0001';
  end if;

  if v_req.status not in (
    'REQUESTED'::public.service_reschedule_request_status,
    'ADJUSTMENT_REQUESTED'::public.service_reschedule_request_status
  ) then
    raise exception 'INVALID_RESCHEDULE_STATUS'
      using errcode = 'P0001';
  end if;

  if not (
    v_cs.status = 'CONFIRMED'::public.contracted_service_status
    or (
      v_cs.status = 'PENDING_PAYMENT'::public.contracted_service_status
      and v_req.requested_by_role = 'client'::public.service_reschedule_requested_by_role
    )
  ) then
    raise exception 'RESCHEDULE_NOT_ALLOWED'
      using errcode = 'P0001';
  end if;

  perform public._cns_validate_reschedule_slot(
    p_new_slot,
    v_cs.duration_unit,
    v_cs.duration_value
  );

  update public.service_reschedule_requests srr
  set
    status = 'PROPOSED'::public.service_reschedule_request_status,
    proposed_slot = p_new_slot,
    proposed_at = now()
  where srr.id = p_reschedule_request_id
  returning * into v_req;

  v_system_text := format(
    'Nova data proposta: %s.',
    public.cns_format_reschedule_slot_pt(p_new_slot)
  );

  insert into public.chat_messages (
    chat_id,
    sender_user_id,
    message_type,
    payload,
    linked_entity_type,
    linked_entity_id,
    idempotency_key
  )
  values (
    v_req.chat_id,
    null,
    'WORKFLOW_ACTION'::public.cns_message_type,
    jsonb_build_object(
      'text', v_system_text,
      'action_key', 'service_reschedule_proposed',
      'slot', p_new_slot
    ),
    'workflow',
    v_req.id,
    p_idempotency_key
  )
  on conflict (chat_id, sender_user_id, idempotency_key) do nothing;

  select sr.*
  into v_sr
  from public.service_requests sr
  where sr.id = v_cs.service_request_id;

  perform public.mmd_ingest_event(
    'SERVICE_RESCHEDULE_PROPOSED',
    v_cs.client_id,
    format('service_reschedule:%s:proposed:%s', v_req.id, v_cs.client_id),
    jsonb_build_object(
      'contracted_service_id', v_cs.id,
      'service_request_id', v_cs.service_request_id,
      'service_request_title', coalesce(v_sr.title, 'Serviço'),
      'proposed_execution_formatted', public.cns_format_reschedule_slot_pt(p_new_slot),
      'deep_link_path', format('/dashboard/chats/%s', v_req.chat_id)
    ),
    jsonb_build_object('reschedule_request_id', v_req.id)
  );

  v_response := jsonb_build_object(
    'reschedule_request_id', v_req.id,
    'chat_id', v_req.chat_id,
    'reschedule', public.cns_service_reschedule_snapshot_for_viewer(v_cs.id, v_actor)
  );

  perform public.idempotency_commit(
    'service_reschedule.propose',
    p_idempotency_key,
    v_request_hash,
    200,
    v_response
  );

  return v_response;
end;
$$;

revoke all on function public.cns_propose_service_reschedule(uuid, jsonb, uuid) from public, anon;
grant execute on function public.cns_propose_service_reschedule(uuid, jsonb, uuid) to authenticated;

create or replace function public.cns_accept_service_reschedule(
  p_reschedule_request_id uuid,
  p_idempotency_key uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_actor uuid := auth.uid();
  v_req public.service_reschedule_requests%rowtype;
  v_cs public.contracted_services%rowtype;
  v_sr public.service_requests%rowtype;
  v_cached jsonb;
  v_request_hash text;
  v_response jsonb;
  v_apply jsonb;
  v_system_text text;
begin
  if v_actor is null then
    raise exception 'Authentication required for cns_accept_service_reschedule'
      using errcode = '42501';
  end if;

  v_request_hash := md5(p_reschedule_request_id::text);

  v_cached := public.idempotency_begin(
    'service_reschedule.accept',
    p_idempotency_key,
    v_request_hash
  );
  if v_cached is not null then
    return v_cached->'response_body';
  end if;

  perform public.cns_set_local_statement_timeout('15s');

  select srr.contracted_service_id
  into v_req.contracted_service_id
  from public.service_reschedule_requests srr
  where srr.id = p_reschedule_request_id;

  if not found then
    raise exception 'RESCHEDULE_REQUEST_NOT_FOUND'
      using errcode = 'P0002';
  end if;

  select cs.*
  into v_cs
  from public.contracted_services cs
  where cs.id = v_req.contracted_service_id
  for update;

  if not found then
    raise exception 'CONTRACTED_SERVICE_NOT_FOUND'
      using errcode = 'P0002';
  end if;

  select srr.*
  into v_req
  from public.service_reschedule_requests srr
  where srr.id = p_reschedule_request_id
  for update;

  if not found then
    raise exception 'RESCHEDULE_REQUEST_NOT_FOUND'
      using errcode = 'P0002';
  end if;

  if v_cs.client_id <> v_actor then
    raise exception 'FORBIDDEN'
      using errcode = '42501';
  end if;

  if v_cs.status not in (
    'PENDING_PAYMENT'::public.contracted_service_status,
    'CONFIRMED'::public.contracted_service_status
  ) then
    raise exception 'RESCHEDULE_NOT_ALLOWED'
      using errcode = 'P0001';
  end if;

  if v_req.status <> 'PROPOSED'::public.service_reschedule_request_status then
    raise exception 'INVALID_RESCHEDULE_STATUS'
      using errcode = 'P0001';
  end if;

  if v_req.proposed_slot is null then
    raise exception 'PROPOSED_SLOT_REQUIRED'
      using errcode = '22023';
  end if;

  v_apply := public._cns_apply_service_reschedule_slot(v_cs.id, v_req.proposed_slot);

  update public.service_reschedule_requests srr
  set
    status = 'ACCEPTED'::public.service_reschedule_request_status,
    accepted_at = now()
  where srr.id = p_reschedule_request_id
  returning * into v_req;

  v_system_text := format(
    'Reagendamento confirmado. Nova data: %s.',
    public.cns_format_reschedule_slot_pt(v_req.proposed_slot)
  );

  insert into public.chat_messages (
    chat_id,
    sender_user_id,
    message_type,
    payload,
    linked_entity_type,
    linked_entity_id,
    idempotency_key
  )
  values (
    v_req.chat_id,
    null,
    'SYSTEM'::public.cns_message_type,
    jsonb_build_object('text', v_system_text),
    'workflow',
    v_req.id,
    p_idempotency_key
  )
  on conflict (chat_id, sender_user_id, idempotency_key) do nothing;

  select sr.*
  into v_sr
  from public.service_requests sr
  where sr.id = v_cs.service_request_id;

  perform public.mmd_ingest_event(
    'SERVICE_RESCHEDULE_ACCEPTED',
    v_cs.client_id,
    format('service_reschedule:%s:accepted:%s', v_req.id, v_cs.client_id),
    jsonb_build_object(
      'contracted_service_id', v_cs.id,
      'service_request_id', v_cs.service_request_id,
      'service_request_title', coalesce(v_sr.title, 'Serviço'),
      'proposed_execution_formatted', public.cns_format_reschedule_slot_pt(v_req.proposed_slot),
      'deep_link_path', format('/dashboard/services/%s', v_cs.service_request_id)
    ),
    jsonb_build_object('reschedule_request_id', v_req.id, 'recipient', 'client')
  );

  perform public.mmd_ingest_event(
    'SERVICE_RESCHEDULE_ACCEPTED',
    v_cs.provider_id,
    format('service_reschedule:%s:accepted:%s', v_req.id, v_cs.provider_id),
    jsonb_build_object(
      'contracted_service_id', v_cs.id,
      'service_request_id', v_cs.service_request_id,
      'service_request_title', coalesce(v_sr.title, 'Serviço'),
      'proposed_execution_formatted', public.cns_format_reschedule_slot_pt(v_req.proposed_slot),
      'deep_link_path', format('/dashboard/services/%s', v_cs.service_request_id)
    ),
    jsonb_build_object('reschedule_request_id', v_req.id, 'recipient', 'provider')
  );

  v_response := v_apply || jsonb_build_object(
    'reschedule_request_id', v_req.id,
    'chat_id', v_req.chat_id,
    'reschedule', public.cns_service_reschedule_snapshot_for_viewer(v_cs.id, v_actor)
  );

  perform public.idempotency_commit(
    'service_reschedule.accept',
    p_idempotency_key,
    v_request_hash,
    200,
    v_response
  );

  return v_response;
end;
$$;

revoke all on function public.cns_accept_service_reschedule(uuid, uuid) from public, anon;
grant execute on function public.cns_accept_service_reschedule(uuid, uuid) to authenticated;

create or replace function public.cns_request_reschedule_adjustment(
  p_reschedule_request_id uuid,
  p_idempotency_key uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_actor uuid := auth.uid();
  v_req public.service_reschedule_requests%rowtype;
  v_cs public.contracted_services%rowtype;
  v_sr public.service_requests%rowtype;
  v_cached jsonb;
  v_request_hash text;
  v_response jsonb;
  v_max_adjustments int := public.platform_constant_int('service_reschedule.max_adjustments', 5);
begin
  if v_actor is null then
    raise exception 'Authentication required for cns_request_reschedule_adjustment'
      using errcode = '42501';
  end if;

  v_request_hash := md5(p_reschedule_request_id::text);

  v_cached := public.idempotency_begin(
    'service_reschedule.adjustment',
    p_idempotency_key,
    v_request_hash
  );
  if v_cached is not null then
    return v_cached->'response_body';
  end if;

  select srr.contracted_service_id
  into v_req.contracted_service_id
  from public.service_reschedule_requests srr
  where srr.id = p_reschedule_request_id;

  if not found then
    raise exception 'RESCHEDULE_REQUEST_NOT_FOUND'
      using errcode = 'P0002';
  end if;

  select cs.*
  into v_cs
  from public.contracted_services cs
  where cs.id = v_req.contracted_service_id
  for update;

  if not found then
    raise exception 'CONTRACTED_SERVICE_NOT_FOUND'
      using errcode = 'P0002';
  end if;

  select srr.*
  into v_req
  from public.service_reschedule_requests srr
  where srr.id = p_reschedule_request_id
  for update;

  if not found then
    raise exception 'RESCHEDULE_REQUEST_NOT_FOUND'
      using errcode = 'P0002';
  end if;

  if v_cs.client_id <> v_actor then
    raise exception 'FORBIDDEN'
      using errcode = '42501';
  end if;

  if v_cs.status not in (
    'PENDING_PAYMENT'::public.contracted_service_status,
    'CONFIRMED'::public.contracted_service_status
  ) then
    raise exception 'RESCHEDULE_NOT_ALLOWED'
      using errcode = 'P0001';
  end if;

  if v_req.status <> 'PROPOSED'::public.service_reschedule_request_status then
    raise exception 'INVALID_RESCHEDULE_STATUS'
      using errcode = 'P0001';
  end if;

  if v_req.adjustment_count >= v_max_adjustments then
    raise exception 'ADJUSTMENT_LIMIT_REACHED'
      using errcode = 'P0001';
  end if;

  update public.service_reschedule_requests srr
  set
    status = 'ADJUSTMENT_REQUESTED'::public.service_reschedule_request_status,
    adjustment_count = srr.adjustment_count + 1
  where srr.id = p_reschedule_request_id
  returning * into v_req;

  insert into public.chat_messages (
    chat_id,
    sender_user_id,
    message_type,
    payload,
    linked_entity_type,
    linked_entity_id,
    idempotency_key
  )
  values (
    v_req.chat_id,
    null,
    'SYSTEM'::public.cns_message_type,
    jsonb_build_object('text', 'O cliente solicitou ajuste na data proposta.'),
    'workflow',
    v_req.id,
    p_idempotency_key
  )
  on conflict (chat_id, sender_user_id, idempotency_key) do nothing;

  select sr.*
  into v_sr
  from public.service_requests sr
  where sr.id = v_cs.service_request_id;

  perform public.mmd_ingest_event(
    'SERVICE_RESCHEDULE_ADJUSTMENT_REQUESTED',
    v_cs.provider_id,
    format('service_reschedule:%s:adjustment:%s', v_req.id, v_cs.provider_id),
    jsonb_build_object(
      'contracted_service_id', v_cs.id,
      'service_request_id', v_cs.service_request_id,
      'service_request_title', coalesce(v_sr.title, 'Serviço'),
      'deep_link_path', format('/dashboard/chats/%s', v_req.chat_id)
    ),
    jsonb_build_object('reschedule_request_id', v_req.id)
  );

  v_response := jsonb_build_object(
    'reschedule_request_id', v_req.id,
    'chat_id', v_req.chat_id,
    'reschedule', public.cns_service_reschedule_snapshot_for_viewer(v_cs.id, v_actor)
  );

  perform public.idempotency_commit(
    'service_reschedule.adjustment',
    p_idempotency_key,
    v_request_hash,
    200,
    v_response
  );

  return v_response;
end;
$$;

revoke all on function public.cns_request_reschedule_adjustment(uuid, uuid) from public, anon;
grant execute on function public.cns_request_reschedule_adjustment(uuid, uuid) to authenticated;

create or replace function public.cns_cancel_service_reschedule_request(
  p_reschedule_request_id uuid,
  p_idempotency_key uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_actor uuid := auth.uid();
  v_req public.service_reschedule_requests%rowtype;
  v_cs public.contracted_services%rowtype;
  v_sr public.service_requests%rowtype;
  v_cached jsonb;
  v_request_hash text;
  v_response jsonb;
  v_recipient uuid;
begin
  if v_actor is null then
    raise exception 'Authentication required for cns_cancel_service_reschedule_request'
      using errcode = '42501';
  end if;

  v_request_hash := md5(p_reschedule_request_id::text);

  v_cached := public.idempotency_begin(
    'service_reschedule.cancel',
    p_idempotency_key,
    v_request_hash
  );
  if v_cached is not null then
    return v_cached->'response_body';
  end if;

  select srr.contracted_service_id
  into v_req.contracted_service_id
  from public.service_reschedule_requests srr
  where srr.id = p_reschedule_request_id;

  if not found then
    raise exception 'RESCHEDULE_REQUEST_NOT_FOUND'
      using errcode = 'P0002';
  end if;

  select cs.*
  into v_cs
  from public.contracted_services cs
  where cs.id = v_req.contracted_service_id
  for update;

  if not found then
    raise exception 'CONTRACTED_SERVICE_NOT_FOUND'
      using errcode = 'P0002';
  end if;

  select srr.*
  into v_req
  from public.service_reschedule_requests srr
  where srr.id = p_reschedule_request_id
  for update;

  if not found then
    raise exception 'RESCHEDULE_REQUEST_NOT_FOUND'
      using errcode = 'P0002';
  end if;

  if v_actor <> v_cs.client_id and v_actor <> v_cs.provider_id then
    raise exception 'FORBIDDEN'
      using errcode = '42501';
  end if;

  if v_cs.status in (
    'CANCELLED'::public.contracted_service_status,
    'EXECUTED'::public.contracted_service_status,
    'COMPLETED'::public.contracted_service_status
  ) then
    raise exception 'RESCHEDULE_NOT_ALLOWED'
      using errcode = 'P0001';
  end if;

  if v_req.status = 'PROPOSED'::public.service_reschedule_request_status then
    if v_actor <> v_cs.client_id then
      raise exception 'FORBIDDEN'
        using errcode = '42501';
    end if;
  elsif v_req.status not in (
    'REQUESTED'::public.service_reschedule_request_status,
    'ADJUSTMENT_REQUESTED'::public.service_reschedule_request_status
  ) then
    raise exception 'INVALID_RESCHEDULE_STATUS'
      using errcode = 'P0001';
  end if;

  update public.service_reschedule_requests srr
  set status = 'CANCELLED'::public.service_reschedule_request_status
  where srr.id = p_reschedule_request_id
  returning * into v_req;

  insert into public.chat_messages (
    chat_id,
    sender_user_id,
    message_type,
    payload,
    linked_entity_type,
    linked_entity_id,
    idempotency_key
  )
  values (
    v_req.chat_id,
    null,
    'SYSTEM'::public.cns_message_type,
    jsonb_build_object(
      'text',
      'A solicitação de reagendamento foi encerrada. A data atual do serviço permanece válida.'
    ),
    'workflow',
    v_req.id,
    p_idempotency_key
  )
  on conflict (chat_id, sender_user_id, idempotency_key) do nothing;

  v_recipient := case
    when v_actor = v_cs.client_id then v_cs.provider_id
    else v_cs.client_id
  end;

  select sr.*
  into v_sr
  from public.service_requests sr
  where sr.id = v_cs.service_request_id;

  perform public.mmd_ingest_event(
    'SERVICE_RESCHEDULE_CANCELLED',
    v_recipient,
    format('service_reschedule:%s:cancelled:%s', v_req.id, v_recipient),
    jsonb_build_object(
      'contracted_service_id', v_cs.id,
      'service_request_id', v_cs.service_request_id,
      'service_request_title', coalesce(v_sr.title, 'Serviço'),
      'deep_link_path', format('/dashboard/chats/%s', v_req.chat_id)
    ),
    jsonb_build_object('reschedule_request_id', v_req.id)
  );

  v_response := jsonb_build_object(
    'reschedule_request_id', v_req.id,
    'chat_id', v_req.chat_id,
    'reschedule', public.cns_service_reschedule_snapshot_for_viewer(v_cs.id, v_actor)
  );

  perform public.idempotency_commit(
    'service_reschedule.cancel',
    p_idempotency_key,
    v_request_hash,
    200,
    v_response
  );

  return v_response;
end;
$$;

revoke all on function public.cns_cancel_service_reschedule_request(uuid, uuid) from public, anon;
grant execute on function public.cns_cancel_service_reschedule_request(uuid, uuid) to authenticated;

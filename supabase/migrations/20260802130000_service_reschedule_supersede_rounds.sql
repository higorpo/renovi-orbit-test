-- Reschedule negotiation rounds: supersede prior rows and insert a new PROPOSED record
-- so chat cards remain immutable per linked workflow message.

create or replace function public.trg_service_reschedule_requests_fsm()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  v_allowed boolean := false;
begin
  if tg_op = 'INSERT' then
    if new.status = 'REQUESTED'::public.service_reschedule_request_status then
      return new;
    end if;

    if new.status = 'PROPOSED'::public.service_reschedule_request_status
      and new.parent_request_id is not null
    then
      return new;
    end if;

    raise exception 'INVALID_INITIAL_STATUS'
      using errcode = '23514';
  end if;

  if old.status in (
    'ACCEPTED'::public.service_reschedule_request_status,
    'CANCELLED'::public.service_reschedule_request_status,
    'EXPIRED'::public.service_reschedule_request_status,
    'SUPERSEDED'::public.service_reschedule_request_status
  ) then
    if new.status is distinct from old.status then
      raise exception 'TERMINAL_STATUS_IMMUTABLE'
        using errcode = '23514';
    end if;

    return new;
  end if;

  if new.status = old.status then
    return new;
  end if;

  v_allowed := case old.status
    when 'REQUESTED'::public.service_reschedule_request_status
      then new.status in (
        'PROPOSED'::public.service_reschedule_request_status,
        'CANCELLED'::public.service_reschedule_request_status,
        'EXPIRED'::public.service_reschedule_request_status
      )
    when 'PROPOSED'::public.service_reschedule_request_status
      then new.status in (
        'ADJUSTMENT_REQUESTED'::public.service_reschedule_request_status,
        'ACCEPTED'::public.service_reschedule_request_status,
        'CANCELLED'::public.service_reschedule_request_status,
        'EXPIRED'::public.service_reschedule_request_status,
        'SUPERSEDED'::public.service_reschedule_request_status
      )
    when 'ADJUSTMENT_REQUESTED'::public.service_reschedule_request_status
      then new.status in (
        'CANCELLED'::public.service_reschedule_request_status,
        'EXPIRED'::public.service_reschedule_request_status,
        'SUPERSEDED'::public.service_reschedule_request_status
      )
    else false
  end;

  if not v_allowed then
    raise exception 'INVALID_RESCHEDULE_STATUS_TRANSITION'
      using errcode = '23514';
  end if;

  return new;
end;
$$;

comment on function public.trg_service_reschedule_requests_fsm() is
  'Validates service_reschedule_requests status transitions, including supersede rounds.';

create or replace function public.trg_service_reschedule_requests_terminal_immutable()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if old.status in (
    'ACCEPTED'::public.service_reschedule_request_status,
    'CANCELLED'::public.service_reschedule_request_status,
    'EXPIRED'::public.service_reschedule_request_status,
    'SUPERSEDED'::public.service_reschedule_request_status
  ) and new is distinct from old then
    raise exception 'TERMINAL_ROW_IMMUTABLE'
      using errcode = '23514';
  end if;

  return new;
end;
$$;

comment on function public.trg_service_reschedule_requests_terminal_immutable() is
  'Blocks any column change on terminal reschedule rows.';

create or replace function public._cns_reschedule_request_json(
  p_req public.service_reschedule_requests
)
returns jsonb
language sql
immutable
set search_path = public
as $$
  select jsonb_build_object(
    'id', p_req.id,
    'status', p_req.status,
    'requested_by_role', p_req.requested_by_role,
    'requested_by_profile_id', p_req.requested_by_profile_id,
    'request_note', p_req.request_note,
    'original_slot', p_req.original_slot,
    'original_service_execution_at', p_req.original_service_execution_at,
    'proposed_slot', p_req.proposed_slot,
    'proposed_at', p_req.proposed_at,
    'adjustment_count', p_req.adjustment_count,
    'is_last_minute', p_req.is_last_minute,
    'chat_id', p_req.chat_id,
    'parent_request_id', p_req.parent_request_id
  );
$$;

comment on function public._cns_reschedule_request_json(public.service_reschedule_requests) is
  'Serializes a reschedule request row for snapshot JSON responses.';

create or replace function public._cns_reschedule_display_status(
  p_status public.service_reschedule_request_status,
  p_requested_by_role public.service_reschedule_requested_by_role
)
returns text
language sql
immutable
set search_path = public
as $$
  select case
    when p_status = 'PROPOSED'::public.service_reschedule_request_status then
      'Nova data proposta'
    when p_status = 'SUPERSEDED'::public.service_reschedule_request_status then
      'Proposta substituída'
    when p_status = 'ADJUSTMENT_REQUESTED'::public.service_reschedule_request_status then
      'Ajuste solicitado'
    when p_status = 'ACCEPTED'::public.service_reschedule_request_status then
      'Reagendamento confirmado'
    when p_status = 'CANCELLED'::public.service_reschedule_request_status then
      'Reagendamento cancelado'
    when p_status = 'EXPIRED'::public.service_reschedule_request_status then
      'Reagendamento expirado'
    when p_requested_by_role = 'provider'::public.service_reschedule_requested_by_role then
      'Reagendamento solicitado pelo prestador'
    else
      'Reagendamento solicitado pelo cliente'
  end;
$$;

comment on function public._cns_reschedule_display_status(
  public.service_reschedule_request_status,
  public.service_reschedule_requested_by_role
) is
  'Product copy for reschedule snapshot display_status.';

create or replace function public._cns_reschedule_snapshot_action_flags(
  p_req public.service_reschedule_requests,
  p_cs public.contracted_services,
  p_role text,
  p_is_active boolean,
  p_has_active_request boolean
)
returns jsonb
language plpgsql
volatile
set search_path = public
as $$
declare
  v_can_client_request boolean := false;
  v_can_provider_request boolean := false;
  v_can_propose boolean := false;
  v_can_accept boolean := false;
  v_can_request_adjustment boolean := false;
  v_can_cancel boolean := false;
  v_exec_at timestamptz;
  v_client_window_hours int := public.platform_constant_int('service_reschedule.client_request_window_hours', 48);
begin
  if p_is_active and p_req.id is not null then
    if p_role = 'provider' then
      if p_req.status in (
        'REQUESTED'::public.service_reschedule_request_status,
        'ADJUSTMENT_REQUESTED'::public.service_reschedule_request_status
      )
      and (
        p_cs.status = 'CONFIRMED'::public.contracted_service_status
        or (
          p_cs.status = 'PENDING_PAYMENT'::public.contracted_service_status
          and p_req.requested_by_role = 'client'::public.service_reschedule_requested_by_role
        )
      )
      then
        v_can_propose := true;
      end if;

      if p_req.status in (
        'REQUESTED'::public.service_reschedule_request_status,
        'ADJUSTMENT_REQUESTED'::public.service_reschedule_request_status
      ) then
        v_can_cancel := true;
      end if;
    end if;

    if p_role = 'client' then
      if p_req.status = 'PROPOSED'::public.service_reschedule_request_status then
        v_can_accept := true;
        v_can_request_adjustment := true;
        v_can_cancel := true;
      elsif p_req.status in (
        'REQUESTED'::public.service_reschedule_request_status,
        'ADJUSTMENT_REQUESTED'::public.service_reschedule_request_status
      ) then
        v_can_cancel := true;
      end if;
    end if;
  end if;

  if not p_has_active_request then
    v_exec_at := public.payment_service_execution_at(p_cs);

    if p_role = 'client'
      and p_cs.status in (
        'PENDING_PAYMENT'::public.contracted_service_status,
        'CONFIRMED'::public.contracted_service_status
      )
      and now() < v_exec_at - make_interval(hours => v_client_window_hours)
    then
      v_can_client_request := true;
    end if;

    if p_role = 'provider'
      and p_cs.status = 'CONFIRMED'::public.contracted_service_status
    then
      v_can_provider_request := true;
    end if;
  end if;

  return jsonb_build_object(
    'can_client_request_reschedule', v_can_client_request,
    'can_provider_request_reschedule', v_can_provider_request,
    'can_propose_reschedule', v_can_propose,
    'can_accept_reschedule', v_can_accept,
    'can_request_adjustment', v_can_request_adjustment,
    'can_cancel_reschedule', v_can_cancel
  );
end;
$$;

comment on function public._cns_reschedule_snapshot_action_flags(
  public.service_reschedule_requests,
  public.contracted_services,
  text,
  boolean,
  boolean
) is
  'Shared CTA flags for reschedule snapshot builders.';

create or replace function public._cns_service_reschedule_snapshot_core(
  p_contracted_service_id uuid,
  p_req public.service_reschedule_requests,
  p_cs public.contracted_services,
  p_role text,
  p_active_id uuid,
  p_include_request_alias boolean default false
)
returns jsonb
language plpgsql
volatile
set search_path = public
as $$
declare
  v_req_json jsonb := null;
  v_display_status text := null;
  v_is_active boolean := false;
  v_has_active_request boolean := false;
  v_flags jsonb;
begin
  if p_req.id is not null then
    v_req_json := public._cns_reschedule_request_json(p_req);
    v_display_status := public._cns_reschedule_display_status(
      p_req.status,
      p_req.requested_by_role
    );
    v_is_active := p_active_id is not null and p_active_id = p_req.id;
  end if;

  v_has_active_request := p_active_id is not null;

  v_flags := public._cns_reschedule_snapshot_action_flags(
    p_req,
    p_cs,
    p_role,
    v_is_active,
    v_has_active_request
  );

  if p_include_request_alias then
    return jsonb_build_object(
      'contracted_service_id', p_contracted_service_id,
      'request', v_req_json,
      'active_request', v_req_json,
      'display_status', v_display_status
    ) || v_flags;
  end if;

  return jsonb_build_object(
    'contracted_service_id', p_contracted_service_id,
    'active_request', v_req_json,
    'display_status', v_display_status
  ) || v_flags;
end;
$$;

comment on function public._cns_service_reschedule_snapshot_core(
  uuid,
  public.service_reschedule_requests,
  public.contracted_services,
  text,
  uuid,
  boolean
) is
  'Builds reschedule snapshot JSON from preloaded rows without extra lookups.';

create or replace function public.cns_service_reschedule_active_request_id(
  p_contracted_service_id uuid
)
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select srr.id
  from public.service_reschedule_requests srr
  where srr.contracted_service_id = p_contracted_service_id
    and srr.status in (
      'REQUESTED'::public.service_reschedule_request_status,
      'PROPOSED'::public.service_reschedule_request_status,
      'ADJUSTMENT_REQUESTED'::public.service_reschedule_request_status
    )
  order by srr.created_at desc, srr.id desc
  limit 1;
$$;

comment on function public.cns_service_reschedule_active_request_id(uuid) is
  'Returns the active reschedule request id for a contracted service, if any.';

revoke all on function public.cns_service_reschedule_active_request_id(uuid) from public, anon;
grant execute on function public.cns_service_reschedule_active_request_id(uuid) to service_role;

create or replace function public.cns_service_reschedule_snapshot_for_request(
  p_reschedule_request_id uuid,
  p_viewer_id uuid
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_req public.service_reschedule_requests%rowtype;
  v_cs public.contracted_services%rowtype;
  v_role text;
  v_active_id uuid;
begin
  select pr.role
  into v_role
  from public.profiles pr
  where pr.id = p_viewer_id;

  select srr.*
  into v_req
  from public.service_reschedule_requests srr
  where srr.id = p_reschedule_request_id;

  if not found or v_role is null then
    return null;
  end if;

  select cs.*
  into v_cs
  from public.contracted_services cs
  where cs.id = v_req.contracted_service_id;

  if not found
    or (p_viewer_id <> v_cs.client_id and p_viewer_id <> v_cs.provider_id)
  then
    return null;
  end if;

  v_active_id := public.cns_service_reschedule_active_request_id(v_req.contracted_service_id);

  return public._cns_service_reschedule_snapshot_core(
    v_req.contracted_service_id,
    v_req,
    v_cs,
    v_role,
    v_active_id,
    true
  );
end;
$$;

comment on function public.cns_service_reschedule_snapshot_for_request(uuid, uuid) is
  'Returns a per-request snapshot for historical chat card hydration.';

revoke all on function public.cns_service_reschedule_snapshot_for_request(uuid, uuid) from public, anon;
grant execute on function public.cns_service_reschedule_snapshot_for_request(uuid, uuid) to service_role;

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
  v_active_id uuid;
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

  v_active_id := v_active.id;

  return public._cns_service_reschedule_snapshot_core(
    p_contracted_service_id,
    v_active,
    v_cs,
    v_role,
    v_active_id,
    false
  );
end;
$$;

comment on function public.cns_service_reschedule_snapshot_for_viewer(uuid, uuid) is
  'Returns the live reschedule snapshot for banner and composer gates.';

revoke all on function public.cns_service_reschedule_snapshot_for_viewer(uuid, uuid) from public, anon, authenticated;
grant execute on function public.cns_service_reschedule_snapshot_for_viewer(uuid, uuid) to service_role;

create or replace function public.cns_get_service_reschedule_request(
  p_reschedule_request_id uuid
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, auth
as $$
declare
  v_actor uuid := auth.uid();
begin
  if v_actor is null then
    raise exception 'Authentication required for cns_get_service_reschedule_request'
      using errcode = '42501';
  end if;

  return public.cns_service_reschedule_snapshot_for_request(p_reschedule_request_id, v_actor);
end;
$$;

comment on function public.cns_get_service_reschedule_request(uuid) is
  'Returns historical snapshot for a specific reschedule request (chat card hydration).';

revoke all on function public.cns_get_service_reschedule_request(uuid) from public, anon;
grant execute on function public.cns_get_service_reschedule_request(uuid) to authenticated;

create or replace function public.cns_get_active_service_reschedule_for_chat(
  p_chat_id uuid
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, auth
as $$
declare
  v_actor uuid := auth.uid();
  v_contracted_service_id uuid;
begin
  if v_actor is null then
    raise exception 'Authentication required for cns_get_active_service_reschedule_for_chat'
      using errcode = '42501';
  end if;

  if p_chat_id is null then
    raise exception 'p_chat_id is required'
      using errcode = '22023';
  end if;

  select cs.id
  into v_contracted_service_id
  from public.chats c
  inner join public.contracted_services cs
    on cs.service_request_id = c.service_request_id
    and cs.provider_id = c.provider_id
    and cs.client_id = c.client_id
  where c.id = p_chat_id
    and v_actor in (c.client_id, c.provider_id)
    and cs.status in (
      'PENDING_PAYMENT'::public.contracted_service_status,
      'CONFIRMED'::public.contracted_service_status
    )
  order by cs.created_at desc, cs.id desc
  limit 1;

  if v_contracted_service_id is null then
    return null;
  end if;

  return public.cns_service_reschedule_snapshot_for_viewer(v_contracted_service_id, v_actor);
end;
$$;

comment on function public.cns_get_active_service_reschedule_for_chat(uuid) is
  'Returns live reschedule snapshot for the chat contracted service (banner / composer gates).';

revoke all on function public.cns_get_active_service_reschedule_for_chat(uuid) from public, anon;
grant execute on function public.cns_get_active_service_reschedule_for_chat(uuid) to authenticated;

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
  v_new_req public.service_reschedule_requests%rowtype;
  v_superseded_req public.service_reschedule_requests%rowtype;
  v_cs public.contracted_services%rowtype;
  v_sr public.service_requests%rowtype;
  v_role text;
  v_cached jsonb;
  v_request_hash text;
  v_response jsonb;
  v_system_text text;
  v_superseded_id uuid := null;
  v_reschedule_snapshot jsonb;
  v_superseded_snapshot jsonb := null;
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
    raise exception 'RESCHEDULE_REQUEST_NOT_FOUND'
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

  if v_cs.client_id <> v_actor and v_cs.provider_id <> v_actor then
    raise exception 'RESCHEDULE_REQUEST_NOT_FOUND'
      using errcode = 'P0002';
  end if;

  if v_cs.provider_id <> v_actor then
    raise exception 'RESCHEDULE_REQUEST_NOT_FOUND'
      using errcode = 'P0002';
  end if;

  if v_cs.status not in (
    'PENDING_PAYMENT'::public.contracted_service_status,
    'CONFIRMED'::public.contracted_service_status
  ) then
    raise exception 'RESCHEDULE_NOT_ALLOWED'
      using errcode = 'P0001';
  end if;

  if public.cns_service_reschedule_active_request_id(v_cs.id) is distinct from v_req.id then
    raise exception 'INVALID_RESCHEDULE_STATUS'
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

  perform public._cns_validate_reschedule_slot(p_new_slot);

  if v_req.status = 'REQUESTED'::public.service_reschedule_request_status then
    update public.service_reschedule_requests srr
    set
      status = 'PROPOSED'::public.service_reschedule_request_status,
      proposed_slot = p_new_slot,
      proposed_at = now()
    where srr.id = p_reschedule_request_id
    returning * into v_new_req;
  else
    update public.service_reschedule_requests srr
    set status = 'SUPERSEDED'::public.service_reschedule_request_status
    where srr.id = p_reschedule_request_id
    returning * into v_superseded_req;

    v_superseded_id := v_superseded_req.id;

    insert into public.service_reschedule_requests (
      contracted_service_id,
      chat_id,
      status,
      requested_by_role,
      requested_by_profile_id,
      request_note,
      original_slot,
      original_service_execution_at,
      proposed_slot,
      proposed_at,
      adjustment_count,
      is_last_minute,
      parent_request_id,
      idempotency_key
    )
    values (
      v_superseded_req.contracted_service_id,
      v_superseded_req.chat_id,
      'PROPOSED'::public.service_reschedule_request_status,
      v_superseded_req.requested_by_role,
      v_superseded_req.requested_by_profile_id,
      v_superseded_req.request_note,
      v_superseded_req.original_slot,
      v_superseded_req.original_service_execution_at,
      p_new_slot,
      now(),
      v_superseded_req.adjustment_count,
      v_superseded_req.is_last_minute,
      v_superseded_req.id,
      p_idempotency_key
    )
    returning * into v_new_req;
  end if;

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
    v_new_req.chat_id,
    null,
    'WORKFLOW_ACTION'::public.cns_message_type,
    jsonb_build_object(
      'text', v_system_text,
      'action_key', 'service_reschedule_proposed',
      'slot', p_new_slot
    ),
    'workflow',
    v_new_req.id,
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
    format('service_reschedule:%s:proposed:%s', v_new_req.id, v_cs.client_id),
    jsonb_build_object(
      'contracted_service_id', v_cs.id,
      'service_request_id', v_cs.service_request_id,
      'service_request_title', coalesce(v_sr.title, 'Serviço'),
      'proposed_execution_formatted', public.cns_format_reschedule_slot_pt(p_new_slot),
      'deep_link_path', format('/dashboard/chats/%s', v_new_req.chat_id)
    ),
    jsonb_build_object('reschedule_request_id', v_new_req.id)
  );

  select pr.role
  into v_role
  from public.profiles pr
  where pr.id = v_actor;

  v_reschedule_snapshot := public._cns_service_reschedule_snapshot_core(
    v_cs.id,
    v_new_req,
    v_cs,
    v_role,
    v_new_req.id,
    false
  );

  if v_superseded_id is not null then
    v_superseded_snapshot := public._cns_service_reschedule_snapshot_core(
      v_cs.id,
      v_superseded_req,
      v_cs,
      v_role,
      v_new_req.id,
      true
    );
  end if;

  v_response := jsonb_strip_nulls(
    jsonb_build_object(
      'reschedule_request_id', v_new_req.id,
      'superseded_request_id', v_superseded_id,
      'chat_id', v_new_req.chat_id,
      'reschedule', v_reschedule_snapshot,
      'superseded_reschedule', v_superseded_snapshot
    )
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

comment on function public.cns_propose_service_reschedule(uuid, jsonb, uuid) is
  'Proposes a reschedule slot; re-propose after adjustment supersedes the prior round.';

revoke all on function public.cns_propose_service_reschedule(uuid, jsonb, uuid) from public, anon;
grant execute on function public.cns_propose_service_reschedule(uuid, jsonb, uuid) to authenticated;

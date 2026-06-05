-- Rename public.services (contracted service) to contracted_services to avoid confusion with platform catalog.

alter table public.services rename to contracted_services;

alter table public.contracted_services rename constraint services_pkey to contracted_services_pkey;
alter table public.contracted_services rename constraint services_one_per_request to contracted_services_one_per_request;
alter table public.contracted_services rename constraint services_one_per_proposal to contracted_services_one_per_proposal;
alter table public.contracted_services rename constraint services_agreed_slot_object to contracted_services_agreed_slot_object;
alter table public.contracted_services rename constraint services_hours_slot_shape to contracted_services_hours_slot_shape;
alter table public.contracted_services rename constraint services_days_slot_shape to contracted_services_days_slot_shape;
alter table public.contracted_services rename constraint services_duration_unit_check to contracted_services_duration_unit_check;
alter table public.contracted_services rename constraint services_duration_value_check to contracted_services_duration_value_check;
alter table public.contracted_services rename constraint services_scheduled_shift_check to contracted_services_scheduled_shift_check;
alter table public.contracted_services rename constraint services_service_request_id_fkey to contracted_services_service_request_id_fkey;
alter table public.contracted_services rename constraint services_accepted_proposal_id_fkey to contracted_services_accepted_proposal_id_fkey;
alter table public.contracted_services rename constraint services_client_id_fkey to contracted_services_client_id_fkey;
alter table public.contracted_services rename constraint services_provider_id_fkey to contracted_services_provider_id_fkey;

alter policy services_select on public.contracted_services rename to contracted_services_select;
alter policy services_insert_denied on public.contracted_services rename to contracted_services_insert_denied;
alter policy services_update_denied on public.contracted_services rename to contracted_services_update_denied;
alter policy services_delete_denied on public.contracted_services rename to contracted_services_delete_denied;

alter trigger services_updated_at on public.contracted_services rename to contracted_services_updated_at;

comment on table public.contracted_services is
  'Contracted service after proposal accept (platform-flow.mmd node BA). Not the service catalog.';

comment on column public.contracted_services.service_request_id is
  'One row per SR after accept; UNIQUE enforces Req. 23 (no COMPLETED SR without contracted service).';

comment on column public.service_requests.contracted_service_id is
  'FK to contracted public.contracted_services row; MUST NOT duplicate accepted_proposal_id on SR (R15-AC04).';

revoke insert, update, delete on table public.contracted_services from authenticated;
grant select on table public.contracted_services to authenticated;

-- accept_proposal: use contracted_services table (body from 20260705204000).

create or replace function public.accept_proposal(
  p_proposal_id uuid,
  p_selected_slot jsonb,
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
  v_service public.contracted_services%rowtype;
  v_cached jsonb;
  v_request_hash text;
  v_sla_hours int;
  v_chat_ids jsonb;
  v_chat_id uuid;
  v_response jsonb;
begin
  if v_actor is null then
    raise exception 'Authentication required for accept_proposal'
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

  if p_selected_slot is null or jsonb_typeof(p_selected_slot) <> 'object' then
    raise exception 'p_selected_slot must be a JSON object'
      using errcode = '22023';
  end if;

  perform public.cns_set_local_statement_timeout('5s');

  v_request_hash := md5(
    concat_ws(
      '|',
      p_proposal_id::text,
      p_selected_slot::text
    )
  );

  v_cached := public.idempotency_begin(
    'chats.accept_proposal',
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

  v_chat_id := public.resolve_proposal_chat_id(
    v_proposal.service_request_id,
    v_proposal.provider_id
  );

  select *
  into v_sr
  from public.service_requests sr
  where sr.id = v_proposal.service_request_id
  for update;

  if v_sr.contracted_service_id is not null
    or v_sr.status = 'COMPLETED'::public.service_request_status then
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

  if v_actor <> v_sr.client_id then
    raise exception 'Only the service request client may accept a proposal'
      using errcode = '42501';
  end if;

  perform 1
  from public.provider_proposals pp
  where pp.service_request_id = v_sr.id
  for update;

  if v_proposal.status <> 'PENDING'::public.proposal_status then
    raise exception 'PROPOSAL_NOT_ACCEPTABLE'
      using
        errcode = 'P0001',
        detail = jsonb_build_object(
          'code', 'PROPOSAL_NOT_ACCEPTABLE',
          'status', v_proposal.status
        )::text;
  end if;

  v_sla_hours := public.platform_constant_int('chats.proposal_response_sla_hours', 24);

  if coalesce(v_proposal.submitted_at, v_proposal.created_at)
    + make_interval(hours => v_sla_hours) < now() then
    raise exception 'PROPOSAL_EXPIRED'
      using
        errcode = 'P0001',
        detail = jsonb_build_object('code', 'PROPOSAL_EXPIRED')::text;
  end if;

  if not exists (
    select 1
    from jsonb_array_elements(v_proposal.proposal_suggested_slots) elem
    where elem->>'start_date' = p_selected_slot->>'start_date'
      and elem->>'shift' = p_selected_slot->>'shift'
      and coalesce(elem->>'end_date', '') = coalesce(p_selected_slot->>'end_date', '')
  ) then
    raise exception 'selected_slot must match one of proposal_suggested_slots'
      using errcode = '22023';
  end if;

  update public.provider_proposals
  set
    status = 'ACCEPTED'::public.proposal_status,
    selected_slot = p_selected_slot
  where id = p_proposal_id
  returning * into v_proposal;

  update public.provider_proposals
  set
    status = 'REJECTED_AUTOMATICALLY'::public.proposal_status,
    client_rejection_response = coalesce(
      client_rejection_response,
      'Proposta recusada automaticamente: outra proposta foi aceita neste pedido.'
    )
  where service_request_id = v_sr.id
    and id <> p_proposal_id
    and status = 'PENDING'::public.proposal_status;

  with closed as (
    update public.chats c
    set
      status = 'CLOSED'::public.cns_conversation_status,
      closure_type = 'PROPOSAL_ACCEPTED_ELSEWHERE'::public.cns_closure_type,
      closed_at = now(),
      closed_by_user_id = v_actor,
      updated_at = now()
    where c.service_request_id = v_sr.id
      and c.status <> 'CLOSED'::public.cns_conversation_status
      and c.provider_id <> v_proposal.provider_id
    returning c.id
  )
  select coalesce(jsonb_agg(to_jsonb(closed.id)), '[]'::jsonb)
  into v_chat_ids
  from closed;

  update public.service_request_negotiation_stats
  set
    active_chat_count = (
      select count(*)::int
      from public.chats c
      where c.service_request_id = v_sr.id
        and c.status = 'ACTIVE'::public.cns_conversation_status
    ),
    version = version + 1
  where service_request_id = v_sr.id;

  insert into public.contracted_services (
    service_request_id,
    accepted_proposal_id,
    client_id,
    provider_id,
    duration_unit,
    duration_value,
    scheduled_start_date,
    scheduled_end_date,
    scheduled_shift,
    agreed_slot,
    status
  )
  values (
    v_sr.id,
    v_proposal.id,
    v_sr.client_id,
    v_proposal.provider_id,
    v_proposal.proposal_duration_unit,
    v_proposal.proposal_duration_value,
    (p_selected_slot->>'start_date')::date,
    nullif(p_selected_slot->>'end_date', '')::date,
    p_selected_slot->>'shift',
    p_selected_slot,
    'PENDING_PAYMENT'::public.contracted_service_status
  )
  returning * into v_service;

  update public.service_requests
  set
    contracted_service_id = v_service.id,
    status = 'COMPLETED'::public.service_request_status,
    completed_at = now()
  where id = v_sr.id
  returning * into v_sr;

  perform public.record_domain_event(
    'PROPOSAL_ACCEPTED',
    'proposal',
    v_proposal.id,
    v_sr.id,
    v_chat_id,
    jsonb_build_object(
      'idempotency_key',
      format('proposal:%s:accepted', v_proposal.id),
      'proposal_id', v_proposal.id,
      'service_id', v_service.id,
      'selected_slot', p_selected_slot
    )
  );

  perform public.record_domain_event(
    'SERVICE_REQUEST_COMPLETED',
    'service_request',
    v_sr.id,
    v_sr.id,
    null,
    jsonb_build_object(
      'idempotency_key',
      format('service_request:%s:completed', v_sr.id),
      'service_request_id', v_sr.id,
      'contracted_service_id', v_service.id
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
      format('service_request:%s:chats_closed_bulk', v_sr.id),
      'service_request_id', v_sr.id,
      'chat_ids', v_chat_ids,
      'closed_count', jsonb_array_length(v_chat_ids),
      'kept_open_provider_id', v_proposal.provider_id
    )
  );

  v_response := jsonb_build_object(
    'service', jsonb_build_object(
      'id', v_service.id,
      'service_request_id', v_service.service_request_id,
      'accepted_proposal_id', v_service.accepted_proposal_id,
      'status', v_service.status,
      'scheduled_start_date', v_service.scheduled_start_date,
      'scheduled_shift', v_service.scheduled_shift,
      'agreed_slot', v_service.agreed_slot
    ),
    'proposal', jsonb_build_object(
      'id', v_proposal.id,
      'status', v_proposal.status,
      'selected_slot', v_proposal.selected_slot,
      'provider_id', v_proposal.provider_id,
      'chat_id', v_chat_id
    )
  );

  perform public.idempotency_commit(
    'chats.accept_proposal',
    p_idempotency_key,
    v_request_hash,
    200,
    v_response
  );

  raise log 'accept_proposal_total proposal_id=% service_id=% service_request_id=%',
    v_proposal.id,
    v_service.id,
    v_sr.id;

  return v_response;
exception
  when query_canceled then
    raise exception 'STATEMENT_TIMEOUT'
      using
        errcode = 'P0001',
        detail = jsonb_build_object(
          'code', 'STATEMENT_TIMEOUT',
          'operation', 'chats.accept_proposal',
          'retry', true,
          'hint', 'Retry with the same idempotency_key after timeout'
        )::text;
end;
$$;

create or replace function public.cns_service_request_allows_chat_messaging(
  p_service_request_id uuid,
  p_chat_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.service_requests sr
    where sr.id = p_service_request_id
      and (
        sr.status = 'OPEN'::public.service_request_status
        or (
          sr.status = 'COMPLETED'::public.service_request_status
          and exists (
            select 1
            from public.contracted_services s
            inner join public.chats c
              on c.id = p_chat_id
             and c.service_request_id = sr.id
             and c.provider_id = s.provider_id
            where s.service_request_id = sr.id
          )
        )
      )
  );
$$;

create or replace function public.client_my_services_cancelled_ids(p_client_id uuid)
returns setof uuid
language sql
stable
security invoker
set search_path = public
as $$
  select sr.id
  from public.service_requests sr
  left join public.contracted_services s on s.id = sr.contracted_service_id
  where sr.client_id = p_client_id
    and (
      sr.status = 'CANCELLED'::public.service_request_status
      or (
        sr.status = 'COMPLETED'::public.service_request_status
        and s.status = 'CANCELLED'::public.contracted_service_status
      )
    );
$$;

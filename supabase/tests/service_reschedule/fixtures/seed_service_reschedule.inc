create or replace function pg_temp.service_reschedule_set_auth(p_user_id uuid)
returns void
language plpgsql
as $$
begin
  perform set_config('request.jwt.claim.sub', p_user_id::text, true);
  perform set_config(
    'request.jwt.claims',
    json_build_object('role', 'authenticated', 'sub', p_user_id::text)::text,
    true
  );
  perform set_config('request.jwt.claim.role', 'authenticated', true);
end;
$$;

create or replace function pg_temp.service_reschedule_set_service_role()
returns void
language plpgsql
as $$
begin
  perform set_config(
    'request.jwt.claims',
    json_build_object('role', 'service_role')::text,
    true
  );
  perform set_config('request.jwt.claim.role', 'service_role', true);
end;
$$;

create or replace function pg_temp.service_reschedule_seed_chat(
  p_service_request_id uuid,
  p_client_id uuid,
  p_provider_id uuid,
  p_status public.cns_conversation_status default 'ACTIVE'
)
returns uuid
language plpgsql
as $$
declare
  v_chat_id uuid;
begin
  insert into public.chats (
    service_request_id,
    client_id,
    provider_id,
    status,
    closed_at,
    closure_type,
    last_interaction_at
  )
  values (
    p_service_request_id,
    p_client_id,
    p_provider_id,
    p_status,
    case when p_status = 'CLOSED'::public.cns_conversation_status then now() else null end,
    case
      when p_status = 'CLOSED'::public.cns_conversation_status
        then 'MANUAL'::public.cns_closure_type
      else null
    end,
    now()
  )
  on conflict (service_request_id, provider_id) do update
    set
      status = excluded.status,
      closed_at = excluded.closed_at,
      closure_type = excluded.closure_type,
      last_interaction_at = excluded.last_interaction_at,
      updated_at = now()
  returning id into v_chat_id;

  return v_chat_id;
end;
$$;

create or replace function pg_temp.service_reschedule_seed_service(
  p_contracted_service_id uuid,
  p_provider_id uuid default '5d09e025-20a2-4842-aeef-324d42a431e1'::uuid,
  p_scheduled_start_date date default current_date + 10,
  p_service_status public.contracted_service_status default 'CONFIRMED'::public.contracted_service_status,
  p_chat_status public.cns_conversation_status default 'ACTIVE',
  p_with_chat boolean default true
)
returns table (
  service_request_id uuid,
  client_id uuid,
  provider_id uuid,
  chat_id uuid
)
language plpgsql
as $$
declare
  v_service_request_id uuid := gen_random_uuid();
  v_proposal_id uuid := gen_random_uuid();
  v_client_id uuid;
  v_pricing record;
  v_slot jsonb;
  v_chat_id uuid;
begin
  select sr.client_id
  into v_client_id
  from public.service_requests sr
  where sr.id = '7017e457-5a32-44e7-b8da-1727a14f4d33'::uuid;

  insert into public.service_requests (
    id,
    client_id,
    service_id,
    address_id,
    title,
    description,
    form_data,
    form_version,
    status,
    urgency
  )
  select
    v_service_request_id,
    sr.client_id,
    sr.service_id,
    sr.address_id,
    format('service reschedule pgTAP %s', p_contracted_service_id),
    sr.description,
    sr.form_data,
    sr.form_version,
    'COMPLETED'::public.service_request_status,
    sr.urgency
  from public.service_requests sr
  where sr.id = '7017e457-5a32-44e7-b8da-1727a14f4d33'::uuid;

  perform pg_temp.service_reschedule_set_auth(p_provider_id);

  select * into v_pricing
  from public.calculate_provider_service_pricing(100.00::numeric);

  perform pg_temp.service_reschedule_set_service_role();

  v_slot := jsonb_build_object(
    'start_date', to_char(p_scheduled_start_date, 'YYYY-MM-DD'),
    'end_date', to_char(p_scheduled_start_date, 'YYYY-MM-DD'),
    'shift', 'morning'
  );

  insert into public.provider_proposals (
    id,
    provider_id,
    service_request_id,
    proposed_amount,
    proposal_description,
    proposal_duration_value,
    proposal_duration_unit,
    proposal_suggested_slots,
    photos,
    tax_rate,
    tax_amount,
    final_amount,
    pricing_signature,
    status
  )
  values (
    v_proposal_id,
    p_provider_id,
    v_service_request_id,
    v_pricing.original_amount,
    'service reschedule pgTAP proposal',
    1,
    'days',
    jsonb_build_array(v_slot),
    '{}'::text[],
    v_pricing.tax_rate,
    v_pricing.tax_amount,
    v_pricing.final_amount,
    v_pricing.pricing_signature,
    'ACCEPTED'::public.proposal_status
  );

  insert into public.contracted_services (
    id,
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
    p_contracted_service_id,
    v_service_request_id,
    v_proposal_id,
    v_client_id,
    p_provider_id,
    'days',
    1,
    p_scheduled_start_date,
    p_scheduled_start_date,
    'morning',
    v_slot,
    p_service_status
  );

  if p_with_chat then
    v_chat_id := pg_temp.service_reschedule_seed_chat(
      v_service_request_id,
      v_client_id,
      p_provider_id,
      p_chat_status
    );
  end if;

  service_request_id := v_service_request_id;
  client_id := v_client_id;
  provider_id := p_provider_id;
  chat_id := v_chat_id;
  return next;
end;
$$;

create or replace function pg_temp.service_reschedule_insert_request(
  p_contracted_service_id uuid,
  p_chat_id uuid,
  p_requested_by_role public.service_reschedule_requested_by_role,
  p_requested_by_profile_id uuid,
  p_status public.service_reschedule_request_status default 'REQUESTED'::public.service_reschedule_request_status,
  p_created_at timestamptz default now(),
  p_proposed_slot jsonb default null,
  p_adjustment_count int default 0,
  p_last_reminder_at timestamptz default null,
  p_reminder_count int default 0,
  p_urgent_reminder_sent_at timestamptz default null
)
returns uuid
language plpgsql
as $$
declare
  v_req_id uuid := gen_random_uuid();
  v_cs public.contracted_services%rowtype;
  v_original_slot jsonb;
  v_exec_at timestamptz;
begin
  select *
  into v_cs
  from public.contracted_services
  where id = p_contracted_service_id;

  v_original_slot := public.cns_build_contracted_service_slot_jsonb(v_cs);
  v_exec_at := public.payment_service_execution_at(v_cs);

  insert into public.service_reschedule_requests (
    id,
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
    accepted_at,
    adjustment_count,
    last_reminder_at,
    reminder_count,
    urgent_reminder_sent_at,
    idempotency_key,
    created_at,
    updated_at
  )
  values (
    v_req_id,
    p_contracted_service_id,
    p_chat_id,
    'REQUESTED'::public.service_reschedule_request_status,
    p_requested_by_role,
    p_requested_by_profile_id,
    null,
    v_original_slot,
    v_exec_at,
    null,
    null,
    null,
    p_adjustment_count,
    p_last_reminder_at,
    p_reminder_count,
    p_urgent_reminder_sent_at,
    gen_random_uuid(),
    p_created_at,
    p_created_at
  );

  if p_status = 'PROPOSED'::public.service_reschedule_request_status then
    update public.service_reschedule_requests
    set
      status = 'PROPOSED'::public.service_reschedule_request_status,
      proposed_slot = coalesce(
        p_proposed_slot,
        jsonb_build_object(
          'start_date', to_char(public.cns_business_today() + 2, 'YYYY-MM-DD'),
          'shift', 'morning'
        )
      ),
      proposed_at = now(),
      adjustment_count = p_adjustment_count
    where id = v_req_id;
  elsif p_status = 'ADJUSTMENT_REQUESTED'::public.service_reschedule_request_status then
    update public.service_reschedule_requests
    set
      status = 'PROPOSED'::public.service_reschedule_request_status,
      proposed_slot = coalesce(
        p_proposed_slot,
        jsonb_build_object(
          'start_date', to_char(public.cns_business_today() + 2, 'YYYY-MM-DD'),
          'shift', 'morning'
        )
      ),
      proposed_at = now()
    where id = v_req_id;

    update public.service_reschedule_requests
    set
      status = 'ADJUSTMENT_REQUESTED'::public.service_reschedule_request_status,
      adjustment_count = p_adjustment_count
    where id = v_req_id;
  elsif p_status = 'ACCEPTED'::public.service_reschedule_request_status then
    update public.service_reschedule_requests
    set
      status = 'PROPOSED'::public.service_reschedule_request_status,
      proposed_slot = coalesce(
        p_proposed_slot,
        jsonb_build_object(
          'start_date', to_char(public.cns_business_today() + 2, 'YYYY-MM-DD'),
          'shift', 'morning'
        )
      ),
      proposed_at = now()
    where id = v_req_id;

    update public.service_reschedule_requests
    set
      status = 'ACCEPTED'::public.service_reschedule_request_status,
      accepted_at = now(),
      adjustment_count = p_adjustment_count
    where id = v_req_id;
  elsif p_status in (
    'CANCELLED'::public.service_reschedule_request_status,
    'EXPIRED'::public.service_reschedule_request_status
  ) then
    update public.service_reschedule_requests
    set
      status = p_status,
      adjustment_count = p_adjustment_count
    where id = v_req_id;
  end if;

  return v_req_id;
end;
$$;

-- pgTAP: minimum slot start_date is tomorrow (America/Sao_Paulo) across proposal and reschedule RPCs.

begin;

\ir ../fixtures/accept_proposal_payment_helpers.inc

-- Inline chat seed helper (avoids \ir path issues in isolated test runs).
create or replace function pg_temp.cns_seed_chat(
  p_service_request_id uuid,
  p_client_id uuid,
  p_provider_id uuid,
  p_status public.cns_conversation_status default 'ACTIVE',
  p_last_interaction_at timestamptz default now()
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
    last_interaction_at
  )
  values (
    p_service_request_id,
    p_client_id,
    p_provider_id,
    p_status,
    p_last_interaction_at
  )
  on conflict (service_request_id, provider_id) do update
    set
      status = excluded.status,
      last_interaction_at = excluded.last_interaction_at,
      updated_at = now()
  returning id into v_chat_id;

  return v_chat_id;
end;
$$;

select plan(14);

create or replace function pg_temp.cns_set_auth(p_user_id uuid)
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

create or replace function pg_temp.cns_seed_slot_sr(p_title text default 'slot minimum start date pgTAP')
returns uuid
language plpgsql
as $$
declare
  v_sr_id uuid;
begin
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
    gen_random_uuid(),
    sr.client_id,
    sr.service_id,
    sr.address_id,
    p_title,
    sr.description,
    sr.form_data,
    sr.form_version,
    'OPEN',
    sr.urgency
  from public.service_requests sr
  where sr.id = '7017e457-5a32-44e7-b8da-1727a14f4d33'::uuid
  returning id into v_sr_id;

  return v_sr_id;
end;
$$;

create or replace function pg_temp.cns_call_create_provider_proposal(
  p_service_request_id uuid,
  p_slots jsonb,
  p_duration_unit text default 'hours',
  p_duration_value integer default 2
)
returns jsonb
language plpgsql
as $$
declare
  v_pricing record;
begin
  select * into v_pricing
  from public.calculate_provider_service_pricing(250.00::numeric);

  return public.create_provider_proposal(
    p_service_request_id,
    gen_random_uuid(),
    v_pricing.original_amount,
    'slot minimum start date pgTAP proposal',
    p_duration_value,
    p_duration_unit,
    p_slots,
    '{}'::text[],
    v_pricing.tax_rate,
    v_pricing.tax_amount,
    v_pricing.final_amount,
    v_pricing.pricing_signature
  );
end;
$$;

create or replace function pg_temp.cns_seed_reschedule_service(
  p_contracted_service_id uuid,
  p_provider_id uuid default '5d09e025-20a2-4842-aeef-324d42a431e1'::uuid
)
returns table (
  service_request_id uuid,
  client_id uuid
)
language plpgsql
as $$
declare
  v_service_request_id uuid := gen_random_uuid();
  v_proposal_id uuid := gen_random_uuid();
  v_client_id uuid;
  v_pricing record;
  v_slot jsonb;
begin
  select sr.client_id
  into v_client_id
  from public.service_requests sr
  where sr.id = '7017e457-5a32-44e7-b8da-1727a14f4d33'::uuid;

  insert into public.service_requests (
    id, client_id, service_id, address_id, title, description, form_data, form_version, status, urgency
  )
  select
    v_service_request_id, sr.client_id, sr.service_id, sr.address_id,
    format('slot minimum reschedule pgTAP %s', p_contracted_service_id),
    sr.description, sr.form_data, sr.form_version, 'OPEN', sr.urgency
  from public.service_requests sr
  where sr.id = '7017e457-5a32-44e7-b8da-1727a14f4d33'::uuid;

  perform pg_temp.cns_set_auth(p_provider_id);

  select * into v_pricing
  from public.calculate_provider_service_pricing(100.00::numeric);

  v_slot := jsonb_build_object(
    'start_date', to_char(public.cns_business_today() + 10, 'YYYY-MM-DD'),
    'end_date', to_char(public.cns_business_today() + 10, 'YYYY-MM-DD'),
    'shift', 'morning'
  );

  insert into public.provider_proposals (
    id, provider_id, service_request_id, proposed_amount, proposal_description,
    proposal_duration_value, proposal_duration_unit, proposal_suggested_slots,
    photos, tax_rate, tax_amount, final_amount, pricing_signature, status
  )
  values (
    v_proposal_id, p_provider_id, v_service_request_id, v_pricing.original_amount,
    'slot minimum reschedule pgTAP proposal', 1, 'days', jsonb_build_array(v_slot),
    '{}'::text[], v_pricing.tax_rate, v_pricing.tax_amount, v_pricing.final_amount,
    v_pricing.pricing_signature, 'ACCEPTED'::public.proposal_status
  );

  insert into public.contracted_services (
    id, service_request_id, accepted_proposal_id, client_id, provider_id,
    duration_unit, duration_value, scheduled_start_date, scheduled_end_date,
    scheduled_shift, agreed_slot, status
  )
  values (
    p_contracted_service_id, v_service_request_id, v_proposal_id, v_client_id,
    p_provider_id, 'days', 1, public.cns_business_today() + 10, public.cns_business_today() + 10,
    'morning', v_slot, 'PENDING_PAYMENT'::public.contracted_service_status
  );

  service_request_id := v_service_request_id;
  client_id := v_client_id;
  return next;
end;
$$;

-- Helpers
select is(
  public.cns_business_today(),
  (now() at time zone 'America/Sao_Paulo')::date,
  'cns_business_today matches America/Sao_Paulo calendar date'
);

select throws_ok(
  $$ select public.cns_assert_slot_start_date_allowed(public.cns_business_today() - 1) $$,
  '22023',
  'SLOT_START_DATE_TOO_SOON',
  'cns_assert_slot_start_date_allowed rejects yesterday'
);

select throws_ok(
  $$ select public.cns_assert_slot_start_date_allowed(public.cns_business_today()) $$,
  '22023',
  'SLOT_START_DATE_TOO_SOON',
  'cns_assert_slot_start_date_allowed rejects today'
);

select lives_ok(
  $$ select public.cns_assert_slot_start_date_allowed(public.cns_business_today() + 1) $$,
  'cns_assert_slot_start_date_allowed accepts tomorrow'
);

-- create_provider_proposal
create temp table _slot_sr as
select pg_temp.cns_seed_slot_sr() as service_request_id;

select pg_temp.cns_seed_chat(
  p_service_request_id := (select service_request_id from _slot_sr),
  p_client_id := '28e30f1d-3c47-441f-94c6-76b6ea0db470'::uuid,
  p_provider_id := '5d09e025-20a2-4842-aeef-324d42a431e1'::uuid
);

select pg_temp.cns_set_auth('5d09e025-20a2-4842-aeef-324d42a431e1'::uuid);

select throws_ok(
  format(
    $$ select pg_temp.cns_call_create_provider_proposal(
      %L::uuid,
      jsonb_build_array(
        jsonb_build_object(
          'start_date', %L,
          'shift', 'morning'
        )
      )
    ) $$,
    (select service_request_id from _slot_sr),
    to_char(public.cns_business_today(), 'YYYY-MM-DD')
  ),
  '22023',
  'SLOT_START_DATE_TOO_SOON',
  'create_provider_proposal rejects hours slot starting today'
);

select throws_ok(
  format(
    $$ select pg_temp.cns_call_create_provider_proposal(
      %L::uuid,
      jsonb_build_array(
        jsonb_build_object(
          'start_date', %L,
          'shift', 'afternoon'
        )
      )
    ) $$,
    (select service_request_id from _slot_sr),
    to_char(public.cns_business_today() - 1, 'YYYY-MM-DD')
  ),
  '22023',
  'SLOT_START_DATE_TOO_SOON',
  'create_provider_proposal rejects hours slot starting yesterday'
);

create temp table _slot_create_ok as
select pg_temp.cns_call_create_provider_proposal(
  (select service_request_id from _slot_sr),
  jsonb_build_array(
    jsonb_build_object(
      'start_date', to_char(public.cns_business_today() + 1, 'YYYY-MM-DD'),
      'shift', 'morning'
    )
  )
) as response;

select is(
  (select response->'proposal'->>'status' from _slot_create_ok),
  'PENDING',
  'create_provider_proposal accepts hours slot starting tomorrow'
);

select throws_ok(
  format(
    $$ select pg_temp.cns_call_create_provider_proposal(
      %L::uuid,
      jsonb_build_array(
        jsonb_build_object(
          'start_date', %L,
          'end_date', %L,
          'shift', 'full_day'
        )
      ),
      'days',
      1
    ) $$,
    (select service_request_id from _slot_sr),
    to_char(public.cns_business_today(), 'YYYY-MM-DD'),
    to_char(public.cns_business_today() + 6, 'YYYY-MM-DD')
  ),
  '22023',
  'SLOT_START_DATE_TOO_SOON',
  'create_provider_proposal rejects day-based slot starting today even with future end_date'
);

create temp table _slot_create_days_ok as
select pg_temp.cns_call_create_provider_proposal(
  (select service_request_id from _slot_sr),
  jsonb_build_array(
    jsonb_build_object(
      'start_date', to_char(public.cns_business_today() + 1, 'YYYY-MM-DD'),
      'end_date', to_char(public.cns_business_today() + 1, 'YYYY-MM-DD'),
      'shift', 'morning'
    )
  ),
  'days',
  1
) as response;

select is(
  (select response->'proposal'->>'status' from _slot_create_days_ok),
  'PENDING',
  'create_provider_proposal accepts day-based slot starting tomorrow'
);

select throws_ok(
  format(
    $$ select pg_temp.cns_call_create_provider_proposal(
      %L::uuid,
      jsonb_build_array(
        jsonb_build_object(
          'start_date', %L,
          'shift', 'invalid_shift'
        )
      )
    ) $$,
    (select service_request_id from _slot_sr),
    to_char(public.cns_business_today() + 3, 'YYYY-MM-DD')
  ),
  '22023',
  'Each suggested slot must include a valid shift',
  'create_provider_proposal still rejects invalid shift before slot date gate'
);

-- accept_proposal
create temp table _accept_slot_sr as
select pg_temp.cns_seed_slot_sr('accept slot minimum pgTAP') as service_request_id;

select pg_temp.cns_seed_chat(
  p_service_request_id := (select service_request_id from _accept_slot_sr),
  p_client_id := '28e30f1d-3c47-441f-94c6-76b6ea0db470'::uuid,
  p_provider_id := '5d09e025-20a2-4842-aeef-324d42a431e1'::uuid
);

create temp table _accept_tomorrow_slot as
select jsonb_build_object(
  'start_date', to_char(public.cns_business_today() + 1, 'YYYY-MM-DD'),
  'shift', 'morning'
) as selected_slot;

select pg_temp.cns_set_auth('5d09e025-20a2-4842-aeef-324d42a431e1'::uuid);

create temp table _accept_tomorrow_submit as
select pg_temp.cns_call_create_provider_proposal(
  (select service_request_id from _accept_slot_sr),
  jsonb_build_array((select selected_slot from _accept_tomorrow_slot))
) as submit_response;

select pg_temp.cns_set_auth('28e30f1d-3c47-441f-94c6-76b6ea0db470'::uuid);

select throws_ok(
  format(
    $$ select pg_temp.cns_accept_proposal(
      %L::uuid,
      %L::jsonb,
      %L::uuid
    ) $$,
    (select (submit_response->'proposal'->>'id')::uuid from _accept_tomorrow_submit),
    (select selected_slot from _accept_tomorrow_slot),
    gen_random_uuid()
  ),
  'P0001',
  'PAYMENT_REQUIRED',
  'accept_proposal passes tomorrow slot date gate before payment validation'
);

create temp table _legacy_today_sr as
select pg_temp.cns_seed_slot_sr('legacy today slot pgTAP') as service_request_id;

select pg_temp.cns_seed_chat(
  p_service_request_id := (select service_request_id from _legacy_today_sr),
  p_client_id := '28e30f1d-3c47-441f-94c6-76b6ea0db470'::uuid,
  p_provider_id := '5d09e025-20a2-4842-aeef-324d42a431e1'::uuid
);

do $legacy$
declare
  v_pricing record;
  v_proposal_id uuid := gen_random_uuid();
  v_today_slot jsonb := jsonb_build_object(
    'start_date', to_char(public.cns_business_today(), 'YYYY-MM-DD'),
    'shift', 'morning'
  );
begin
  perform pg_temp.cns_set_auth('5d09e025-20a2-4842-aeef-324d42a431e1'::uuid);

  select * into v_pricing
  from public.calculate_provider_service_pricing(300.00::numeric);

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
    status,
    submitted_at
  )
  values (
    v_proposal_id,
    '5d09e025-20a2-4842-aeef-324d42a431e1'::uuid,
    (select service_request_id from _legacy_today_sr),
    v_pricing.original_amount,
    'legacy today slot proposal',
    2,
    'hours',
    jsonb_build_array(v_today_slot),
    '{}'::text[],
    v_pricing.tax_rate,
    v_pricing.tax_amount,
    v_pricing.final_amount,
    v_pricing.pricing_signature,
    'PENDING'::public.proposal_status,
    now()
  );

  perform set_config('test.legacy_today_proposal_id', v_proposal_id::text, true);
end;
$legacy$;

select pg_temp.cns_set_auth('28e30f1d-3c47-441f-94c6-76b6ea0db470'::uuid);

select throws_ok(
  format(
    $$ select pg_temp.cns_accept_proposal(
      %L::uuid,
      jsonb_build_object(
        'start_date', %L,
        'shift', 'morning'
      ),
      %L::uuid
    ) $$,
    current_setting('test.legacy_today_proposal_id'),
    to_char(public.cns_business_today(), 'YYYY-MM-DD'),
    gen_random_uuid()
  ),
  '22023',
  'SLOT_START_DATE_TOO_SOON',
  'accept_proposal rejects legacy proposal slot starting today'
);

-- cns_confirm_service_reschedule
do $reschedule$
declare
  v_service_id uuid := gen_random_uuid();
  v_client_id uuid;
begin
  select client_id
  into v_client_id
  from pg_temp.cns_seed_reschedule_service(v_service_id);

  perform set_config('test.reschedule_service_id', v_service_id::text, true);
  perform set_config('test.reschedule_client_id', v_client_id::text, true);
end;
$reschedule$;

select pg_temp.cns_set_auth(current_setting('test.reschedule_client_id')::uuid);

select throws_ok(
  format(
    $$ select public.cns_confirm_service_reschedule(
      %L::uuid,
      jsonb_build_object(
        'start_date', %L,
        'shift', 'morning'
      )
    ) $$,
    current_setting('test.reschedule_service_id'),
    to_char(public.cns_business_today(), 'YYYY-MM-DD')
  ),
  '22023',
  'SLOT_START_DATE_TOO_SOON',
  'cns_confirm_service_reschedule rejects rescheduling to today'
);

create temp table _reschedule_ok as
select public.cns_confirm_service_reschedule(
  current_setting('test.reschedule_service_id')::uuid,
  jsonb_build_object(
    'start_date', to_char(public.cns_business_today() + 1, 'YYYY-MM-DD'),
    'end_date', to_char(public.cns_business_today() + 1, 'YYYY-MM-DD'),
    'shift', 'afternoon'
  )
) as response;

select is(
  (select response->>'scheduled_start_date' from _reschedule_ok),
  to_char(public.cns_business_today() + 1, 'YYYY-MM-DD'),
  'cns_confirm_service_reschedule accepts rescheduling to tomorrow'
);

select finish();

rollback;

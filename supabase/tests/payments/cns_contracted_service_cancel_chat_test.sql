-- pgTAP: migration 20260801850000 — full coverage for cancel chat integration.

begin;

select plan(53);

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

create or replace function pg_temp.payment_set_service_role()
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

create or replace function pg_temp.cns_seed_cancel_chat_fixture(
  p_contracted_service_id uuid,
  p_provider_id uuid,
  p_scheduled_start_date date default current_date + 10,
  p_service_status public.contracted_service_status default 'PENDING_PAYMENT'::public.contracted_service_status,
  p_sr_status public.service_request_status default 'COMPLETED'::public.service_request_status,
  p_with_chat boolean default true
)
returns table (
  service_request_id uuid,
  client_id uuid,
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
    id, client_id, service_id, address_id, title, description, form_data, form_version, status, urgency
  )
  select
    v_service_request_id, sr.client_id, sr.service_id, sr.address_id,
    format('cancel chat pgTAP %s', p_contracted_service_id),
    sr.description, sr.form_data, sr.form_version, p_sr_status, sr.urgency
  from public.service_requests sr
  where sr.id = '7017e457-5a32-44e7-b8da-1727a14f4d33'::uuid;

  perform pg_temp.cns_set_auth(p_provider_id);

  select * into v_pricing
  from public.calculate_provider_service_pricing(100.00::numeric);

  perform pg_temp.payment_set_service_role();

  v_slot := jsonb_build_object(
    'start_date', to_char(p_scheduled_start_date, 'YYYY-MM-DD'),
    'shift', 'morning'
  );

  insert into public.provider_proposals (
    id, provider_id, service_request_id, proposed_amount, proposal_description,
    proposal_duration_value, proposal_duration_unit, proposal_suggested_slots,
    photos, tax_rate, tax_amount, final_amount, pricing_signature, status
  )
  values (
    v_proposal_id, p_provider_id, v_service_request_id, v_pricing.original_amount,
    'cancel chat pgTAP proposal', 1, 'days', jsonb_build_array(v_slot),
    '{}'::text[], v_pricing.tax_rate, v_pricing.tax_amount, v_pricing.final_amount,
    v_pricing.pricing_signature, 'ACCEPTED'::public.proposal_status
  );

  insert into public.contracted_services (
    id, service_request_id, accepted_proposal_id, client_id, provider_id,
    duration_unit, duration_value, scheduled_start_date, scheduled_end_date, scheduled_shift,
    agreed_slot, status
  )
  values (
    p_contracted_service_id, v_service_request_id, v_proposal_id, v_client_id,
    p_provider_id, 'days', 1, p_scheduled_start_date, p_scheduled_start_date, 'morning', v_slot,
    p_service_status
  );

  if p_with_chat then
    v_chat_id := pg_temp.cns_seed_chat(
      p_service_request_id := v_service_request_id,
      p_client_id := v_client_id,
      p_provider_id := p_provider_id
    );
  end if;

  service_request_id := v_service_request_id;
  client_id := v_client_id;
  chat_id := v_chat_id;
  return next;
end;
$$;

select pg_temp.payment_set_service_role();

-- ---------------------------------------------------------------------------
-- Schema + grants
-- ---------------------------------------------------------------------------

select ok(
  exists (
    select 1
    from pg_enum e
    join pg_type t on t.oid = e.enumtypid
    join pg_namespace n on n.oid = t.typnamespace
    where n.nspname = 'public'
      and t.typname = 'cns_closure_type'
      and e.enumlabel = 'CONTRACTED_SERVICE_CANCELLED'
  ),
  'CONTRACTED_SERVICE_CANCELLED closure type exists'
);

select ok(
  has_function_privilege('service_role', 'public.cns_build_contracted_service_cancel_system_message(text,text,boolean,text)', 'EXECUTE')
    and not has_function_privilege('authenticated', 'public.cns_build_contracted_service_cancel_system_message(text,text,boolean,text)', 'EXECUTE'),
  'message builder granted to service_role only'
);

select ok(
  has_function_privilege('service_role', 'public.cns_close_contracted_service_chat(uuid,uuid,text,text,text,boolean)', 'EXECUTE')
    and not has_function_privilege('authenticated', 'public.cns_close_contracted_service_chat(uuid,uuid,text,text,text,boolean)', 'EXECUTE'),
  'chat close helper granted to service_role only'
);

-- ---------------------------------------------------------------------------
-- cns_build_contracted_service_cancel_system_message
-- ---------------------------------------------------------------------------

select throws_ok(
  $$ select public.cns_build_contracted_service_cancel_system_message('bot', null, false, null) $$,
  '22023',
  'INVALID_INITIATOR',
  'message builder rejects invalid initiator'
);

select is(
  public.cns_build_contracted_service_cancel_system_message('client', 'FULL_REFUND', false, null),
  'O serviço foi cancelado pelo cliente. O valor pago será reembolsado integralmente (incluindo taxas de cartão).',
  'message builder: client FULL_REFUND'
);

select is(
  public.cns_build_contracted_service_cancel_system_message('client', 'PENALTY_10', false, null),
  'O serviço foi cancelado pelo cliente. Será reembolsado 90% do valor do serviço por cancelamento com menos de 48 h de antecedência (taxas de cartão não são reembolsadas).',
  'message builder: client PENALTY_10'
);

select is(
  public.cns_build_contracted_service_cancel_system_message('client', 'PENALTY_30', false, null),
  'O serviço foi cancelado pelo cliente. Será reembolsado 70% do valor do serviço por cancelamento de última hora (taxas de cartão não são reembolsadas).',
  'message builder: client PENALTY_30'
);

select is(
  public.cns_build_contracted_service_cancel_system_message('client', 'UNKNOWN', false, null),
  'O serviço foi cancelado pelo cliente. O estorno seguirá as regras dos Termos de Uso.',
  'message builder: client unknown tier fallback'
);

select is(
  public.cns_build_contracted_service_cancel_system_message('client', null, true, null),
  'O serviço foi cancelado pelo cliente. A cobrança ainda não havia sido realizada.',
  'message builder: pre-charge client cancel'
);

select is(
  public.cns_build_contracted_service_cancel_system_message('provider', null, true, null),
  'O serviço foi cancelado pelo prestador. A cobrança ainda não havia sido realizada.',
  'message builder: pre-charge provider cancel'
);

select is(
  public.cns_build_contracted_service_cancel_system_message('provider', 'PROVIDER_FULL_REFUND', false, null),
  'O serviço foi cancelado pelo prestador. O valor pago será estornado integralmente (o processamento pode levar de 30 a 60 dias).',
  'message builder: provider post-charge full refund'
);

select is(
  public.cns_build_contracted_service_cancel_system_message('system', null, false, 'NON_PAYMENT'),
  'O serviço foi cancelado automaticamente por falta de pagamento.',
  'message builder: system NON_PAYMENT'
);

select is(
  public.cns_build_contracted_service_cancel_system_message('system', null, false, 'PROVIDER_SUSPENDED'),
  'O serviço foi cancelado automaticamente porque o prestador está temporariamente indisponível.',
  'message builder: system PROVIDER_SUSPENDED'
);

select is(
  public.cns_build_contracted_service_cancel_system_message('system', null, false, 'OTHER'),
  'O serviço foi cancelado automaticamente.',
  'message builder: system default reason'
);

-- ---------------------------------------------------------------------------
-- cns_close_contracted_service_chat (direct)
-- ---------------------------------------------------------------------------

select throws_ok(
  $$ select public.cns_close_contracted_service_chat(gen_random_uuid(), null, 'bot') $$,
  '22023',
  'INVALID_INITIATOR',
  'chat close helper rejects invalid initiator'
);

select is(
  public.cns_close_contracted_service_chat(gen_random_uuid(), null, 'client'),
  null,
  'chat close helper returns null for missing contracted service'
);

do $seed$
declare
  v_pre_paid_id uuid := gen_random_uuid();
  v_post_paid_id uuid := gen_random_uuid();
  v_penalty_id uuid := gen_random_uuid();
  v_penalty30_id uuid := gen_random_uuid();
  v_provider_refund_id uuid := gen_random_uuid();
  v_provider_pre_id uuid := gen_random_uuid();
  v_auto_id uuid := gen_random_uuid();
  v_auto_suspended_id uuid := gen_random_uuid();
  v_no_chat_id uuid := gen_random_uuid();
  v_active_id uuid := gen_random_uuid();
  v_active_gate_id uuid := gen_random_uuid();
  v_open_sr_id uuid := gen_random_uuid();
  v_provider_id uuid := '5d09e025-20a2-4842-aeef-324d42a431e1'::uuid;
  v_suspended_provider_id uuid := '4cf92e3a-64cd-4491-998e-9163138f8e96'::uuid;
  v_fixture record;
  v_client_id uuid;
begin
  -- pre-PAID client cancel
  select * into v_fixture from pg_temp.cns_seed_cancel_chat_fixture(v_pre_paid_id, v_provider_id);
  insert into public.payment_schedules (
    contracted_service_id, client_id, provider_id, gateway_slug,
    installment_number, base_amount, commission_rate_pct, provider_payout,
    charge_scheduled_at, state, idempotency_key,
    gateway_reference_code)
  values (
    v_pre_paid_id, v_fixture.client_id, v_provider_id, 'netcred',
    1, 100.00, 10.00, 90.00, now() + interval '5 days',
    'SCHEDULED'::public.payment_schedule_state, v_pre_paid_id::text,
    v_pre_paid_id);

  -- post-PAID full refund (>48h)
  select * into v_fixture from pg_temp.cns_seed_cancel_chat_fixture(
    v_post_paid_id, v_provider_id, current_date + 10, 'CONFIRMED'::public.contracted_service_status
  );
  insert into public.payment_schedules (
    contracted_service_id, client_id, provider_id, gateway_slug,
    installment_number, base_amount, commission_rate_pct, provider_payout,
    charge_scheduled_at, state, idempotency_key, paid_at, paid_amount, gateway_transaction_id,
    gateway_reference_code)
  values (
    v_post_paid_id, v_fixture.client_id, v_provider_id, 'netcred',
    1, 100.00, 10.00, 90.00, now() - interval '1 day',
    'PAID'::public.payment_schedule_state, v_post_paid_id::text,
    now() - interval '1 day', 110.00, 'txn-cancel-chat-full',
    v_post_paid_id);

  -- PENALTY_10 (tomorrow morning)
  select * into v_fixture from pg_temp.cns_seed_cancel_chat_fixture(
    v_penalty_id, v_provider_id, current_date + 1, 'CONFIRMED'::public.contracted_service_status
  );
  insert into public.payment_schedules (
    contracted_service_id, client_id, provider_id, gateway_slug,
    installment_number, base_amount, commission_rate_pct, provider_payout,
    charge_scheduled_at, state, idempotency_key, paid_at, paid_amount, gateway_transaction_id,
    gateway_reference_code)
  values (
    v_penalty_id, v_fixture.client_id, v_provider_id, 'netcred',
    1, 100.00, 10.00, 90.00, now() - interval '1 day',
    'PAID'::public.payment_schedule_state, v_penalty_id::text,
    now() - interval '1 day', 110.00, 'txn-cancel-chat-penalty',
    v_penalty_id);

  -- PENALTY_30 (today morning — execution already passed or <12h)
  select * into v_fixture from pg_temp.cns_seed_cancel_chat_fixture(
    v_penalty30_id, v_provider_id, current_date, 'CONFIRMED'::public.contracted_service_status
  );
  insert into public.payment_schedules (
    contracted_service_id, client_id, provider_id, gateway_slug,
    installment_number, base_amount, commission_rate_pct, provider_payout,
    charge_scheduled_at, state, idempotency_key, paid_at, paid_amount, gateway_transaction_id,
    gateway_reference_code)
  values (
    v_penalty30_id, v_fixture.client_id, v_provider_id, 'netcred',
    1, 100.00, 10.00, 90.00, now() - interval '1 day',
    'PAID'::public.payment_schedule_state, v_penalty30_id::text,
    now() - interval '1 day', 110.00, 'txn-cancel-chat-penalty30',
    v_penalty30_id);

  -- provider post-PAID refund
  select * into v_fixture from pg_temp.cns_seed_cancel_chat_fixture(
    v_provider_refund_id, v_provider_id, current_date + 10, 'CONFIRMED'::public.contracted_service_status
  );
  insert into public.payment_schedules (
    contracted_service_id, client_id, provider_id, gateway_slug,
    installment_number, base_amount, commission_rate_pct, provider_payout,
    charge_scheduled_at, state, idempotency_key, paid_at, paid_amount, gateway_transaction_id,
    gateway_reference_code)
  values (
    v_provider_refund_id, v_fixture.client_id, v_provider_id, 'netcred',
    1, 100.00, 10.00, 90.00, now() - interval '1 day',
    'PAID'::public.payment_schedule_state, v_provider_refund_id::text,
    now() - interval '1 day', 110.00, 'txn-cancel-chat-provider',
    v_provider_refund_id);

  -- provider pre-PAID cancel
  select * into v_fixture from pg_temp.cns_seed_cancel_chat_fixture(
    v_provider_pre_id, v_provider_id, current_date + 5, 'PENDING_PAYMENT'::public.contracted_service_status
  );
  insert into public.payment_schedules (
    contracted_service_id, client_id, provider_id, gateway_slug,
    installment_number, base_amount, commission_rate_pct, provider_payout,
    charge_scheduled_at, state, idempotency_key,
    gateway_reference_code)
  values (
    v_provider_pre_id, v_fixture.client_id, v_provider_id, 'netcred',
    1, 100.00, 10.00, 90.00, now() + interval '2 days',
    'SCHEDULED'::public.payment_schedule_state, v_provider_pre_id::text,
    v_provider_pre_id);

  -- auto-cancel NON_PAYMENT
  select * into v_fixture from pg_temp.cns_seed_cancel_chat_fixture(
    v_auto_id, v_provider_id, current_date, 'PENDING_PAYMENT'::public.contracted_service_status
  );
  insert into public.payment_schedules (
    contracted_service_id, client_id, provider_id, gateway_slug,
    installment_number, base_amount, commission_rate_pct, provider_payout,
    charge_scheduled_at, state, idempotency_key, failure_reason,
    gateway_reference_code)
  values (
    v_auto_id, v_fixture.client_id, v_provider_id, 'netcred',
    1, 100.00, 10.00, 90.00, now() - interval '1 hour',
    'FAILED'::public.payment_schedule_state, v_auto_id::text, 'CARD_DECLINED',
    v_auto_id);

  -- auto-cancel PROVIDER_SUSPENDED
  insert into public.provider_gateway_accounts (
    provider_id, gateway_slug, document, onboarding_status
  )
  values (
    v_suspended_provider_id, 'netcred', '99988877766',
    'SUSPENDED'::public.payment_provider_onboarding_status
  )
  on conflict (provider_id, gateway_slug) do update
  set onboarding_status = 'SUSPENDED'::public.payment_provider_onboarding_status;

  select * into v_fixture from pg_temp.cns_seed_cancel_chat_fixture(
    v_auto_suspended_id, v_suspended_provider_id, current_date, 'PENDING_PAYMENT'::public.contracted_service_status
  );
  insert into public.payment_schedules (
    contracted_service_id, client_id, provider_id, gateway_slug,
    installment_number, base_amount, commission_rate_pct, provider_payout,
    charge_scheduled_at, state, idempotency_key,
    gateway_reference_code)
  values (
    v_auto_suspended_id, v_fixture.client_id, v_suspended_provider_id, 'netcred',
    1, 100.00, 10.00, 90.00, now() - interval '1 hour',
    'SCHEDULED'::public.payment_schedule_state, v_auto_suspended_id::text,
    v_auto_suspended_id);

  -- contracted service without chat
  select * into v_fixture from pg_temp.cns_seed_cancel_chat_fixture(
    v_no_chat_id, v_provider_id, current_date + 3, 'PENDING_PAYMENT'::public.contracted_service_status,
    'COMPLETED'::public.service_request_status, false
  );

  -- active contracted service for messaging gate (never closed/cancelled)
  select * into v_fixture from pg_temp.cns_seed_cancel_chat_fixture(
    v_active_gate_id, v_provider_id, current_date + 7, 'CONFIRMED'::public.contracted_service_status
  );

  -- active contracted service for direct chat-close helper tests
  select * into v_fixture from pg_temp.cns_seed_cancel_chat_fixture(
    v_active_id, v_provider_id, current_date + 7, 'CONFIRMED'::public.contracted_service_status
  );

  -- OPEN service request chat (no contracted service row needed for gate)
  select sr.client_id into v_client_id
  from public.service_requests sr
  where sr.id = '7017e457-5a32-44e7-b8da-1727a14f4d33'::uuid;

  insert into public.service_requests (
    id, client_id, service_id, address_id, title, description, form_data, form_version, status, urgency
  )
  select
    v_open_sr_id, sr.client_id, sr.service_id, sr.address_id,
    'cancel chat open SR gate', sr.description, sr.form_data, sr.form_version,
    'OPEN'::public.service_request_status, sr.urgency
  from public.service_requests sr
  where sr.id = '7017e457-5a32-44e7-b8da-1727a14f4d33'::uuid;

  perform set_config('test.cancel_chat.pre_paid', v_pre_paid_id::text, true);
  perform set_config('test.cancel_chat.post_paid', v_post_paid_id::text, true);
  perform set_config('test.cancel_chat.penalty', v_penalty_id::text, true);
  perform set_config('test.cancel_chat.penalty30', v_penalty30_id::text, true);
  perform set_config('test.cancel_chat.provider_refund', v_provider_refund_id::text, true);
  perform set_config('test.cancel_chat.provider_pre', v_provider_pre_id::text, true);
  perform set_config('test.cancel_chat.auto', v_auto_id::text, true);
  perform set_config('test.cancel_chat.auto_suspended', v_auto_suspended_id::text, true);
  perform set_config('test.cancel_chat.no_chat', v_no_chat_id::text, true);
  perform set_config('test.cancel_chat.active', v_active_id::text, true);
  perform set_config('test.cancel_chat.active_gate', v_active_gate_id::text, true);
  perform set_config('test.cancel_chat.open_sr', v_open_sr_id::text, true);
  perform set_config('test.cancel_chat.client_id', v_fixture.client_id::text, true);
  perform set_config('test.cancel_chat.provider_id', v_provider_id::text, true);
  perform set_config(
    'test.cancel_chat.open_chat',
    pg_temp.cns_seed_chat(v_open_sr_id, v_client_id, v_provider_id)::text,
    true
  );
end;
$seed$;

select is(
  public.cns_close_contracted_service_chat(
    current_setting('test.cancel_chat.no_chat')::uuid,
    null,
    'client'
  ),
  null,
  'chat close helper returns null when no chat exists'
);

select is(
  public.cns_close_contracted_service_chat(
    current_setting('test.cancel_chat.active')::uuid,
    current_setting('test.cancel_chat.client_id')::uuid,
    'client',
    'CLIENT_INITIATED',
    'FULL_REFUND',
    false
  ),
  (
    select c.id
    from public.contracted_services cs
    join public.chats c on c.service_request_id = cs.service_request_id
      and c.provider_id = cs.provider_id
    where cs.id = current_setting('test.cancel_chat.active')::uuid
  ),
  'chat close helper returns chat id when chat exists'
);

select ok(
  (
    select c.status = 'CLOSED'::public.cns_conversation_status
      and c.closure_type = 'CONTRACTED_SERVICE_CANCELLED'::public.cns_closure_type
      and c.closed_by_user_id = current_setting('test.cancel_chat.client_id')::uuid
      and c.closure_reason like '%reembolsado integralmente%'
    from public.contracted_services cs
    join public.chats c on c.service_request_id = cs.service_request_id
      and c.provider_id = cs.provider_id
    where cs.id = current_setting('test.cancel_chat.active')::uuid
  ),
  'chat close helper sets closure metadata on chat row'
);

select ok(
  (
    select exists (
      select 1
      from public.contracted_services cs
      join public.chat_messages m on m.chat_id = (
        select c.id from public.chats c
        where c.service_request_id = cs.service_request_id
          and c.provider_id = cs.provider_id
      )
      where cs.id = current_setting('test.cancel_chat.active')::uuid
        and m.message_type = 'SYSTEM'::public.cns_message_type
        and m.sender_user_id is null
        and m.linked_entity_type = 'service_request'
        and m.linked_entity_id = cs.service_request_id
    )
  ),
  'chat close helper inserts linked SYSTEM message'
);

select is(
  public.cns_close_contracted_service_chat(
    current_setting('test.cancel_chat.active')::uuid,
    current_setting('test.cancel_chat.client_id')::uuid,
    'client',
    'CLIENT_INITIATED',
    'FULL_REFUND',
    false
  ),
  (
    select c.id
    from public.contracted_services cs
    join public.chats c on c.service_request_id = cs.service_request_id
      and c.provider_id = cs.provider_id
    where cs.id = current_setting('test.cancel_chat.active')::uuid
  ),
  'chat close helper is idempotent when chat already closed'
);

select is(
  (
    select count(*)::int
    from public.contracted_services cs
    join public.chat_messages m on m.chat_id = (
      select c.id from public.chats c
      where c.service_request_id = cs.service_request_id
        and c.provider_id = cs.provider_id
    )
    where cs.id = current_setting('test.cancel_chat.active')::uuid
      and m.message_type = 'SYSTEM'::public.cns_message_type
  ),
  1,
  'chat close helper does not duplicate SYSTEM message on second call'
);

-- ---------------------------------------------------------------------------
-- cns_service_request_allows_chat_messaging
-- ---------------------------------------------------------------------------

select is(
  public.cns_service_request_allows_chat_messaging(
    current_setting('test.cancel_chat.open_sr')::uuid,
    current_setting('test.cancel_chat.open_chat')::uuid
  ),
  true,
  'messaging gate allows OPEN service request chat'
);

select is(
  public.cns_service_request_allows_chat_messaging(
    (
      select cs.service_request_id
      from public.contracted_services cs
      where cs.id = current_setting('test.cancel_chat.active_gate')::uuid
    ),
    (
      select c.id
      from public.contracted_services cs
      join public.chats c on c.service_request_id = cs.service_request_id
        and c.provider_id = cs.provider_id
      where cs.id = current_setting('test.cancel_chat.active_gate')::uuid
    )
  ),
  true,
  'messaging gate allows active non-cancelled contracted service chat'
);

-- ---------------------------------------------------------------------------
-- payment_pre_charge_cancel + chat
-- ---------------------------------------------------------------------------

select lives_ok(
  format(
    $$ select public.payment_pre_charge_cancel(%L::uuid, %L::uuid, 'CLIENT_INITIATED', 'client') $$,
    current_setting('test.cancel_chat.pre_paid'),
    current_setting('test.cancel_chat.client_id')
  ),
  'payment_pre_charge_cancel client path succeeds'
);

select is(
  (
    select cs.status::text
    from public.contracted_services cs
    where cs.id = current_setting('test.cancel_chat.pre_paid')::uuid
  ),
  'CANCELLED',
  'pre-charge cancel sets contracted service CANCELLED'
);

select is(
  (
    select ps.state::text
    from public.payment_schedules ps
    where ps.contracted_service_id = current_setting('test.cancel_chat.pre_paid')::uuid
  ),
  'CANCELLED',
  'pre-charge cancel sets schedule CANCELLED'
);

select ok(
  exists (
    select 1
    from public.payment_audit_log pal
    where pal.service_id = current_setting('test.cancel_chat.pre_paid')::uuid
      and pal.event_type = 'PRE_CHARGE_CANCELLED'
  ),
  'pre-charge cancel writes PRE_CHARGE_CANCELLED audit'
);

select ok(
  (
    select exists (
      select 1
      from public.contracted_services cs
      join public.chats c on c.service_request_id = cs.service_request_id
        and c.provider_id = cs.provider_id
      join public.chat_messages m on m.chat_id = c.id
      where cs.id = current_setting('test.cancel_chat.pre_paid')::uuid
        and c.status = 'CLOSED'::public.cns_conversation_status
        and m.payload->>'text' like '%cobrança ainda não havia sido realizada%'
    )
  ),
  'pre-charge client cancel closes chat with pre-charge system message'
);

select lives_ok(
  format(
    $$ select public.payment_pre_charge_cancel(%L::uuid, %L::uuid, 'PROVIDER_INITIATED', 'provider') $$,
    current_setting('test.cancel_chat.provider_pre'),
    current_setting('test.cancel_chat.provider_id')
  ),
  'payment_pre_charge_cancel provider path succeeds'
);

select ok(
  (
    select c.closed_by_user_id = current_setting('test.cancel_chat.provider_id')::uuid
      and exists (
        select 1
        from public.chat_messages m
        where m.chat_id = c.id
          and m.payload->>'text' like '%cancelado pelo prestador%'
          and m.payload->>'text' like '%cobrança ainda não%'
      )
    from public.contracted_services cs
    join public.chats c on c.service_request_id = cs.service_request_id
      and c.provider_id = cs.provider_id
    where cs.id = current_setting('test.cancel_chat.provider_pre')::uuid
  ),
  'pre-charge provider cancel closes chat with provider system message'
);

-- ---------------------------------------------------------------------------
-- Option A: prepare (no cancel) + commit (cancel + chat)
-- ---------------------------------------------------------------------------

select lives_ok(
  format(
    $$ select public.payment_prepare_refund_request(%L::uuid, %L::uuid, 'CLIENT_INITIATED', 'client') $$,
    current_setting('test.cancel_chat.post_paid'),
    current_setting('test.cancel_chat.client_id')
  ),
  'payment_prepare_refund_request client FULL_REFUND path succeeds'
);

select is(
  (
    select ps.state::text
    from public.payment_schedules ps
    where ps.contracted_service_id = current_setting('test.cancel_chat.post_paid')::uuid
  ),
  'PAID',
  'prepare leaves schedule PAID (Option A)'
);

select lives_ok(
  format(
    $$ select public.payment_commit_refund_after_gateway(
         %L::uuid, %L::uuid, 'CLIENT_INITIATED', 'client', null
       ) $$,
    current_setting('test.cancel_chat.post_paid'),
    current_setting('test.cancel_chat.client_id')
  ),
  'payment_commit_refund_after_gateway client FULL_REFUND path succeeds'
);

select is(
  (
    select ps.state::text
    from public.payment_schedules ps
    where ps.contracted_service_id = current_setting('test.cancel_chat.post_paid')::uuid
  ),
  'REFUND_REQUESTED',
  'post-PAID commit sets schedule REFUND_REQUESTED'
);

select ok(
  exists (
    select 1
    from public.payment_audit_log pal
    where pal.service_id = current_setting('test.cancel_chat.post_paid')::uuid
      and pal.event_type = 'REFUND_SUBMITTED'
      and pal.metadata->>'penalty_tier' = 'FULL_REFUND'
  ),
  'post-PAID commit writes REFUND_SUBMITTED audit with penalty tier'
);

select ok(
  (
    select exists (
      select 1
      from public.contracted_services cs
      join public.chats c on c.service_request_id = cs.service_request_id
        and c.provider_id = cs.provider_id
      join public.chat_messages m on m.chat_id = c.id
      where cs.id = current_setting('test.cancel_chat.post_paid')::uuid
        and c.closure_type = 'CONTRACTED_SERVICE_CANCELLED'::public.cns_closure_type
        and m.payload->>'text' like '%reembolsado integralmente%'
    )
  ),
  'post-PAID FULL_REFUND closes chat with matching system message'
);

select is(
  (
    select public.payment_commit_refund_after_gateway(
      current_setting('test.cancel_chat.penalty')::uuid,
      current_setting('test.cancel_chat.client_id')::uuid,
      'CLIENT_INITIATED',
      'client',
      null
    )->>'penalty_tier'
  ),
  'PENALTY_10',
  'payment_commit_refund_after_gateway returns PENALTY_10 within 12-48h window'
);

select ok(
  (
    select exists (
      select 1
      from public.contracted_services cs
      join public.chat_messages m on m.chat_id = (
        select c.id from public.chats c
        where c.service_request_id = cs.service_request_id
          and c.provider_id = cs.provider_id
      )
      where cs.id = current_setting('test.cancel_chat.penalty')::uuid
        and m.payload->>'text' like '%90% do valor do serviço%'
    )
  ),
  'PENALTY_10 cancel inserts partial-refund system message'
);

select is(
  (
    select public.payment_commit_refund_after_gateway(
      current_setting('test.cancel_chat.penalty30')::uuid,
      current_setting('test.cancel_chat.client_id')::uuid,
      'CLIENT_INITIATED',
      'client',
      null
    )->>'penalty_tier'
  ),
  'PENALTY_30',
  'payment_commit_refund_after_gateway returns PENALTY_30 within <12h window'
);

select ok(
  (
    select exists (
      select 1
      from public.contracted_services cs
      join public.chat_messages m on m.chat_id = (
        select c.id from public.chats c
        where c.service_request_id = cs.service_request_id
          and c.provider_id = cs.provider_id
      )
      where cs.id = current_setting('test.cancel_chat.penalty30')::uuid
        and m.payload->>'text' like '%70% do valor do serviço%'
    )
  ),
  'PENALTY_30 cancel inserts last-minute partial-refund system message'
);

select lives_ok(
  format(
    $$ select public.payment_commit_refund_after_gateway(
         %L::uuid, %L::uuid, 'PROVIDER_INITIATED', 'provider', null
       ) $$,
    current_setting('test.cancel_chat.provider_refund'),
    current_setting('test.cancel_chat.provider_id')
  ),
  'payment_commit_refund_after_gateway provider path succeeds'
);

select ok(
  (
    select exists (
      select 1
      from public.contracted_services cs
      join public.chats c on c.service_request_id = cs.service_request_id
        and c.provider_id = cs.provider_id
      join public.chat_messages m on m.chat_id = c.id
      where cs.id = current_setting('test.cancel_chat.provider_refund')::uuid
        and c.closed_by_user_id = current_setting('test.cancel_chat.provider_id')::uuid
        and m.payload->>'text' like '%cancelado pelo prestador%'
        and m.payload->>'text' like '%estornado integralmente%'
    )
  ),
  'provider post-PAID refund closes chat with provider full-refund message'
);

select lives_ok(
  format(
    $$ select public.payment_commit_refund_after_gateway(%L::uuid, %L::uuid, 'CLIENT_INITIATED', 'client', null) $$,
    current_setting('test.cancel_chat.post_paid'),
    current_setting('test.cancel_chat.client_id')
  ),
  'idempotent commit succeeds when already REFUND_REQUESTED + SUBMITTED'
);

-- Commit already set SUBMITTED; ACK re-entry returns already_submitted=true.
select is(
  (
    select public.payment_commit_refund_after_gateway(
      current_setting('test.cancel_chat.post_paid')::uuid,
      current_setting('test.cancel_chat.client_id')::uuid,
      'CLIENT_INITIATED',
      'client',
      null
    )->>'already_submitted'
  ),
  'true',
  'idempotent commit returns already_submitted=true after gateway ACK'
);

select isnt(
  (
    select public.payment_commit_refund_after_gateway(
      current_setting('test.cancel_chat.post_paid')::uuid,
      current_setting('test.cancel_chat.client_id')::uuid,
      'CLIENT_INITIATED',
      'client',
      null
    )->>'penalty_tier'
  ),
  null,
  'idempotent commit returns computed penalty_tier'
);

select is(
  (
    select count(*)::int
    from public.contracted_services cs
    join public.chat_messages m on m.chat_id = (
      select c.id from public.chats c
      where c.service_request_id = cs.service_request_id
        and c.provider_id = cs.provider_id
    )
    where cs.id = current_setting('test.cancel_chat.post_paid')::uuid
      and m.message_type = 'SYSTEM'::public.cns_message_type
  ),
  1,
  'idempotent commit does not duplicate system message'
);

select is(
  public.cns_service_request_allows_chat_messaging(
    (
      select cs.service_request_id
      from public.contracted_services cs
      where cs.id = current_setting('test.cancel_chat.post_paid')::uuid
    ),
    (
      select c.id
      from public.contracted_services cs
      join public.chats c on c.service_request_id = cs.service_request_id
        and c.provider_id = cs.provider_id
      where cs.id = current_setting('test.cancel_chat.post_paid')::uuid
    )
  ),
  false,
  'messaging gate blocks cancelled contracted service chat'
);

select pg_temp.cns_set_auth(current_setting('test.cancel_chat.client_id')::uuid);

select throws_ok(
  format(
    $sql$
      select public.cns_send_message(
        'TEXT'::public.cns_message_type,
        gen_random_uuid(),
        jsonb_build_object('text', 'Should fail'),
        (
          select c.id
          from public.contracted_services cs
          join public.chats c on c.service_request_id = cs.service_request_id
            and c.provider_id = cs.provider_id
          where cs.id = %L::uuid
        )
      );
    $sql$,
    current_setting('test.cancel_chat.post_paid')
  ),
  'P0001',
  'SR_NOT_OPEN',
  'cns_send_message rejects cancelled contracted-service chat'
);

-- ---------------------------------------------------------------------------
-- payment_auto_cancel_services + chat
-- ---------------------------------------------------------------------------

select pg_temp.payment_set_service_role();

select ok(
  (
    with batch as (
      select public.payment_auto_cancel_services(50) as payload
    )
    select exists (
      select 1
      from batch,
      jsonb_array_elements(batch.payload->'cancelled') item
      where item->>'service_id' = current_setting('test.cancel_chat.auto')
        and item->>'last_failure_reason' = 'CARD_DECLINED'
        and item->>'cancellation_reason' = 'NON_PAYMENT'
    )
  ),
  'auto-cancel batch result includes last_failure_reason'
);

select ok(
  (
    select exists (
      select 1
      from public.contracted_services cs
      join public.chats c on c.service_request_id = cs.service_request_id
        and c.provider_id = cs.provider_id
      join public.chat_messages m on m.chat_id = c.id
      where cs.id = current_setting('test.cancel_chat.auto')::uuid
        and cs.status = 'CANCELLED'::public.contracted_service_status
        and cs.cancellation_reason = 'NON_PAYMENT'
        and c.status = 'CLOSED'::public.cns_conversation_status
        and m.payload->>'text' like '%falta de pagamento%'
    )
  ),
  'auto-cancel NON_PAYMENT closes chat with system message'
);

select ok(
  exists (
    select 1
    from public.payment_audit_log pal
    where pal.service_id = current_setting('test.cancel_chat.auto')::uuid
      and pal.event_type = 'AUTO_CANCELLED'
      and pal.metadata->>'last_failure_reason' = 'CARD_DECLINED'
  ),
  'auto-cancel persists last_failure_reason in audit metadata'
);

select ok(
  (
    select exists (
      select 1
      from public.contracted_services cs
      join public.chats c on c.service_request_id = cs.service_request_id
        and c.provider_id = cs.provider_id
      join public.chat_messages m on m.chat_id = c.id
      where cs.id = current_setting('test.cancel_chat.auto_suspended')::uuid
        and cs.cancellation_reason = 'PROVIDER_SUSPENDED'
        and m.payload->>'text' like '%prestador está temporariamente indisponível%'
    )
  ),
  'auto-cancel PROVIDER_SUSPENDED closes chat with suspended-provider message'
);

select finish();

rollback;

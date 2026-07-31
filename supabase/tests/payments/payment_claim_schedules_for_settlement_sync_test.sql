-- pgTAP: payment_claim_schedules_for_settlement_sync eligibility + lease.

begin;

select plan(11);

create or replace function pg_temp.payment_set_service_role()
returns void
language plpgsql
as $$
begin
  reset role;
  perform set_config(
    'request.jwt.claims',
    json_build_object('role', 'service_role')::text,
    true
  );
  perform set_config('request.jwt.claim.role', 'service_role', true);
  perform set_config('request.jwt.claim.sub', '', true);
end;
$$;

create or replace function pg_temp.payment_set_auth(p_user_id uuid)
returns void
language plpgsql
as $$
begin
  reset role;
  execute 'set local role authenticated';
  perform set_config('request.jwt.claim.sub', p_user_id::text, true);
  perform set_config(
    'request.jwt.claims',
    json_build_object('role', 'authenticated', 'sub', p_user_id::text)::text,
    true
  );
  perform set_config('request.jwt.claim.role', 'authenticated', true);
end;
$$;

-- Builds an independent SR → proposal → CS chain (one active schedule per CS).
create or replace function pg_temp.make_contracted_service(
  p_client_id uuid,
  p_provider_id uuid,
  p_label text,
  p_original_amount numeric,
  p_tax_rate numeric,
  p_tax_amount numeric,
  p_final_amount numeric,
  p_pricing_signature text,
  p_slot jsonb
)
returns uuid
language plpgsql
as $$
declare
  v_sr uuid := gen_random_uuid();
  v_proposal uuid := gen_random_uuid();
  v_cs uuid := gen_random_uuid();
begin
  insert into public.service_requests (
    id, client_id, service_id, address_id, title, description,
    form_data, form_version, status, urgency
  )
  select
    v_sr,
    sr.client_id,
    sr.service_id,
    sr.address_id,
    'Settlement claim ' || p_label,
    sr.description,
    sr.form_data,
    sr.form_version,
    'OPEN'::public.service_request_status,
    sr.urgency
  from public.service_requests sr
  where sr.id = '7017e457-5a32-44e7-b8da-1727a14f4d33'::uuid;

  insert into public.provider_proposals (
    id, provider_id, service_request_id, proposed_amount, proposal_description,
    proposal_duration_value, proposal_duration_unit, proposal_suggested_slots,
    photos, tax_rate, tax_amount, final_amount, pricing_signature, status
  )
  values (
    v_proposal,
    p_provider_id,
    v_sr,
    p_original_amount,
    'Settlement claim proposal ' || p_label,
    1,
    'days',
    jsonb_build_array(p_slot),
    '{}'::text[],
    p_tax_rate,
    p_tax_amount,
    p_final_amount,
    p_pricing_signature,
    'ACCEPTED'::public.proposal_status
  );

  insert into public.contracted_services (
    id, service_request_id, accepted_proposal_id, client_id, provider_id,
    duration_unit, duration_value, scheduled_start_date, scheduled_end_date, scheduled_shift,
    agreed_slot, status
  )
  values (
    v_cs,
    v_sr,
    v_proposal,
    p_client_id,
    p_provider_id,
    'days',
    1,
    current_date + 5,
    current_date + 5,
    'morning',
    p_slot,
    'CONFIRMED'::public.contracted_service_status
  );

  return v_cs;
end;
$$;

select throws_ok(
  $$ select public.payment_claim_schedules_for_settlement_sync() $$,
  '42501',
  'service_role required for payment_claim_schedules_for_settlement_sync',
  'rejects non-service_role callers'
);

select ok(
  (
    select p.prosecdef
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname = 'payment_claim_schedules_for_settlement_sync'
  ),
  'payment_claim_schedules_for_settlement_sync is SECURITY DEFINER'
);

select ok(
  has_function_privilege(
    'service_role',
    'public.payment_claim_schedules_for_settlement_sync(integer)',
    'EXECUTE'
  )
    and not has_function_privilege(
      'authenticated',
      'public.payment_claim_schedules_for_settlement_sync(integer)',
      'EXECUTE'
    ),
  'claim RPC is service_role only'
);

select pg_temp.payment_set_service_role();

-- Hermetic baseline: lease any pre-existing unlocked schedules.
update public.payment_schedules
set locked_until = greatest(coalesce(locked_until, now()), now()) + interval '1 day'
where locked_until is null
   or locked_until < now();

select is(
  public.payment_claim_schedules_for_settlement_sync(5),
  '[]'::jsonb,
  'returns empty batch when no eligible settlement schedules exist'
);

do $seed$
declare
  v_client_id uuid;
  v_provider_id uuid := '5d09e025-20a2-4842-aeef-324d42a431e1'::uuid;
  v_sched_eligible uuid := gen_random_uuid();
  v_sched_grace uuid := gen_random_uuid();
  v_sched_settled uuid := gen_random_uuid();
  v_sched_overdue uuid := gen_random_uuid();
  v_cs_eligible uuid;
  v_cs_grace uuid;
  v_cs_settled uuid;
  v_cs_overdue uuid;
  v_pricing record;
  v_slot jsonb := jsonb_build_object(
    'start_date', (current_date + 5)::text,
    'shift', 'morning'
  );
begin
  select sr.client_id
  into v_client_id
  from public.service_requests sr
  where sr.id = '7017e457-5a32-44e7-b8da-1727a14f4d33'::uuid;

  if v_client_id is null then
    raise exception 'settlement claim fixture: seed service_request missing';
  end if;

  perform set_config('request.jwt.claim.sub', v_provider_id::text, true);
  perform set_config(
    'request.jwt.claims',
    json_build_object('role', 'authenticated', 'sub', v_provider_id::text)::text,
    true
  );
  perform set_config('request.jwt.claim.role', 'authenticated', true);

  select * into v_pricing
  from public.calculate_provider_service_pricing(200.00::numeric);

  perform pg_temp.payment_set_service_role();
  perform set_config(
    'request.jwt.claims',
    json_build_object('role', 'service_role', 'sub', v_provider_id::text)::text,
    true
  );

  insert into public.provider_gateway_accounts (
    provider_id,
    gateway_slug,
    document,
    onboarding_status,
    onboarding_activated_at,
    netcred_company_id,
    netcred_bank_account_id
  )
  values (
    v_provider_id,
    'netcred'::public.payment_gateway_slug,
    '12345678901',
    'ACTIVE'::public.payment_provider_onboarding_status,
    now(),
    '1048',
    'bank-account-settlement-claim'
  )
  on conflict (provider_id, gateway_slug) do update
  set
    onboarding_status = 'ACTIVE'::public.payment_provider_onboarding_status,
    netcred_company_id = '1048',
    netcred_bank_account_id = coalesce(
      nullif(btrim(provider_gateway_accounts.netcred_bank_account_id), ''),
      excluded.netcred_bank_account_id
    );

  v_cs_eligible := pg_temp.make_contracted_service(
    v_client_id, v_provider_id, 'eligible',
    v_pricing.original_amount, v_pricing.tax_rate, v_pricing.tax_amount,
    v_pricing.final_amount, v_pricing.pricing_signature, v_slot
  );
  v_cs_grace := pg_temp.make_contracted_service(
    v_client_id, v_provider_id, 'grace',
    v_pricing.original_amount, v_pricing.tax_rate, v_pricing.tax_amount,
    v_pricing.final_amount, v_pricing.pricing_signature, v_slot
  );
  v_cs_settled := pg_temp.make_contracted_service(
    v_client_id, v_provider_id, 'settled',
    v_pricing.original_amount, v_pricing.tax_rate, v_pricing.tax_amount,
    v_pricing.final_amount, v_pricing.pricing_signature, v_slot
  );
  v_cs_overdue := pg_temp.make_contracted_service(
    v_client_id, v_provider_id, 'overdue',
    v_pricing.original_amount, v_pricing.tax_rate, v_pricing.tax_amount,
    v_pricing.final_amount, v_pricing.pricing_signature, v_slot
  );

  -- Eligible: PAID, missing movements, outside 30m grace.
  insert into public.payment_schedules (
    id, contracted_service_id, client_id, provider_id, gateway_slug,
    installment_number, base_amount, commission_rate_pct, provider_payout,
    charge_scheduled_at, state, paid_amount, paid_at, idempotency_key,
    gateway_reference_code, gateway_transaction_id
  )
  values (
    v_sched_eligible,
    v_cs_eligible,
    v_client_id,
    v_provider_id,
    'netcred',
    1,
    200.00,
    10.00,
    180.00,
    now() - interval '3 days',
    'PAID'::public.payment_schedule_state,
    220.00,
    now() - interval '2 hours',
    v_cs_eligible::text,
    v_sched_eligible,
    'claim-settlement-tx-eligible'
  );

  -- Inside grace window and no movements yet → excluded.
  insert into public.payment_schedules (
    id, contracted_service_id, client_id, provider_id, gateway_slug,
    installment_number, base_amount, commission_rate_pct, provider_payout,
    charge_scheduled_at, state, paid_amount, paid_at, idempotency_key,
    gateway_reference_code, gateway_transaction_id
  )
  values (
    v_sched_grace,
    v_cs_grace,
    v_client_id,
    v_provider_id,
    'netcred',
    1,
    200.00,
    10.00,
    180.00,
    now() - interval '1 day',
    'PAID'::public.payment_schedule_state,
    220.00,
    now() - interval '5 minutes',
    v_cs_grace::text,
    v_sched_grace,
    'claim-settlement-tx-grace'
  );

  -- Has settled movement → excluded.
  insert into public.payment_schedules (
    id, contracted_service_id, client_id, provider_id, gateway_slug,
    installment_number, base_amount, commission_rate_pct, provider_payout,
    charge_scheduled_at, state, paid_amount, paid_at, idempotency_key,
    gateway_reference_code, gateway_transaction_id
  )
  values (
    v_sched_settled,
    v_cs_settled,
    v_client_id,
    v_provider_id,
    'netcred',
    1,
    200.00,
    10.00,
    180.00,
    now() - interval '10 days',
    'PAID'::public.payment_schedule_state,
    220.00,
    now() - interval '9 days',
    v_cs_settled::text,
    v_sched_settled,
    'claim-settlement-tx-settled'
  );

  insert into public.payment_settlement_movements (
    payment_schedule_id,
    provider_id,
    gateway_slug,
    gateway_payout_id,
    gateway_movement_id,
    gateway_transaction_id,
    payout_status,
    movement_status,
    record_type,
    gross_amount,
    net_amount,
    settling_at,
    settled_at,
    sync_source
  )
  values (
    v_sched_settled,
    v_provider_id,
    'netcred',
    'payout-settled',
    'mov-claim-settled-1',
    'claim-settlement-tx-settled',
    'PAID_OUT',
    'PAID_OUT',
    'CREDIT',
    180.00,
    180.00,
    current_date - 2,
    now() - interval '1 day',
    'webhook'
  );

  -- Recent paid_at but overdue pending movement → still eligible.
  insert into public.payment_schedules (
    id, contracted_service_id, client_id, provider_id, gateway_slug,
    installment_number, base_amount, commission_rate_pct, provider_payout,
    charge_scheduled_at, state, paid_amount, paid_at, idempotency_key,
    gateway_reference_code, gateway_transaction_id
  )
  values (
    v_sched_overdue,
    v_cs_overdue,
    v_client_id,
    v_provider_id,
    'netcred',
    1,
    200.00,
    10.00,
    180.00,
    now() - interval '40 days',
    'PAID'::public.payment_schedule_state,
    220.00,
    now() - interval '10 minutes',
    v_cs_overdue::text,
    v_sched_overdue,
    'claim-settlement-tx-overdue'
  );

  insert into public.payment_settlement_movements (
    payment_schedule_id,
    provider_id,
    gateway_slug,
    gateway_payout_id,
    gateway_movement_id,
    gateway_transaction_id,
    payout_status,
    movement_status,
    record_type,
    gross_amount,
    net_amount,
    settling_at,
    settled_at,
    sync_source
  )
  values (
    v_sched_overdue,
    v_provider_id,
    'netcred',
    'payout-overdue',
    'mov-claim-overdue-1',
    'claim-settlement-tx-overdue',
    'PENDING',
    'PENDING',
    'CREDIT',
    180.00,
    180.00,
    current_date - 3,
    null,
    'webhook'
  );

  perform set_config('test.claim.eligible', v_sched_eligible::text, true);
  perform set_config('test.claim.grace', v_sched_grace::text, true);
  perform set_config('test.claim.settled', v_sched_settled::text, true);
  perform set_config('test.claim.overdue', v_sched_overdue::text, true);
  perform set_config('test.claim.provider_id', v_provider_id::text, true);
end;
$seed$;

select is(
  (
    select count(*)::int
    from jsonb_array_elements(
      public.payment_claim_schedules_for_settlement_sync(10)
    ) e
    where (e.value->>'schedule_id')::uuid in (
      current_setting('test.claim.eligible')::uuid,
      current_setting('test.claim.overdue')::uuid
    )
  ),
  2,
  'claims missing-movement (past grace) and overdue-pending schedules'
);

-- Re-claim should skip locked rows until lease expires.
select is(
  (
    select count(*)::int
    from jsonb_array_elements(
      public.payment_claim_schedules_for_settlement_sync(10)
    ) e
    where (e.value->>'schedule_id')::uuid in (
      current_setting('test.claim.eligible')::uuid,
      current_setting('test.claim.overdue')::uuid
    )
  ),
  0,
  'already-leased schedules are skipped on next claim tick'
);

select is(
  (
    select count(*)::int
    from public.payment_schedules
    where id in (
      current_setting('test.claim.grace')::uuid,
      current_setting('test.claim.settled')::uuid
    )
      and locked_until is not null
      and locked_until > now()
  ),
  0,
  'grace-window and fully-settled schedules are not claimed'
);

-- Unlock and verify batch size + payload shape.
update public.payment_schedules
set locked_until = null
where id in (
  current_setting('test.claim.eligible')::uuid,
  current_setting('test.claim.overdue')::uuid
);

select is(
  jsonb_array_length(public.payment_claim_schedules_for_settlement_sync(1)),
  1,
  'respects p_batch_size limit'
);

update public.payment_schedules
set locked_until = null
where id in (
  current_setting('test.claim.eligible')::uuid,
  current_setting('test.claim.overdue')::uuid
);

select ok(
  (
    select
      (e.value ? 'schedule_id')
      and (e.value ? 'provider_id')
      and (e.value ? 'gateway_transaction_id')
      and (e.value ? 'netcred_company_id')
      and e.value->>'netcred_company_id' = '1048'
    from jsonb_array_elements(
      public.payment_claim_schedules_for_settlement_sync(10)
    ) e
    where (e.value->>'schedule_id')::uuid = current_setting('test.claim.eligible')::uuid
    limit 1
  ),
  'claim payload includes schedule/provider/tx/company fields'
);

select is(
  (
    select locked_until is not null and locked_until > now()
    from public.payment_schedules
    where id = current_setting('test.claim.eligible')::uuid
  ),
  true,
  'claim sets locked_until lease on selected schedules'
);

select pg_temp.payment_set_auth(current_setting('test.claim.provider_id')::uuid);

select throws_ok(
  $$ select public.payment_claim_schedules_for_settlement_sync(5) $$,
  '42501',
  null,
  'authenticated cannot execute claim even with JWT'
);

select * from finish();

rollback;

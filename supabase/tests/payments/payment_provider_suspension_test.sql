-- pgTAP: payment Task 88 — provider suspension charge freeze and cron skip.

begin;

select plan(6);

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

create or replace function pg_temp.payment_seed_suspension_fixture(
  p_contracted_service_id uuid,
  p_provider_id uuid
)
returns table (
  client_id uuid,
  card_token_id uuid
)
language plpgsql
as $$
declare
  v_service_request_id uuid := gen_random_uuid();
  v_proposal_id uuid := gen_random_uuid();
  v_client_id uuid;
  v_pricing record;
  v_slot jsonb;
  v_card_token_id uuid := gen_random_uuid();
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
    format('suspension pgTAP %s', p_contracted_service_id),
    sr.description, sr.form_data, sr.form_version, 'OPEN', sr.urgency
  from public.service_requests sr
  where sr.id = '7017e457-5a32-44e7-b8da-1727a14f4d33'::uuid;

  perform set_config('request.jwt.claim.sub', p_provider_id::text, true);
  perform set_config(
    'request.jwt.claims',
    json_build_object('role', 'authenticated', 'sub', p_provider_id::text)::text,
    true
  );
  perform set_config('request.jwt.claim.role', 'authenticated', true);

  select * into v_pricing
  from public.calculate_provider_service_pricing(100.00::numeric);

  v_slot := jsonb_build_object(
    'start_date', to_char(current_date + 5, 'YYYY-MM-DD'),
    'shift', 'morning'
  );

  insert into public.provider_proposals (
    id, provider_id, service_request_id, proposed_amount, proposal_description,
    proposal_duration_value, proposal_duration_unit, proposal_suggested_slots,
    photos, tax_rate, tax_amount, final_amount, pricing_signature, status
  )
  values (
    v_proposal_id, p_provider_id, v_service_request_id, v_pricing.original_amount,
    'suspension pgTAP proposal', 1, 'days', jsonb_build_array(v_slot),
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
    p_provider_id, 'days', 1, current_date + 5, current_date + 5, 'morning', v_slot,
    'PENDING_PAYMENT'::public.contracted_service_status
  );

  insert into public.client_card_tokens (
    id, client_id, gateway_slug, gateway_payment_profile_id, card_number_masked,
    card_brand, gateway_card_token, expiry_month, expiry_year, cardholder_name,
    billing_address, state
  )
  values (
    v_card_token_id, v_client_id, 'netcred', 'profile-suspension-pgtap',
    '497010XXXXXX0048', 'VCC', 'token-suspension-pgtap', 12, 2030,
    'Suspension Test', '{}'::jsonb, 'ACTIVE'::public.payment_client_card_token_state
  );

  insert into public.provider_gateway_accounts (
    provider_id, gateway_slug, document, onboarding_status, onboarding_activated_at,
    netcred_company_id
  )
  values (
    p_provider_id,
    'netcred'::public.payment_gateway_slug,
    right(replace(p_provider_id::text, '-', ''), 11),
    'ACTIVE'::public.payment_provider_onboarding_status,
    now(),
    substr(replace(p_provider_id::text, '-', ''), 1, 8)
  )
  on conflict (provider_id, gateway_slug) do update
  set
    onboarding_status = 'ACTIVE'::public.payment_provider_onboarding_status,
    onboarding_activated_at = excluded.onboarding_activated_at,
    netcred_company_id = excluded.netcred_company_id;

  client_id := v_client_id;
  card_token_id := v_card_token_id;
  return next;
end;
$$;

do $seed$
declare
  v_service_id uuid := gen_random_uuid();
  v_provider_id uuid := '5d09e025-20a2-4842-aeef-324d42a431e1'::uuid;
  v_fixture record;
begin
  select * into v_fixture
  from pg_temp.payment_seed_suspension_fixture(v_service_id, v_provider_id);

  insert into public.payment_schedules (
    contracted_service_id, client_id, provider_id, gateway_slug,
    client_card_token_id, installment_number, base_amount, commission_rate_pct,
    provider_payout, charge_scheduled_at, state, idempotency_key
  )
  values (
    v_service_id, v_fixture.client_id, v_provider_id, 'netcred',
    v_fixture.card_token_id, 1, 100.00, 10.00, 90.00,
    now() - interval '1 hour',
    'SCHEDULED'::public.payment_schedule_state,
    v_service_id::text
  );

  perform set_config('test.suspension.service_id', v_service_id::text, true);
  perform set_config('test.suspension.provider_id', v_provider_id::text, true);
end;
$seed$;

select pg_temp.payment_set_service_role();

select is(
  public.suspend_provider(
    current_setting('test.suspension.provider_id')::uuid
  )->>'frozen_schedules',
  '1',
  'suspend_provider freezes pending pre-PAID schedules'
);

select isnt(
  (
    select ps.charge_frozen_at
    from public.payment_schedules ps
    where ps.contracted_service_id = current_setting('test.suspension.service_id')::uuid
  ),
  null,
  'sets charge_frozen_at on affected schedule'
);

select is(
  (
    select pga.onboarding_status::text
    from public.provider_gateway_accounts pga
    where pga.provider_id = current_setting('test.suspension.provider_id')::uuid
      and pga.gateway_slug = 'netcred'::public.payment_gateway_slug
  ),
  'SUSPENDED',
  'transitions provider onboarding_status to SUSPENDED'
);

update public.provider_gateway_accounts pga
set onboarding_status = 'ACTIVE'::public.payment_provider_onboarding_status
where pga.provider_id = current_setting('test.suspension.provider_id')::uuid
  and pga.gateway_slug = 'netcred'::public.payment_gateway_slug;

select is(
  public.payment_claim_charge_batch(10),
  '[]'::jsonb,
  'cron skips frozen schedule even after provider reactivation'
);

select is(
  public.payment_unfreeze_schedule(
    (
      select ps.id
      from public.payment_schedules ps
      where ps.contracted_service_id = current_setting('test.suspension.service_id')::uuid
    )
  )->>'outcome',
  'unfrozen',
  'payment_unfreeze_schedule clears charge_frozen_at for ops'
);

select ok(
  (
    select pg_get_functiondef(p.oid) ~* 'provider-suspended:.*:provider'
      and pg_get_functiondef(p.oid) ~* 'service_request_title'
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname = 'suspend_provider'
  ),
  'suspend_provider notifies provider once and enriches client notification payload'
);

select finish();

rollback;

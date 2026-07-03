-- Staging seed for payment_claim_charge_batch load test (Task 99).
-- Creates 30 eligible SCHEDULED rows for parallel cron simulation.
--
-- Usage (staging / local):
--   psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f supabase/scripts/payment-load-test-claim-batch.seed.sql
--
-- Tag rows via idempotency_key prefix for cleanup:
--   delete from public.payment_schedules where idempotency_key like 'load-test-claim-batch-%';

do $seed$
declare
  v_provider_id uuid := '5d09e025-20a2-4842-aeef-324d42a431e1'::uuid;
  v_client_id uuid;
  v_template_sr_id uuid := '7017e457-5a32-44e7-b8da-1727a14f4d33'::uuid;
  v_pricing record;
  v_slot jsonb;
  i int;
  v_contracted_service_id uuid;
  v_service_request_id uuid;
  v_proposal_id uuid;
  v_card_token_id uuid;
  v_schedule_id uuid;
begin
  select sr.client_id into v_client_id
  from public.service_requests sr
  where sr.id = v_template_sr_id;

  if v_client_id is null then
    raise exception 'Template service_request % not found — run db:reset first', v_template_sr_id;
  end if;

  insert into public.provider_gateway_accounts (
    provider_id, gateway_slug, document, onboarding_status, onboarding_activated_at
  )
  values (
    v_provider_id,
    'netcred'::public.payment_gateway_slug,
    '12345678901',
    'ACTIVE'::public.payment_provider_onboarding_status,
    now()
  )
  on conflict (provider_id, gateway_slug) do update
  set onboarding_status = 'ACTIVE'::public.payment_provider_onboarding_status;

  select * into v_pricing
  from public.calculate_provider_service_pricing(100.00::numeric);

  v_slot := jsonb_build_object(
    'start_date', to_char(current_date + 5, 'YYYY-MM-DD'),
    'end_date', to_char(current_date + 5, 'YYYY-MM-DD'),
    'shift', 'morning'
  );

  for i in 1..30 loop
    v_contracted_service_id := gen_random_uuid();
    v_service_request_id := gen_random_uuid();
    v_proposal_id := gen_random_uuid();
    v_card_token_id := gen_random_uuid();
    v_schedule_id := gen_random_uuid();

    insert into public.service_requests (
      id, client_id, service_id, address_id, title, description, form_data, form_version, status, urgency
    )
    select
      v_service_request_id, sr.client_id, sr.service_id, sr.address_id,
      format('payment claim load test %s', i),
      sr.description, sr.form_data, sr.form_version, 'OPEN', sr.urgency
    from public.service_requests sr
    where sr.id = v_template_sr_id;

    insert into public.provider_proposals (
      id, provider_id, service_request_id, proposed_amount, proposal_description,
      proposal_duration_value, proposal_duration_unit, proposal_suggested_slots,
      photos, tax_rate, tax_amount, final_amount, pricing_signature, status
    )
    values (
      v_proposal_id, v_provider_id, v_service_request_id, v_pricing.original_amount,
      'payment claim load test proposal', 1, 'days', jsonb_build_array(v_slot),
      '{}'::text[], v_pricing.tax_rate, v_pricing.tax_amount, v_pricing.final_amount,
      v_pricing.pricing_signature, 'ACCEPTED'::public.proposal_status
    );

    insert into public.contracted_services (
      id, service_request_id, accepted_proposal_id, client_id, provider_id,
      duration_unit, duration_value, scheduled_start_date, scheduled_end_date,
      scheduled_shift, agreed_slot, status
    )
    values (
      v_contracted_service_id, v_service_request_id, v_proposal_id, v_client_id,
      v_provider_id, 'days', 1, current_date + 5, current_date + 5, 'morning', v_slot,
      'PENDING_PAYMENT'::public.contracted_service_status
    );

    insert into public.client_card_tokens (
      id, client_id, gateway_slug, gateway_payment_profile_id, card_number_masked,
      card_brand, gateway_card_token, expiry_month, expiry_year, cardholder_name,
      billing_address, state
    )
    values (
      v_card_token_id, v_client_id, 'netcred', format('load-profile-%s', v_schedule_id),
      '497010XXXXXX0048', 'visa', format('load-token-%s', v_schedule_id), 12, 2030,
      'Claim Batch Load Test', '{}'::jsonb, 'ACTIVE'::public.payment_client_card_token_state
    );

    insert into public.payment_schedules (
      id, contracted_service_id, client_id, provider_id, gateway_slug,
      client_card_token_id, installment_number, base_amount, commission_rate_pct,
      provider_payout, charge_scheduled_at, state, idempotency_key
    )
    values (
      v_schedule_id, v_contracted_service_id, v_client_id, v_provider_id, 'netcred',
      v_card_token_id, 1, 100.00, 10.00, 90.00, now() - interval '1 minute',
      'SCHEDULED'::public.payment_schedule_state,
      format('load-test-claim-batch-%s', v_schedule_id)
    );
  end loop;

  raise notice 'Seeded 30 eligible payment_schedules for claim batch load test';
end;
$seed$;

select
  count(*)::int as eligible_schedules
from public.payment_schedules ps
where ps.idempotency_key like 'load-test-claim-batch-%'
  and ps.state = 'SCHEDULED'::public.payment_schedule_state;

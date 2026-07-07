-- pgTAP helpers for accept_proposal with required payment payload.

create or replace function pg_temp.cns_payment_vault_secrets()
returns void
language plpgsql
as $$
begin
  if not exists (
    select 1 from vault.secrets where name = 'installment_signing_secret'
  ) then
    perform vault.create_secret(
      'renovi-installment-signing-secret-v1',
      'installment_signing_secret',
      'pgTAP accept_proposal payment helpers'
    );
  end if;

  if not exists (
    select 1 from vault.secrets where name = 'pricing_signature_secret'
  ) then
    perform vault.create_secret(
      'renovi-provider-pricing-secret-v1',
      'pricing_signature_secret',
      'pgTAP accept_proposal payment helpers'
    );
  end if;
end;
$$;

create or replace function pg_temp.cns_payment_seed_provider_netcred(
  p_provider_id uuid
)
returns void
language plpgsql
as $$
begin
  insert into public.provider_gateway_accounts (
    provider_id,
    gateway_slug,
    document,
    onboarding_status,
    onboarding_activated_at,
    netcred_company_id
  )
  values (
    p_provider_id,
    'netcred'::public.payment_gateway_slug,
    '12345678901',
    'ACTIVE'::public.payment_provider_onboarding_status,
    now(),
    '1048'
  )
  on conflict (provider_id, gateway_slug) do update
  set
    onboarding_status = 'ACTIVE'::public.payment_provider_onboarding_status,
    onboarding_activated_at = excluded.onboarding_activated_at,
    netcred_company_id = excluded.netcred_company_id;
end;
$$;

create or replace function pg_temp.cns_payment_seed_client_card(
  p_client_id uuid,
  p_card_token_id uuid default gen_random_uuid()
)
returns uuid
language plpgsql
as $$
begin
  insert into public.client_card_tokens (
    id,
    client_id,
    gateway_slug,
    gateway_payment_profile_id,
    card_number_masked,
    card_brand,
    gateway_card_token,
    expiry_month,
    expiry_year,
    cardholder_name,
    billing_address,
    state
  )
  values (
    p_card_token_id,
    p_client_id,
    'netcred',
    format('pgtap-accept-profile-%s', p_card_token_id),
    '411111******1111',
    'VISA',
    'opaque-pgtap-token',
    12,
    2030,
    'pgTAP Accept Client',
    '{}'::jsonb,
    'ACTIVE'::public.payment_client_card_token_state
  )
  on conflict (id) do update
  set state = 'ACTIVE'::public.payment_client_card_token_state;

  return p_card_token_id;
end;
$$;

-- Backward-compatible test helper without payment fields (errors before payment still apply).
create or replace function pg_temp.cns_accept_proposal(
  p_proposal_id uuid,
  p_selected_slot jsonb,
  p_idempotency_key uuid
)
returns jsonb
language sql
as $$
  select public.accept_proposal(
    p_proposal_id,
    p_selected_slot,
    p_idempotency_key,
    null::uuid,
    null::smallint,
    null::text,
    null::jsonb,
    null::text,
    null::text,
    null::text
  );
$$;

create or replace function pg_temp.cns_accept_proposal_with_payment(
  p_proposal_id uuid,
  p_selected_slot jsonb,
  p_idempotency_key uuid,
  p_client_id uuid default '28e30f1d-3c47-441f-94c6-76b6ea0db470'::uuid,
  p_clearsale_session_id text default 'pgtap-clearsale-session',
  p_client_ip text default '127.0.0.1'
)
returns jsonb
language plpgsql
as $$
declare
  v_provider_id uuid;
  v_service_request_id uuid;
  v_pricing_signature text;
  v_card_token_id uuid;
  v_installment jsonb;
begin
  perform pg_temp.cns_payment_vault_secrets();

  select
    pp.provider_id,
    pp.service_request_id,
    pp.pricing_signature
  into
    v_provider_id,
    v_service_request_id,
    v_pricing_signature
  from public.provider_proposals pp
  where pp.id = p_proposal_id;

  if v_provider_id is null then
    raise exception 'proposal not found for cns_accept_proposal_with_payment: %', p_proposal_id
      using errcode = 'P0002';
  end if;

  perform pg_temp.cns_payment_seed_provider_netcred(v_provider_id);
  v_card_token_id := pg_temp.cns_payment_seed_client_card(p_client_id);

  select public.payment_calculate_installment_options(
    p_proposal_id,
    v_service_request_id,
    'VISA'
  )
  into v_installment;

  return public.accept_proposal(
    p_proposal_id,
    p_selected_slot,
    p_idempotency_key,
    v_card_token_id,
    1::smallint,
    v_installment->>'installment_selection_hmac',
    v_installment->'installment_hmac_payload',
    p_clearsale_session_id,
    v_pricing_signature,
    p_client_ip
  );
end;
$$;

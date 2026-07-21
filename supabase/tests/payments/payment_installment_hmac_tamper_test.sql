-- pgTAP: payment Task 117 — installment HMAC tamper and expiry rejection (Req 7.5, 8.1).

begin;

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

select plan(4);

create or replace function pg_temp.payment117_set_auth(p_user_id uuid)
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

do $vault$
begin
  if not exists (
    select 1 from vault.secrets where name = 'installment_signing_secret'
  ) then
    perform vault.create_secret(
      'renovi-installment-signing-secret-v1',
      'installment_signing_secret',
      'pgTAP installment HMAC test'
    );
  end if;

  if not exists (
    select 1 from vault.secrets where name = 'pricing_signature_secret'
  ) then
    perform vault.create_secret(
      'renovi-provider-pricing-secret-v1',
      'pricing_signature_secret',
      'pgTAP pricing signature test'
    );
  end if;
end;
$vault$;

create temp table _hmac_sr as
select gen_random_uuid() as service_request_id;

insert into public.service_requests (
  id, client_id, service_id, address_id, title, description, form_data, form_version, status, urgency
)
select
  sr_fixture.service_request_id,
  '28e30f1d-3c47-441f-94c6-76b6ea0db470'::uuid,
  sr.service_id,
  sr.address_id,
  'installment HMAC tamper pgTAP',
  sr.description,
  sr.form_data,
  sr.form_version,
  'OPEN',
  sr.urgency
from _hmac_sr sr_fixture
cross join public.service_requests sr
where sr.id = '7017e457-5a32-44e7-b8da-1727a14f4d33'::uuid;

select pg_temp.cns_seed_chat(
  p_service_request_id := (select service_request_id from _hmac_sr),
  p_client_id := '28e30f1d-3c47-441f-94c6-76b6ea0db470'::uuid,
  p_provider_id := '5d09e025-20a2-4842-aeef-324d42a431e1'::uuid
);

create temp table _hmac_slot as
select jsonb_build_object(
  'start_date', (current_date + 7)::text,
  'end_date', (current_date + 8)::text,
  'shift', 'morning'
) as selected_slot;

select pg_temp.payment117_set_auth('5d09e025-20a2-4842-aeef-324d42a431e1'::uuid);

create temp table _hmac_proposal as
with pricing as (
  select * from public.calculate_provider_service_pricing(800.00::numeric)
)
select
  (public.create_provider_proposal(
    (select service_request_id from _hmac_sr),
    gen_random_uuid(),
    pricing.original_amount,
    'installment HMAC pgTAP proposal',
    2,
    'days',
    jsonb_build_array((select selected_slot from _hmac_slot)),
    '{}'::text[],
    pricing.tax_rate,
    pricing.tax_amount,
    pricing.final_amount,
    pricing.pricing_signature
  )->'proposal'->>'id')::uuid as proposal_id,
  (select service_request_id from _hmac_sr) as service_request_id,
  pricing.pricing_signature
from pricing;

insert into public.provider_gateway_accounts (
  provider_id, gateway_slug, document, onboarding_status, onboarding_activated_at,
  netcred_company_id
)
values (
  '5d09e025-20a2-4842-aeef-324d42a431e1'::uuid,
  'netcred'::public.payment_gateway_slug,
  '12345678901',
  'ACTIVE'::public.payment_provider_onboarding_status,
  now(),
  '1048'
)
on conflict (provider_id, gateway_slug) do update
set
  onboarding_status = 'ACTIVE'::public.payment_provider_onboarding_status,
  netcred_company_id = excluded.netcred_company_id;

create temp table _hmac_card as
select gen_random_uuid() as card_token_id;

insert into public.client_card_tokens (
  id, client_id, gateway_slug, gateway_payment_profile_id, netcred_company_id, card_number_masked,
  card_brand, gateway_card_token, expiry_month, expiry_year, cardholder_name,
  billing_address, state
)
select
  card_token_id,
  '28e30f1d-3c47-441f-94c6-76b6ea0db470'::uuid,
  'netcred',
  'hmac-tamper-profile', '1014',
  '411111******1111',
  'VISA',
  'opaque-hmac-token',
  12,
  2030,
  'HMAC Test Client',
  '{}'::jsonb,
  'ACTIVE'::public.payment_client_card_token_state
from _hmac_card;

select pg_temp.payment117_set_auth('28e30f1d-3c47-441f-94c6-76b6ea0db470'::uuid);

create temp table _hmac_installment as
select public.payment_calculate_installment_options(
  (select proposal_id from _hmac_proposal),
  (select service_request_id from _hmac_proposal),
  'VISA'
) as result;

create temp table _hmac_expired_payload as
select
  (result->'installment_hmac_payload')::jsonb
    || jsonb_build_object('expires_at', to_jsonb(now() - interval '1 hour')) as payload,
  result->>'installment_selection_hmac' as hmac
from _hmac_installment;

select throws_ok(
  format(
    $$ select public.payment_verify_installment_selection_hmac(
      %L,
      %L::jsonb
    ) $$,
    'deadbeef00',
    (select result->'installment_hmac_payload' from _hmac_installment)::text
  ),
  'P0001',
  'INVALID_INSTALLMENT_SIGNATURE',
  'payment_verify_installment_selection_hmac rejects tampered signature'
);

select throws_ok(
  format(
    $$ select public.payment_verify_installment_selection_hmac(
      %L,
      %L::jsonb
    ) $$,
    (select hmac from _hmac_expired_payload),
    (select payload from _hmac_expired_payload)::text
  ),
  'P0001',
  'INSTALLMENT_SIGNATURE_EXPIRED',
  'payment_verify_installment_selection_hmac rejects expired payload'
);

-- Server-minted ClearSale sessions so accept_proposal reaches installment HMAC checks (CHK-011).
create temp table _hmac_clearsale as
select
  (public.payment_issue_clearsale_session(
    'accept',
    (select proposal_id from _hmac_proposal),
    null
  )->>'session_id') as session_tamper,
  (public.payment_issue_clearsale_session(
    'accept',
    (select proposal_id from _hmac_proposal),
    null
  )->>'session_id') as session_expired;

select throws_ok(
  format(
    $$ select public.accept_proposal(
      %L::uuid,
      %L::jsonb,
      %L::uuid,
      %L::uuid,
      1::smallint,
      %L,
      %L::jsonb,
      %L,
      %L,
      '127.0.0.1'
    ) $$,
    (select proposal_id from _hmac_proposal),
    (select selected_slot from _hmac_slot),
    gen_random_uuid(),
    (select card_token_id from _hmac_card),
    'deadbeef00',
    (select result->'installment_hmac_payload' from _hmac_installment),
    (select session_tamper from _hmac_clearsale),
    (select pricing_signature from _hmac_proposal)
  ),
  'P0001',
  'INVALID_INSTALLMENT_SIGNATURE',
  'accept_proposal rejects tampered installment HMAC'
);

select throws_ok(
  format(
    $$ select public.accept_proposal(
      %L::uuid,
      %L::jsonb,
      %L::uuid,
      %L::uuid,
      1::smallint,
      %L,
      %L::jsonb,
      %L,
      %L,
      '127.0.0.1'
    ) $$,
    (select proposal_id from _hmac_proposal),
    (select selected_slot from _hmac_slot),
    gen_random_uuid(),
    (select card_token_id from _hmac_card),
    (select hmac from _hmac_expired_payload),
    (select payload from _hmac_expired_payload),
    (select session_expired from _hmac_clearsale),
    (select pricing_signature from _hmac_proposal)
  ),
  'P0001',
  'INSTALLMENT_SIGNATURE_EXPIRED',
  'accept_proposal rejects expired installment HMAC payload'
);

select finish();
rollback;

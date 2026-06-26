-- pgTAP: payment Task 17 — payment_calculate_charge_amount RPC.

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

select throws_ok(
  $$ select public.payment_calculate_charge_amount(gen_random_uuid(), 1000::numeric, 1::smallint) $$,
  '42501',
  'service_role required for payment_calculate_charge_amount',
  'rejects non-service_role callers'
);

select pg_temp.payment_set_service_role();

select throws_ok(
  $$ select public.payment_calculate_charge_amount(gen_random_uuid(), 1000::numeric, 1::smallint) $$,
  'P0002',
  'CLIENT_CARD_TOKEN_NOT_FOUND',
  'rejects missing client card token'
);

create temp table _payment_fee_test_token as
with ins as (
  insert into public.client_card_tokens (
    client_id,
    gateway_payment_profile_id,
    card_number_masked,
    card_brand,
    gateway_card_token,
    expiry_month,
    expiry_year,
    cardholder_name,
    billing_address
  )
  values (
    '28e30f1d-3c47-441f-94c6-76b6ea0db470'::uuid,
    'pgtap-fee-profile-1',
    '497010XXXXXX0048',
    'MASTER',
    'opaque-token',
    12,
    2030,
    'Test Client',
    '{"street":"Rua A","number":"1","district":"Centro","city":"SP","state":"SP","zipCode":"01001000"}'::jsonb
  )
  returning id
)
select id from ins;

select is(
  public.payment_calculate_charge_amount(
    (select id from _payment_fee_test_token),
    1000::numeric,
    1::smallint
  ),
  1024.29::numeric,
  'visa/master 1x fee formula matches platform_constants seeds'
);

select is(
  public.payment_calculate_charge_amount(
    (select id from _payment_fee_test_token),
    1000::numeric,
    4::smallint
  ),
  1026.29::numeric,
  'visa/master 2-6x fee tier applies for installment 4'
);

select is(
  public.payment_cc_fee_rate_key('MASTER', 1::smallint),
  'cc_visa_master_1x_rate',
  'payment_cc_fee_rate_key maps master 1x tier'
);

select is(
  public.payment_total_with_card_fees(1000::numeric, 'MASTER', 1::smallint),
  1024.29::numeric,
  'payment_total_with_card_fees matches charge_amount formula'
);

select finish();

rollback;

-- pgTAP: FIX-007 — RPC rate limits (CHK-035) + ACTIVE card token cap (CHK-042f).

begin;

select plan(6);

create or replace function pg_temp.payment_set_auth(p_user_id uuid, p_role text default 'authenticated')
returns void
language plpgsql
as $$
begin
  perform set_config('request.jwt.claim.sub', p_user_id::text, true);
  perform set_config(
    'request.jwt.claims',
    json_build_object('role', p_role, 'sub', p_user_id::text)::text,
    true
  );
  perform set_config('request.jwt.claim.role', p_role, true);
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

-- payment_update_method rate limit
select pg_temp.payment_set_auth('28e30f1d-3c47-441f-94c6-76b6ea0db470'::uuid);

do $$
declare
  v_user uuid := '28e30f1d-3c47-441f-94c6-76b6ea0db470'::uuid;
  v_i int;
begin
  for v_i in 1..10 loop
    perform public.platform_check_rate_limit(
      format('payment_update_method:%s', v_user),
      10
    );
  end loop;
end;
$$;

select throws_ok(
  $$ select public.payment_update_method(
    gen_random_uuid(),
    gen_random_uuid()
  ) $$,
  'P0001',
  'RATE_LIMITED',
  'payment_update_method enforces RATE_LIMITED at 10/min'
);

-- payment_submit_provider_kyc rate limit
select pg_temp.payment_set_auth('5d09e025-20a2-4842-aeef-324d42a431e1'::uuid);

do $$
declare
  v_user uuid := '5d09e025-20a2-4842-aeef-324d42a431e1'::uuid;
  v_i int;
begin
  for v_i in 1..3 loop
    perform public.platform_check_rate_limit(
      format('payment_submit_provider_kyc:%s', v_user),
      3
    );
  end loop;
end;
$$;

select throws_ok(
  $$ select public.payment_submit_provider_kyc(
    '001', '0001', '12345-6',
    'providers/5d09e025-20a2-4842-aeef-324d42a431e1/kyc/identity/doc.pdf',
    'providers/5d09e025-20a2-4842-aeef-324d42a431e1/kyc/address-proof/doc.pdf',
    'pf',
    '12345678901'
  ) $$,
  'P0001',
  'RATE_LIMITED',
  'payment_submit_provider_kyc enforces RATE_LIMITED at 3/min'
);

-- accept_proposal rate limit
select pg_temp.payment_set_auth('28e30f1d-3c47-441f-94c6-76b6ea0db470'::uuid);

do $$
declare
  v_user uuid := '28e30f1d-3c47-441f-94c6-76b6ea0db470'::uuid;
  v_i int;
begin
  for v_i in 1..5 loop
    perform public.platform_check_rate_limit(
      format('accept_proposal:%s', v_user),
      5
    );
  end loop;
end;
$$;

select throws_ok(
  $$ select public.accept_proposal(
    gen_random_uuid(),
    '{"date":"2099-01-01","start_time":"09:00","end_time":"11:00"}'::jsonb,
    gen_random_uuid(),
    gen_random_uuid(),
    1::smallint,
    'hmac',
    '{}'::jsonb,
    'clearsale',
    'pricing-sig',
    '127.0.0.1'
  ) $$,
  'P0001',
  'RATE_LIMITED',
  'accept_proposal enforces RATE_LIMITED at 5/min'
);

-- ACTIVE token cap
select pg_temp.payment_set_service_role();

do $$
declare
  v_client uuid := '28e30f1d-3c47-441f-94c6-76b6ea0db470'::uuid;
  v_i int;
  v_max int := public.platform_constant_int('max_active_client_card_tokens', 8);
begin
  for v_i in 1..v_max loop
    perform public.payment_persist_client_card_token(
      v_client,
      format('pgtap-cap-profile-%s', v_i),
      '497010XXXXXX0048',
      'MASTER',
      format('opaque-token-%s', v_i),
      12::smallint,
      2030::smallint,
      'Test Client',
      '{"street":"Rua A","number":"1","district":"Centro","city":"SP","state":"SP","zipCode":"01001000"}'::jsonb,
      '1014'
    );
  end loop;
end;
$$;

select throws_ok(
  $$ select public.payment_persist_client_card_token(
    '28e30f1d-3c47-441f-94c6-76b6ea0db470'::uuid,
    'pgtap-cap-profile-overflow',
    '497010XXXXXX0048',
    'MASTER',
    'opaque-token-overflow',
    12::smallint,
    2030::smallint,
    'Test Client',
    '{"street":"Rua A","number":"1","district":"Centro","city":"SP","state":"SP","zipCode":"01001000"}'::jsonb,
    '1014'
  ) $$,
  'P0001',
  'MAX_ACTIVE_CARD_TOKENS',
  'payment_persist_client_card_token rejects beyond max ACTIVE tokens'
);

-- In-place refresh of an existing ACTIVE profile still allowed
select lives_ok(
  $$ select public.payment_persist_client_card_token(
    '28e30f1d-3c47-441f-94c6-76b6ea0db470'::uuid,
    'pgtap-cap-profile-1',
    '497010XXXXXX0048',
    'VISA',
    'opaque-token-1-refreshed',
    12::smallint,
    2030::smallint,
    'Test Client',
    '{"street":"Rua A","number":"1","district":"Centro","city":"SP","state":"SP","zipCode":"01001000"}'::jsonb,
    '1014'
  ) $$,
  'refreshing an existing ACTIVE token does not hit MAX_ACTIVE_CARD_TOKENS'
);

select is(
  (
    select count(*)::int
    from public.client_card_tokens
    where client_id = '28e30f1d-3c47-441f-94c6-76b6ea0db470'::uuid
      and gateway_payment_profile_id like 'pgtap-cap-profile-%'
      and state = 'ACTIVE'
  ),
  public.platform_constant_int('max_active_client_card_tokens', 8),
  'ACTIVE token count stays at the configured max after refresh'
);

select finish();

rollback;

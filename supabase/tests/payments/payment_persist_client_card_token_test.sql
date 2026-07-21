-- pgTAP: payment Task 20 — payment_persist_client_card_token RPC.

begin;

select plan(4);

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
  $$ select public.payment_persist_client_card_token(
    '28e30f1d-3c47-441f-94c6-76b6ea0db470'::uuid,
    'pgtap-profile-1',
    '497010XXXXXX0048',
    'MASTER',
    'opaque-token',
    12::smallint,
    2030::smallint,
    'Test Client',
    '{"street":"Rua A","number":"1","district":"Centro","city":"SP","state":"SP","zipCode":"01001000"}'::jsonb,
    '1014'
  ) $$,
  '42501',
  'service_role required for payment_persist_client_card_token',
  'rejects non-service_role callers'
);

select pg_temp.payment_set_service_role();

select is(
  public.payment_persist_client_card_token(
    '28e30f1d-3c47-441f-94c6-76b6ea0db470'::uuid,
    'pgtap-persist-profile-1',
    '497010XXXXXX0048',
    'MASTER',
    'opaque-token-persist',
    12::smallint,
    2030::smallint,
    'Test Client',
    '{"street":"Rua A","number":"1","district":"Centro","city":"SP","state":"SP","zipCode":"01001000"}'::jsonb,
    '1014'
  )->>'state',
  'ACTIVE',
  'persists ACTIVE client card token for service_role'
);

select ok(
  exists (
    select 1
    from public.client_card_tokens cct
    where cct.client_id = '28e30f1d-3c47-441f-94c6-76b6ea0db470'::uuid
      and cct.gateway_payment_profile_id = 'pgtap-persist-profile-1'
      and cct.netcred_company_id = '1014'
      and cct.state = 'ACTIVE'
  ),
  'token row exists after persist RPC with netcred_company_id'
);

select throws_ok(
  $$ select public.payment_persist_client_card_token(
    '28e30f1d-3c47-441f-94c6-76b6ea0db470'::uuid,
    'pgtap-profile-missing-company',
    '497010XXXXXX0048',
    'MASTER',
    'opaque-token',
    12::smallint,
    2030::smallint,
    'Test Client',
    '{"street":"Rua A","number":"1","district":"Centro","city":"SP","state":"SP","zipCode":"01001000"}'::jsonb,
    '   '
  ) $$,
  '22023',
  'p_netcred_company_id is required',
  'rejects blank netcred_company_id'
);

select finish();

rollback;

-- pgTAP: platform company binding for card tokens + safe_v / grant hygiene.

begin;

select plan(7);

\ir fixtures/accept_proposal_payment_helpers.inc

select pg_temp.cns_payment_vault_secrets();

select ok(
  exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'client_card_tokens'
      and column_name = 'netcred_company_id'
      and is_nullable = 'NO'
  ),
  'client_card_tokens.netcred_company_id is NOT NULL'
);

select ok(
  not exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'client_card_tokens_safe_v'
      and column_name = 'gateway_payment_profile_id'
  ),
  'client_card_tokens_safe_v does not expose gateway_payment_profile_id'
);

select ok(
  not has_column_privilege(
    'authenticated',
    'public.client_card_tokens',
    'gateway_payment_profile_id',
    'SELECT'
  ),
  'authenticated cannot SELECT gateway_payment_profile_id on base table'
);

select ok(
  not has_column_privilege(
    'authenticated',
    'public.client_card_tokens',
    'netcred_company_id',
    'SELECT'
  ),
  'authenticated cannot SELECT netcred_company_id on base table'
);

select is(
  public.payment_netcred_platform_company_id(),
  '1014',
  'Vault platform company id is configured for pgTAP'
);

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

select pg_temp.payment_set_service_role();

select lives_ok(
  $$ select public.payment_persist_client_card_token(
    '28e30f1d-3c47-441f-94c6-76b6ea0db470'::uuid,
    'pgtap-platform-profile',
    '497010XXXXXX0048',
    'VISA',
    'opaque-platform-token',
    12::smallint,
    2030::smallint,
    'Platform Client',
    '{"street":"Rua A","number":"1","district":"Centro","city":"SP","state":"SP","zipCode":"01001000"}'::jsonb,
    '1014'
  ) $$,
  'persist token under platform NetCred company'
);

select is(
  (
    select cct.netcred_company_id
    from public.client_card_tokens cct
    where cct.gateway_payment_profile_id = 'pgtap-platform-profile'
  ),
  public.payment_netcred_platform_company_id(),
  'persisted company id equals platform company (not provider merchant)'
);

select finish();

rollback;

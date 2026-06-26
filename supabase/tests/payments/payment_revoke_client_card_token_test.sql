-- pgTAP: payment Task 22 — payment_revoke_client_card_token RPC.

begin;

select plan(3);

create or replace function pg_temp.payment_set_client_auth(p_user_id uuid)
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

create temp table _revoke_token as
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
    'pgtap-revoke-profile',
    '497010XXXXXX0048',
    'MASTER',
    'opaque-revoke',
    12,
    2030,
    'Test Client',
    '{"street":"Rua A","number":"1","district":"Centro","city":"SP","state":"SP","zipCode":"01001000"}'::jsonb
  )
  returning id
)
select id from ins;

select pg_temp.payment_set_client_auth('28e30f1d-3c47-441f-94c6-76b6ea0db470'::uuid);

select is(
  public.payment_revoke_client_card_token((select id from _revoke_token))->>'state',
  'REVOKED',
  'revokes unlinked ACTIVE token'
);

select ok(
  exists (
    select 1
    from public.client_card_tokens cct
    where cct.id = (select id from _revoke_token)
      and cct.state = 'REVOKED'
  ),
  'token state is REVOKED in database'
);

select throws_ok(
  format(
    $$ select public.payment_revoke_client_card_token(%L::uuid) $$,
    (select id from _revoke_token)
  ),
  'P0002',
  'CLIENT_CARD_TOKEN_NOT_FOUND',
  'rejects revoke on already-revoked token'
);

select finish();

rollback;

-- pgTAP: payment Task 28 — payment_claim_charge_batch RPC.

begin;

select plan(2);

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
  $$ select public.payment_claim_charge_batch() $$,
  '42501',
  'service_role required for payment_claim_charge_batch',
  'rejects non-service_role callers'
);

select pg_temp.payment_set_service_role();

select is(
  public.payment_claim_charge_batch(10),
  '[]'::jsonb,
  'returns empty array when no eligible schedules exist'
);

select finish();

rollback;

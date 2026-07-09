-- pgTAP: payment Task 38 — payment_begin_refund_request and refund amount helper.

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
  $$ select public.payment_begin_refund_request(gen_random_uuid(), gen_random_uuid()) $$,
  '42501',
  'service_role required for payment_begin_refund_request',
  'rejects non-service_role callers'
);

select pg_temp.payment_set_service_role();

select throws_ok(
  $$ select public.payment_begin_refund_request(gen_random_uuid(), gen_random_uuid()) $$,
  'P0002',
  'SERVICE_NOT_FOUND',
  'rejects missing contracted service'
);

select is(
  public.payment_calculate_refund_amount(
    110.00,
    100.00,
    now() + interval '72 hours',
    'client'
  )->>'penalty_tier',
  'FULL_REFUND',
  'client refund >48h before service is FULL_REFUND tier'
);

select is(
  public.payment_calculate_refund_amount(
    110.00,
    100.00,
    now() + interval '72 hours',
    'client'
  )->>'refund_amount',
  '110.00',
  'client refund >48h returns full charge_amount including card fees'
);

select is(
  public.payment_calculate_refund_amount(
    110.00,
    100.00,
    now() + interval '1 hour',
    'provider'
  )->>'refund_amount',
  '110.00',
  'provider-initiated refund returns full charge_amount'
);

select ok(
  (
    select p.prosecdef
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname = 'payment_begin_refund_request'
  ),
  'payment_begin_refund_request is SECURITY DEFINER'
);

select finish();

rollback;

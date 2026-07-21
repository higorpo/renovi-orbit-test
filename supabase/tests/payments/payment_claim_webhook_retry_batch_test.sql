-- pgTAP: payment Task 37 — payment_claim_webhook_retry_batch RPC.

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
  $$ select public.payment_claim_webhook_retry_batch() $$,
  '42501',
  'service_role required for payment_claim_webhook_retry_batch',
  'rejects non-service_role callers'
);

select pg_temp.payment_set_service_role();

select is(
  public.payment_claim_webhook_retry_batch(),
  '[]'::jsonb,
  'returns empty batch when no failed events are eligible'
);

select public.payment_ingest_webhook_event(
  'netcred'::public.payment_gateway_slug,
  'TRANSACTION_CAPTURE',
  'evt-retry-claim-1',
  '{"id":"evt-retry-claim-1"}'::jsonb,
  '{"X-NETCRED-Event":"TRANSACTION_CAPTURE"}'::jsonb,
  true);

update public.payment_webhook_events
set
  state = 'FAILED'::public.payment_webhook_event_state,
  retry_count = 1,
  next_retry_at = now() - interval '1 minute',
  failure_reason = 'test failure'
where gateway_event_id = 'evt-retry-claim-1';

select is(
  jsonb_array_length(public.payment_claim_webhook_retry_batch()),
  1,
  'claims one eligible failed event'
);

select is(
  (
    select state::text
    from public.payment_webhook_events
    where gateway_event_id = 'evt-retry-claim-1'
  ),
  'PROCESSING',
  'claimed failed event moves to PROCESSING'
);

-- INVALID_SIGNATURE must never be claimed for retry (CHK-001).
select public.payment_ingest_webhook_event(
  'netcred'::public.payment_gateway_slug,
  'TRANSACTION_CAPTURE',
  'evt-retry-invalid-sig',
  '{"id":"evt-retry-invalid-sig"}'::jsonb,
  '{"X-NETCRED-Event":"TRANSACTION_CAPTURE"}'::jsonb,
  false
);

update public.payment_webhook_events
set
  state = 'FAILED'::public.payment_webhook_event_state,
  retry_count = 0,
  next_retry_at = now() - interval '1 minute',
  failure_reason = 'INVALID_SIGNATURE',
  signature_validated = false
where gateway_event_id = 'evt-retry-invalid-sig';

select is(
  public.payment_claim_webhook_retry_batch(),
  '[]'::jsonb,
  'claim retry batch empty for INVALID_SIGNATURE / unsigned events'
);

select ok(
  (
    select p.prosecdef
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname = 'payment_claim_webhook_retry_batch'
  ),
  'payment_claim_webhook_retry_batch is SECURITY DEFINER'
);

select finish();

rollback;

-- pgTAP: payment Task 36 — payment_claim_webhook_processing_batch RPC.

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
  $$ select public.payment_claim_webhook_processing_batch() $$,
  '42501',
  'service_role required for payment_claim_webhook_processing_batch',
  'rejects non-service_role callers'
);

select pg_temp.payment_set_service_role();

select is(
  public.payment_claim_webhook_processing_batch(),
  '[]'::jsonb,
  'returns empty batch when queue is empty'
);

select public.payment_ingest_webhook_event(
  'netcred'::public.payment_gateway_slug,
  'TRANSACTION_UPDATE',
  'evt-claim-queue-1',
  '{"id":"evt-claim-queue-1"}'::jsonb,
  '{"X-NETCRED-Event":"TRANSACTION_UPDATE"}'::jsonb,
  true);

select public.payment_enqueue_webhook_processing(
  (
    select id
    from public.payment_webhook_events
    where gateway_event_id = 'evt-claim-queue-1'
  )
);

select is(
  jsonb_array_length(public.payment_claim_webhook_processing_batch()),
  1,
  'claims one pending queue row'
);

select is(
  (
    select state::text
    from public.payment_webhook_processing_queue
    where webhook_event_id = (
      select id
      from public.payment_webhook_events
      where gateway_event_id = 'evt-claim-queue-1'
    )
  ),
  'PROCESSING',
  'claimed queue row moves to PROCESSING'
);

select is(
  (
    select state::text
    from public.payment_webhook_events
    where gateway_event_id = 'evt-claim-queue-1'
  ),
  'PROCESSING',
  'parent webhook event moves to PROCESSING'
);

select ok(
  (
    select p.prosecdef
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname = 'payment_claim_webhook_processing_batch'
  ),
  'payment_claim_webhook_processing_batch is SECURITY DEFINER'
);

select finish();

rollback;

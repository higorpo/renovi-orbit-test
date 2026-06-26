-- pgTAP: payment Task 33 — payment_ingest_webhook_event RPC.

begin;

select plan(9);

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
  $$ select public.payment_ingest_webhook_event(
    'netcred'::public.payment_gateway_slug,
    'TRANSACTION_CAPTURE',
    'evt-auth-1',
    '{"id":"evt-auth-1"}'::jsonb,
    '{"X-NETCRED-Event":"TRANSACTION_CAPTURE"}'::jsonb
  ) $$,
  '42501',
  'service_role required for payment_ingest_webhook_event',
  'rejects non-service_role callers'
);

select pg_temp.payment_set_service_role();

select is(
  public.payment_ingest_webhook_event(
    'netcred'::public.payment_gateway_slug,
    'TRANSACTION_CAPTURE',
    'evt-ingest-1',
    '{"id":"evt-ingest-1","transaction":{"referenceCode":"svc-1"}}'::jsonb,
    '{"X-NETCRED-Event":"TRANSACTION_CAPTURE","X-NETCRED-Signature":"abc"}'::jsonb
  )->>'status',
  'inserted',
  'first ingest returns inserted status'
);

select is(
  (
    select state::text
    from public.payment_webhook_events
    where gateway_event_id = 'evt-ingest-1'
  ),
  'RECEIVED',
  'persisted event starts in RECEIVED state'
);

select is(
  public.payment_ingest_webhook_event(
    'netcred'::public.payment_gateway_slug,
    'TRANSACTION_CAPTURE',
    'evt-ingest-1',
    '{"id":"evt-ingest-1","changed":true}'::jsonb,
    '{"X-NETCRED-Event":"TRANSACTION_CAPTURE"}'::jsonb
  )->>'status',
  'duplicate',
  'duplicate dedup key returns duplicate status'
);

select is(
  (
    select count(*)::int
    from public.payment_webhook_events
    where gateway_event_id = 'evt-ingest-1'
  ),
  1,
  'duplicate ingest does not insert a second row'
);

select is(
  (
    select state::text
    from public.payment_webhook_events
    where gateway_event_id = 'evt-ingest-1'
  ),
  'DUPLICATE',
  'duplicate ingest marks existing row as DUPLICATE'
);

select ok(
  (
    select is_duplicate
    from public.payment_webhook_events
    where gateway_event_id = 'evt-ingest-1'
  ),
  'duplicate ingest sets is_duplicate=true on existing row'
);

select throws_ok(
  $$
    update public.payment_webhook_events
    set raw_payload = '{"tampered":true}'::jsonb
    where gateway_event_id = 'evt-ingest-1'
  $$,
  'P0001',
  'WEBHOOK_RAW_PAYLOAD_IMMUTABLE',
  'raw_payload is immutable after insert'
);

select ok(
  (
    select p.prosecdef
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname = 'payment_ingest_webhook_event'
  ),
  'payment_ingest_webhook_event is SECURITY DEFINER'
);

select finish();

rollback;

-- pgTAP: payment Task 118 — webhook UNIQUE dedup and is_duplicate flag (Req 17.1–17.2).

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

select ok(
  exists (
    select 1
    from pg_indexes
    where schemaname = 'public'
      and tablename = 'payment_webhook_events'
      and indexname = 'payment_webhook_events_dedup_validated_unique'
  ),
  'payment_webhook_events_dedup_validated_unique partial unique index exists'
);

select pg_temp.payment_set_service_role();

select is(
  public.payment_ingest_webhook_event(
    'netcred'::public.payment_gateway_slug,
    'TRANSACTION_CAPTURE',
    'evt-dedup-118-1',
    '{"id":"evt-dedup-118-1"}'::jsonb,
    '{"X-NETCRED-Event":"TRANSACTION_CAPTURE"}'::jsonb,
  true)->>'status',
  'inserted',
  'first ingest with gateway_event_id returns inserted'
);

select is(
  public.payment_ingest_webhook_event(
    'netcred'::public.payment_gateway_slug,
    'TRANSACTION_CAPTURE',
    'evt-dedup-118-1',
    '{"id":"evt-dedup-118-1","replay":true}'::jsonb,
    '{"X-NETCRED-Event":"TRANSACTION_CAPTURE"}'::jsonb,
  true)->>'status',
  'duplicate',
  'second ingest with same gateway_event_id returns duplicate status'
);

select is(
  (
    select (public.payment_ingest_webhook_event(
      'netcred'::public.payment_gateway_slug,
      'TRANSACTION_CAPTURE',
      'evt-dedup-118-1',
      '{"id":"evt-dedup-118-1","replay":2}'::jsonb,
      '{"X-NETCRED-Event":"TRANSACTION_CAPTURE"}'::jsonb,
  true)->>'is_duplicate')::boolean
  ),
  true,
  'duplicate ingest response includes is_duplicate=true'
);

select is(
  (
    select count(*)::int
    from public.payment_webhook_events
    where gateway_slug = 'netcred'::public.payment_gateway_slug
      and event_type = 'TRANSACTION_CAPTURE'
      and gateway_event_id = 'evt-dedup-118-1'
  ),
  1,
  'UNIQUE dedup keeps a single persisted row for gateway_event_id'
);

select ok(
  (
    select is_duplicate
    from public.payment_webhook_events
    where gateway_event_id = 'evt-dedup-118-1'
  ),
  'persisted webhook row has is_duplicate=true after replay'
);

select finish();
rollback;

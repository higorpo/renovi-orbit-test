-- pgTAP: payment Task 34 — payment_enqueue_webhook_processing RPC.

begin;

select plan(8);

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
  $$ select public.payment_enqueue_webhook_processing(gen_random_uuid()) $$,
  '42501',
  'service_role required for payment_enqueue_webhook_processing',
  'rejects non-service_role callers'
);

select pg_temp.payment_set_service_role();

select throws_ok(
  $$ select public.payment_enqueue_webhook_processing(gen_random_uuid()) $$,
  'P0002',
  'WEBHOOK_EVENT_NOT_FOUND',
  'rejects missing webhook event'
);

select public.payment_ingest_webhook_event(
  'netcred'::public.payment_gateway_slug,
  'TRANSACTION_UPDATE',
  'evt-queue-1',
  '{"id":"evt-queue-1"}'::jsonb,
  '{"X-NETCRED-Event":"TRANSACTION_UPDATE"}'::jsonb,
  true);

select ok(
  exists (
    select 1
    from public.payment_webhook_events
    where gateway_event_id = 'evt-queue-1'
  ),
  'fixture webhook event exists for enqueue tests'
);

select is(
  public.payment_enqueue_webhook_processing(
    (
      select id
      from public.payment_webhook_events
      where gateway_event_id = 'evt-queue-1'
    )
  )->>'status',
  'enqueued',
  'first enqueue returns enqueued status'
);

select is(
  (
    select state::text
    from public.payment_webhook_events
    where gateway_event_id = 'evt-queue-1'
  ),
  'VALIDATING',
  'parent webhook event moves to VALIDATING'
);

select is(
  (
    select state::text
    from public.payment_webhook_processing_queue
    where webhook_event_id = (
      select id
      from public.payment_webhook_events
      where gateway_event_id = 'evt-queue-1'
    )
  ),
  'PENDING',
  'queue row is created in PENDING state'
);

select is(
  public.payment_enqueue_webhook_processing(
    (
      select id
      from public.payment_webhook_events
      where gateway_event_id = 'evt-queue-1'
    )
  )->>'status',
  'already_queued',
  'second enqueue is idempotent via UNIQUE webhook_event_id'
);

select ok(
  (
    select p.prosecdef
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname = 'payment_enqueue_webhook_processing'
  ),
  'payment_enqueue_webhook_processing is SECURITY DEFINER'
);

select finish();

rollback;

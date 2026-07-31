-- pgTAP: payment Task 35 — payment_process_webhook_event RPC.

begin;

select plan(10);

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
  $$ select public.payment_process_webhook_event(gen_random_uuid()) $$,
  '42501',
  'service_role required for payment_process_webhook_event',
  'rejects non-service_role callers'
);

select pg_temp.payment_set_service_role();

select throws_ok(
  $$ select public.payment_process_webhook_event(gen_random_uuid()) $$,
  'P0002',
  'WEBHOOK_EVENT_NOT_FOUND',
  'rejects missing webhook event'
);

select public.payment_ingest_webhook_event(
  'netcred'::public.payment_gateway_slug,
  'WEBHOOK_PING',
  'evt-process-ping',
  '{"ping":true}'::jsonb,
  '{"X-NETCRED-Event":"WEBHOOK_PING"}'::jsonb,
  true);

select ok(
  exists (
    select 1
    from public.payment_webhook_events
    where gateway_event_id = 'evt-process-ping'
  ),
  'fixture webhook event exists for process tests'
);

select is(
  public.payment_process_webhook_event(
    (
      select id
      from public.payment_webhook_events
      where gateway_event_id = 'evt-process-ping'
    )
  )->'handler'->>'outcome',
  'noop',
  'WEBHOOK_PING handler is a no-op'
);

select is(
  (
    select state::text
    from public.payment_webhook_events
    where gateway_event_id = 'evt-process-ping'
  ),
  'PROCESSED',
  'processed webhook event ends in PROCESSED state'
);

select is(
  public.payment_process_webhook_event(
    (
      select id
      from public.payment_webhook_events
      where gateway_event_id = 'evt-process-ping'
    )
  )->>'outcome',
  'already_processed',
  're-processing PROCESSED event is idempotent'
);

select ok(
  (
    select p.prosecdef
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname = 'payment_process_webhook_event'
  ),
  'payment_process_webhook_event is SECURITY DEFINER'
);

select ok(
  (
    select pg_get_functiondef(p.oid) ~* 'PAYOUT_CREATE'
      and pg_get_functiondef(p.oid) ~* 'PAYOUT_SETTLE'
      and pg_get_functiondef(p.oid) ~* 'payment_webhook_handle_payout'
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname = 'payment_process_webhook_event'
  ),
  'routes PAYOUT_CREATE/PAYOUT_SETTLE to payment_webhook_handle_payout'
);

select public.payment_ingest_webhook_event(
  'netcred'::public.payment_gateway_slug,
  'PAYOUT_CREATE',
  'evt-process-payout-empty',
  jsonb_build_object('id', 'payout-empty-1', 'movements', '[]'::jsonb),
  '{"X-NETCRED-Event":"PAYOUT_CREATE"}'::jsonb,
  true
);

select is(
  public.payment_process_webhook_event(
    (
      select id
      from public.payment_webhook_events
      where gateway_event_id = 'evt-process-payout-empty'
    )
  )->'handler'->>'outcome',
  'noop',
  'PAYOUT_CREATE with empty movements is terminal noop'
);

select is(
  (
    select state::text
    from public.payment_webhook_events
    where gateway_event_id = 'evt-process-payout-empty'
  ),
  'PROCESSED',
  'PAYOUT_CREATE empty movements ends PROCESSED (no retry storm)'
);

select finish();

rollback;

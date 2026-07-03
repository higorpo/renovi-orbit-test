-- pgTAP: payment Task 85 — Req 30 domain event catalog emissions.

begin;

select plan(6);

select ok(
  (
    select conbin::text ~ 'payment_webhook_event'
    from pg_constraint
    where conname = 'payment_events_aggregate_type_check'
  ),
  'payment_events allows payment_webhook_event aggregate type'
);

select ok(
  (
    select pg_get_functiondef(p.oid) ~* '''ChargeAttemptStarted'''
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname = 'payment_claim_charge_batch'
  ),
  'payment_claim_charge_batch emits ChargeAttemptStarted'
);

select ok(
  (
    select pg_get_functiondef(p.oid) ~* '''ManualPaymentInitiated'''
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname = 'payment_begin_manual_attempt'
  ),
  'payment_begin_manual_attempt emits ManualPaymentInitiated'
);

select ok(
  (
    select pg_get_functiondef(p.oid) ~* '''CardTokenized'''
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname = 'payment_persist_client_card_token'
  ),
  'payment_persist_client_card_token emits CardTokenized'
);

select ok(
  (
    select pg_get_functiondef(p.oid) ~* '''WebhookReceived'''
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname = 'payment_ingest_webhook_event'
  ),
  'payment_ingest_webhook_event emits WebhookReceived'
);

select ok(
  (
    select pg_get_functiondef(p.oid) ~* 'payment_webhook_event'
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname = 'payment_write_event'
  ),
  'payment_write_event accepts payment_webhook_event aggregate type'
);

select finish();
rollback;
